#!/usr/bin/env node
/**
 * Generate the secrets a self-hosted Supabase stack needs.
 *
 * The upstream docs point you at a web page to mint the anon and service_role
 * keys, which means pasting the signing secret of your own server into someone
 * else's website. These are plain HS256 JWTs, so node's crypto can do it here
 * and the secret never leaves the machine.
 *
 *   node scripts/make-keys.mjs            # 10-year keys, fresh random secrets
 *   node scripts/make-keys.mjs --years 5
 */
import { createHmac, randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
const years = Number(args[args.indexOf('--years') + 1]) || 10;

const b64 = (buf) =>
	Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function jwt(payload, secret) {
	const head = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const body = b64(JSON.stringify(payload));
	const sig = b64(createHmac('sha256', secret).update(`${head}.${body}`).digest());
	return `${head}.${body}.${sig}`;
}

// Alphanumeric only: these land in a .env that docker compose and Kong both
// parse, and a stray quote or backslash there is a bad afternoon.
const secret = (bytes) => randomBytes(bytes).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, bytes);

const jwtSecret = secret(48);
const iat = Math.floor(Date.now() / 1000);
const exp = iat + years * 365 * 24 * 3600;

const out = {
	POSTGRES_PASSWORD: secret(32),
	JWT_SECRET: jwtSecret,
	ANON_KEY: jwt({ role: 'anon', iss: 'supabase', iat, exp }, jwtSecret),
	SERVICE_ROLE_KEY: jwt({ role: 'service_role', iss: 'supabase', iat, exp }, jwtSecret),
	DASHBOARD_USERNAME: 'arbodb',
	DASHBOARD_PASSWORD: secret(24),
	SECRET_KEY_BASE: secret(64),
	VAULT_ENC_KEY: secret(32)
};

for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
console.error(
	`\n# Keys valid until ${new Date(exp * 1000).toISOString().slice(0, 10)}.` +
		`\n# ANON_KEY is public — it goes in the browser bundle. SERVICE_ROLE_KEY bypasses` +
		`\n# row level security: keep it on the server and never put it in a PUBLIC_ variable.`
);
