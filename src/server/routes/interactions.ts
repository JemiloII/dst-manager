import { Hono } from 'hono';
import crypto from 'node:crypto';

const interactions = new Hono();

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || '';

function verifyDiscordSignature(body: string, signature: string, timestamp: string): boolean {
	if (!DISCORD_PUBLIC_KEY) return false;

	const message = Buffer.from(timestamp + body);
	const sig = Buffer.from(signature, 'hex');
	const key = Buffer.from(DISCORD_PUBLIC_KEY, 'hex');

	return crypto.verify(null, message, { key: crypto.createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key]), format: 'der', type: 'spki' }), dsaEncoding: undefined as never }, sig);
}

interactions.post('/', async (c) => {
	const signature = c.req.header('x-signature-ed25519') || '';
	const timestamp = c.req.header('x-signature-timestamp') || '';
	const body = await c.req.text();

	if (!verifyDiscordSignature(body, signature, timestamp)) {
		return c.text('Invalid request signature', 401);
	}

	const payload = JSON.parse(body);

	// PING - Discord verification
	if (payload.type === 1) {
		return c.json({ type: 1 });
	}

	return c.json({ type: 1 });
});

export default interactions;
