import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import ValidationQueries from './validation.queries.js';
import Auth from '@server/features/auth/auth.queries.js';
import Users from '@server/features/users/users.queries.js';

const {
  DST_INSTALL_DIR = '',
  SERVERS_DIR = './servers',
  VALIDATION_CLUSTER_TOKEN = '',
} = process.env;

const VALIDATION_DIR = '__validation__';
const VALIDATION_SERVER_NAME = 'DST Account Validation';
const LOG_POLL_INTERVAL = 1500;
const WATCHDOG_RESTART_DELAY = 30000;
const CODE_EXPIRY_MINUTES = 10;
const MAX_CODES_PER_HOUR = 3;

// Chat log line pattern: [00:00:00]: [Say] (KU_xxxxx) PlayerName: message
const CHAT_PATTERN = /\[Say\]\s+\(([^)]+)\)\s+([^:]+):\s+(.+)/;

class ValidationService {
  private process: ChildProcess | null = null;
  private lastLogPosition = 0;
  private logWatcherInterval: ReturnType<typeof setInterval> | null = null;
  private watchdogTimeout: ReturnType<typeof setTimeout> | null = null;
  private enabled = false;

  isEnabled(): boolean {
    return this.enabled;
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  getServerName(): string {
    return VALIDATION_SERVER_NAME;
  }

  async requestValidation(userId: number): Promise<{ code: string; expiresAt: string; serverName: string }> {
    if (!this.enabled) {
      throw new Error('Validation system is not available. VALIDATION_CLUSTER_TOKEN is not configured.');
    }

    const user = await Auth.findUserById(userId);
    if (!user) throw new Error('User not found');
    if (user.is_validated) throw new Error('Account is already validated');
    if (!user.kuid) throw new Error('You must register a KUID before validating. Add your KUID in registration or account settings.');

    // Rate limit
    const recentCount = await ValidationQueries.countRecentCodes(userId);
    if (recentCount >= MAX_CODES_PER_HOUR) {
      throw new Error('Too many validation requests. Please wait before trying again.');
    }

    // Return existing active code if one exists
    const existing = await ValidationQueries.getActiveCodeForUser(userId);
    if (existing) {
      return { code: existing.code, expiresAt: existing.expires_at, serverName: VALIDATION_SERVER_NAME };
    }

    // Generate new 6-char hex code
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000).toISOString();
    await ValidationQueries.createCode(userId, code, expiresAt);

    return { code, expiresAt, serverName: VALIDATION_SERVER_NAME };
  }

  async checkValidationStatus(userId: number): Promise<{ isValidated: boolean; ign: string | null }> {
    const user = await Auth.findUserById(userId);
    if (!user) throw new Error('User not found');
    return { isValidated: !!user.is_validated, ign: user.ign || null };
  }

  async setupValidationServer(): Promise<void> {
    const clusterDir = path.join(SERVERS_DIR, VALIDATION_DIR);
    const masterDir = path.join(clusterDir, 'Master');

    await fs.mkdir(masterDir, { recursive: true });

    // Write cluster token
    await fs.writeFile(path.join(clusterDir, 'cluster_token.txt'), VALIDATION_CLUSTER_TOKEN.trim());

    // Write cluster.ini — lightweight single-shard validation server
    const clusterIni = [
      '[GAMEPLAY]',
      'game_mode = survival',
      'max_players = 6',
      'pvp = false',
      '',
      '[NETWORK]',
      `cluster_name = ${VALIDATION_SERVER_NAME}`,
      'cluster_description = Type your validation code in chat to verify your account.',
      'cluster_intention = cooperative',
      'cluster_password = ',
      'lan_only_cluster = false',
      'offline_cluster = false',
      '',
      '[MISC]',
      'console_enabled = true',
      '',
      '[SHARD]',
      'shard_enabled = false',
      'bind_ip = 127.0.0.1',
      'master_ip = 127.0.0.1',
      'master_port = 10997',
      'cluster_key = dst-validation',
    ].join('\n');
    await fs.writeFile(path.join(clusterDir, 'cluster.ini'), clusterIni);

    // Write Master/server.ini
    const serverIni = [
      '[NETWORK]',
      'server_port = 27015',
      '',
      '[STEAM]',
      'master_server_port = 27016',
      'authentication_port = 8765',
    ].join('\n');
    await fs.writeFile(path.join(masterDir, 'server.ini'), serverIni);

    // Create agreements
    const agreementsDir = path.join(clusterDir, 'Agreements', 'DoNotStarveTogether');
    await fs.mkdir(agreementsDir, { recursive: true });
    const agreementsFile = path.join(agreementsDir, 'agreements.ini');
    try {
      await fs.access(agreementsFile);
    } catch {
      await fs.writeFile(agreementsFile, '[agreements]\nprivacy_policy=accepted\neula=accepted\n');
    }
  }

  async startValidationServer(): Promise<void> {
    if (!VALIDATION_CLUSTER_TOKEN) {
      console.log('[Validation] VALIDATION_CLUSTER_TOKEN not set — validation system disabled');
      this.enabled = false;
      return;
    }

    if (!DST_INSTALL_DIR) {
      console.log('[Validation] DST_INSTALL_DIR not set — validation system disabled');
      this.enabled = false;
      return;
    }

    this.enabled = true;

    try {
      await this.setupValidationServer();
    } catch (err) {
      console.error('[Validation] Failed to set up validation server files:', err);
      return;
    }

    await this.spawnProcess();
  }

  private async spawnProcess(): Promise<void> {
    if (this.process) return;

    const clusterDir = path.join(SERVERS_DIR, VALIDATION_DIR);
    const binary = path.join(DST_INSTALL_DIR, 'bin64', 'dontstarve_dedicated_server_nullrenderer_x64');

    console.log('[Validation] Starting validation server...');

    const proc = spawn(binary, [
      '-console',
      '-persistent_storage_root', clusterDir,
      '-conf_dir', '.',
      '-cluster', '.',
      '-shard', 'Master',
    ], {
      cwd: path.join(DST_INSTALL_DIR, 'bin64'),
      stdio: 'ignore',
      detached: true,
    });

    proc.unref();
    this.process = proc;
    this.lastLogPosition = 0;

    proc.on('exit', (code) => {
      console.log(`[Validation] Validation server exited (code ${code})`);
      this.process = null;
      this.stopLogWatcher();

      // Watchdog: auto-restart after delay
      if (this.enabled) {
        console.log(`[Validation] Will restart in ${WATCHDOG_RESTART_DELAY / 1000}s...`);
        this.watchdogTimeout = setTimeout(() => this.spawnProcess(), WATCHDOG_RESTART_DELAY);
      }
    });

    this.startLogWatcher();
  }

  private startLogWatcher(): void {
    if (this.logWatcherInterval) return;

    const logPath = path.join(SERVERS_DIR, VALIDATION_DIR, 'Master', 'server_chat_log.txt');

    this.logWatcherInterval = setInterval(async () => {
      try {
        const content = await fs.readFile(logPath, 'utf-8').catch(() => '');
        if (!content || content.length <= this.lastLogPosition) return;

        const newContent = content.substring(this.lastLogPosition);
        this.lastLogPosition = content.length;

        const lines = newContent.split('\n').filter(Boolean);
        for (const line of lines) {
          await this.processLogLine(line);
        }
      } catch {
        // Log file may not exist yet
      }
    }, LOG_POLL_INTERVAL);
  }

  private stopLogWatcher(): void {
    if (this.logWatcherInterval) {
      clearInterval(this.logWatcherInterval);
      this.logWatcherInterval = null;
    }
  }

  private async processLogLine(line: string): Promise<void> {
    const match = line.match(CHAT_PATTERN);
    if (!match) return;

    const [, kuid, playerName, message] = match;
    const trimmedMessage = message.trim().toUpperCase();

    // Look for active validation code
    const codeRecord = await ValidationQueries.findActiveCode(trimmedMessage);
    if (!codeRecord) return;

    // Get the user who requested this code
    const user = await Auth.findUserById(codeRecord.user_id);
    if (!user) return;

    // Verify the KUID from chat matches the user's registered KUID
    if (user.kuid !== kuid) {
      console.log(`[Validation] KUID mismatch: code ${trimmedMessage} belongs to ${user.kuid}, but typed by ${kuid}`);
      return;
    }

    // Mark code as used and validate the user
    await ValidationQueries.markCodeUsed(codeRecord.id);
    await Users.updateValidation(codeRecord.user_id, playerName.trim());
    console.log(`[Validation] User ${user.username} validated as ${playerName.trim()} (${kuid})`);
  }

  async stop(): Promise<void> {
    this.enabled = false;

    if (this.watchdogTimeout) {
      clearTimeout(this.watchdogTimeout);
      this.watchdogTimeout = null;
    }

    this.stopLogWatcher();

    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }
      this.process = null;
    }
  }
}

export const validationService = new ValidationService();
