import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import ValidationQueries from './validation.queries.js';
import Auth from '@server/features/auth/auth.queries.js';
import Users from '@server/features/users/users.queries.js';
import Servers from '@server/features/servers/servers.queries.js';
import { processService } from '@server/features/servers/process.service.js';
import { extractKuid, createServerFiles, getClusterPath } from '@server/services/dst.js';

const {
  VALIDATION_CLUSTER_TOKEN = '',
  DST_INSTALL_DIR = '',
} = process.env;

const VALIDATION_SHARE_CODE = 'validation';
const VALIDATION_SERVER_NAME = 'DST Account Validation';
const LOG_POLL_INTERVAL = 1500;
const CODE_EXPIRY_MINUTES = 10;
const MAX_CODES_PER_HOUR = 3;

// Chat log line pattern: [00:00:00]: [Say] (KU_xxxxx) PlayerName: message
const CHAT_PATTERN = /\[Say\]\s+\(([^)]+)\)\s+([^:]+):\s+(.+)/;

class ValidationService {
  private logWatcherInterval: ReturnType<typeof setInterval> | null = null;
  private lastLogPosition = 0;
  private enabled = false;
  private serverId: number | null = null;

  isEnabled(): boolean {
    return this.enabled;
  }

  async isRunning(): Promise<boolean> {
    if (!this.serverId) return false;
    const server = await Servers.findById(this.serverId);
    return server?.status === 'running' || server?.status === 'starting';
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

  private async ensureDbEntry(): Promise<number> {
    const existing = await Servers.findByShareCode(VALIDATION_SHARE_CODE);
    if (existing) return existing.id;

    const adminUser = await Auth.findUserByUsername(process.env.ADMIN_USER || '');
    if (!adminUser) throw new Error('Admin user not found for validation server');

    const kuid = extractKuid(VALIDATION_CLUSTER_TOKEN) || '';
    const maxOffset = await Servers.getMaxPortOffset();
    const portOffset = maxOffset + 1;

    await createServerFiles(kuid, VALIDATION_SHARE_CODE, VALIDATION_CLUSTER_TOKEN, portOffset, {
      name: VALIDATION_SERVER_NAME,
      description: 'Type your validation code in chat to verify your account.',
      gameMode: 'endless',
      serverIntention: 'cooperative',
      maxPlayers: 64,
      pvp: false,
      password: '',
    });

    const serverId = await Servers.create({
      userId: adminUser.id,
      name: VALIDATION_SERVER_NAME,
      description: 'Type your validation code in chat to verify your account.',
      kuid,
      shareCode: VALIDATION_SHARE_CODE,
      clusterToken: VALIDATION_CLUSTER_TOKEN,
      maxPlayers: 64,
      gameMode: 'endless',
      serverIntention: 'cooperative',
      pvp: false,
      password: '',
      portOffset,
    });

    return serverId;
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
      this.serverId = await this.ensureDbEntry();
    } catch (err) {
      console.error('[Validation] Failed to set up validation server:', err);
      return;
    }

    const server = await Servers.findById(this.serverId);
    if (!server) return;

    try {
      await processService.startServer(this.serverId, server.kuid, VALIDATION_SHARE_CODE);
      console.log('[Validation] Validation server started');
    } catch (err) {
      console.error('[Validation] Failed to start validation server:', err);
    }

    this.startLogWatcher();
  }

  private startLogWatcher(): void {
    if (this.logWatcherInterval) return;

    const logPath = path.join(getClusterPath(VALIDATION_SHARE_CODE), 'Master', 'server_chat_log.txt');

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
    this.stopLogWatcher();
    if (this.serverId) {
      try {
        await processService.stopServer(this.serverId);
      } catch {
        // May not be running
      }
    }
    this.enabled = false;
  }
}

export const validationService = new ValidationService();
