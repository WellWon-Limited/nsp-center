import {ADMIN_PATH} from '../packages/presentation/admin-path.mjs';
// Creates (or resets) a site administrator: a separate staff account that opens only site management (/admin/), not a
// customer's cabinet. Usage: npm run admin:create -- <email> [--name "Имя Фамилия"]. The password is taken from
// ADMIN_PASSWORD or generated, printed once and never stored anywhere but as its scrypt hash in the database; the
// account's sessions are closed. Local database only for now (the stand gets its administrators separately).
import pg from 'pg';
import { SCHEMA, hashPassword } from './accounts.mjs';
import { SITE_SCHEMA, oneTimePassword } from './site-admin.mjs';
import { emailError } from '../packages/presentation/contact-fields.mjs';

try { process.loadEnvFile('.env'); } catch { /* no .env */ }
const args = process.argv.slice(2);
const email = (args.find(a => !a.startsWith('--')) ?? '').trim().toLowerCase();
const nameAt = args.indexOf('--name');
const [firstName = 'Администратор', lastName = 'NSP Center'] = nameAt >= 0 ? String(args[nameAt + 1] ?? '').split(/\s+/) : [];
if (emailError(email)) throw new Error(`Usage: npm run admin:create -- <email>. ${emailError(email)}`);
const url = process.env.DATABASE_URL;
if (!url) throw new Error('No DATABASE_URL: start the local database first (npm run db:local).');
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Administrators are created on the local database only for now.');

const password = process.env.ADMIN_PASSWORD || oneTimePassword();
if (password.length < 12) throw new Error('ADMIN_PASSWORD: at least 12 characters for an administrator.');

const pool = new pg.Pool({ connectionString: url, max: 2 });
await pool.query(SCHEMA + SITE_SCHEMA);
const { rows: [user] } = await pool.query(`insert into users (email, phone, phone_key, first_name, last_name, partner_id, password_hash, consent_at, role)
  values ($1, '', null, $2, $3, '', $4, now(), 'admin')
  on conflict (lower(email)) do update set role = 'admin', password_hash = excluded.password_hash, first_name = excluded.first_name, last_name = excluded.last_name, partner_id = ''
  returning id`, [email, firstName, lastName, await hashPassword(password)]);
await pool.query('delete from sessions where user_id = $1', [user.id]);
await pool.query("insert into admin_log (user_id, action, detail) values ($1, 'admin-created', $2)", [user.id, JSON.stringify({ email, by: 'npm run admin:create' })]).catch(() => {});
await pool.end();
console.log(`Администратор: ${email}\nПароль: ${password}\nВход: ${ADMIN_PATH} (пароль показан один раз; смените его, если он попал в переписку)`);
