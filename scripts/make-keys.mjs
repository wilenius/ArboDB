#!/usr/bin/env node
/**
 * Generate the secrets a self-hosted Supabase stack needs.
 *
 * The upstream docs point you at a web page to mint the anon and service_role
 * keys, which means pasting the signing secret of your own server into someone
 * else's website. These are plain HS256 JWTs, so node's crypto can do it here
 * and the secret never leaves the machine.
 *
 * Every run mints entirely NEW secrets. This is not a way to look up the keys a
 * running stack is using — for that, read stack/.env, or use --check.
 *
 *   node scripts/make-keys.mjs                      # 10-year keys, all new
 *   node scripts/make-keys.mjs --years 5
 *   node scripts/make-keys.mjs --check path/to/.env # verify, generate nothing
 */
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

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

// --- --check: verify an existing .env, generating nothing ---------------------
if (args.includes('--check')) {
	const path = args[args.indexOf('--check') + 1];
	if (!path) {
		console.error('usage: make-keys.mjs --check /srv/arbodb/stack/.env');
		process.exit(2);
	}

	const env = {};
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (m) env[m[1]] = m[2];
	}

	const jwtSecret = env.JWT_SECRET;
	if (!jwtSecret) {
		console.error(`no JWT_SECRET in ${path}`);
		process.exit(1);
	}

	let bad = 0;
	for (const name of ['ANON_KEY', 'SERVICE_ROLE_KEY']) {
		const token = env[name];
		if (!token) {
			console.log(`${name}: MISSING`);
			bad++;
			continue;
		}
		const [head, body, sig] = token.split('.');
		// The whole point: a key signed with a different secret than the stack is
		// running is accepted by nothing and explains "every request 401s".
		const want = b64(createHmac('sha256', jwtSecret).update(`${head}.${body}`).digest());
		let claims = {};
		try {
			claims = JSON.parse(Buffer.from(body, 'base64url').toString());
		} catch {
			/* malformed */
		}
		const expired = claims.exp && claims.exp * 1000 < Date.now();
		if (sig !== want) {
			console.log(`${name}: SIGNATURE DOES NOT MATCH JWT_SECRET`);
			bad++;
		} else if (expired) {
			console.log(`${name}: expired ${new Date(claims.exp * 1000).toISOString().slice(0, 10)}`);
			bad++;
		} else {
			const until = claims.exp
				? new Date(claims.exp * 1000).toISOString().slice(0, 10)
				: 'no expiry';
			console.log(`${name}: ok (role=${claims.role}, until ${until})`);
		}
	}

	console.error(
		bad
			? `\n# ${bad} problem(s). Regenerating means regenerating everything and` +
					`\n# re-initialising the database — see DEPLOYING.md before you do.`
			: '\n# Both keys are signed by this JWT_SECRET and unexpired.'
	);
	process.exit(bad ? 1 : 0);
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
	`\n# These are NEW secrets, valid until ${new Date(exp * 1000).toISOString().slice(0, 10)}.` +
		`\n# If a stack is already running, do not paste these over its .env — the keys` +
		`\n# would no longer match, and POSTGRES_PASSWORD is baked into the database at` +
		`\n# first init. To read the running values: grep '^ANON_KEY=' stack/.env` +
		`\n# To check them:  node scripts/make-keys.mjs --check stack/.env` +
		`\n#` +
		`\n# ANON_KEY is public — it goes in the browser bundle. SERVICE_ROLE_KEY bypasses` +
		`\n# row level security: keep it on the server and never put it in a PUBLIC_ variable.`
);
