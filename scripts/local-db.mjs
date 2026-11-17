// Local Postgres for the accounts API (scripts/accounts.mjs), without installing Postgres: the embedded-postgres package
// carries the server binaries. The data lives outside the repository (NSP_PG_DIR, by default
// ~/.local/state/nsp-center/postgres) and survives restarts. On the first run it creates the cluster with a random
// password and writes DATABASE_URL into .env (git ignores it), which apps/api/server.mjs reads. The process keeps running;
// stopping it (Ctrl+C or the service stop) shuts Postgres down cleanly.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const dir = process.env.NSP_PG_DIR || join(homedir(), '.local/state/nsp-center/postgres');
const port = Number(process.env.NSP_PG_PORT) || 8700;
const envFile = resolve('.env');
const DATABASE = 'nsp_center';

const env = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
const known = env.match(/^DATABASE_URL=postgres:\/\/nsp:([^@]+)@127\.0\.0\.1:(\d+)\/nsp_center$/m);
const fresh = !existsSync(join(dir, 'PG_VERSION'));
if (!fresh && !known) throw new Error(`${dir} exists but .env has no DATABASE_URL for it; restore .env or choose another NSP_PG_DIR.`);
const password = fresh ? randomBytes(18).toString('base64url') : decodeURIComponent(known[1]);

const pg = new EmbeddedPostgres({ databaseDir: dir, port, user: 'nsp', password, authMethod: 'scram-sha-256', persistent: true, autoRehydrateSymlinks: true, onLog: () => {}, onError: message => console.error(String(message).trim()) });
if (fresh) { mkdirSync(join(dir, '..'), { recursive: true }); await pg.initialise(); }
await pg.start();
const client = pg.getPgClient('postgres', '127.0.0.1');
await client.connect();
const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [DATABASE]);
await client.end();
if (!rowCount) await pg.createDatabase(DATABASE);

const url = `DATABASE_URL=postgres://nsp:${encodeURIComponent(password)}@127.0.0.1:${port}/${DATABASE}`;
if (!known || known[2] !== String(port)) writeFileSync(envFile, (env.replace(/^DATABASE_URL=.*\n?/m, '') + `${url}\n`).replace(/^\n+/, ''));
console.log(`Local Postgres: 127.0.0.1:${port}/${DATABASE} (data: ${dir}); DATABASE_URL is in .env`);

const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
