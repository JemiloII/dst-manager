import crypto from 'node:crypto';

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || '';

class InteractionService {
  verifyDiscordSignature(body: string, signature: string, timestamp: string): boolean {
    if (!DISCORD_PUBLIC_KEY) return false;

    const message = Buffer.from(timestamp + body);
    const sig = Buffer.from(signature, 'hex');
    const key = Buffer.from(DISCORD_PUBLIC_KEY, 'hex');

    return crypto.verify(
      null,
      message,
      {
        key: crypto.createPublicKey({
          key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key]),
          format: 'der',
          type: 'spki',
        }),
        dsaEncoding: undefined as never,
      },
      sig,
    );
  }

  handleInteraction(payload: any) {
    // PING - Discord verification
    if (payload.type === 1) {
      return { type: 1 };
    }
    return { type: 1 };
  }
}

export const interactionService = new InteractionService();
