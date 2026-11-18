// Test accounts for checking registration and sign-in on the local Postgres (scripts/local-db.mjs). Re-running resets
// them to this state (password, profile and data); other accounts are not touched. Local only: refuses a DATABASE_URL
// that is not on this computer.
import pg from 'pg';
import { hashPassword, phoneKey } from './accounts.mjs';
import { assertDatabaseReady } from '../apps/api/database/ready.mjs';

try { process.loadEnvFile('.env'); } catch { /* no .env */ }
const url = process.env.DATABASE_URL;
if (!url) throw new Error('No DATABASE_URL: start the local database first (npm run db:local).');
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Test accounts are only for the local database.');

export const PASSWORD = 'test2026';
const today = new Date().toLocaleDateString('sv-SE');
const plan = items => ({ intake: items, intakeDate: today, intakePlans: { [today]: items } });
export const testAccounts = [
  { email: 'anna@test.nsp-center.ru', firstName: 'Анна', lastName: 'Иванова', phone: '+7 900 111-22-33', partnerId: '',
    data: { cart: { 'aloe-vera-juice': 1, 'bee-pollen': 2 }, favorites: ['alfalfa', 'astragalus', 'bifidophilus-flora-force'], waitlist: [], ...plan([{ id: 'alfalfa', time: '09:00', done: false }, { id: 'bee-pollen', time: '13:00', done: false }]) } },
  { email: 'admin@test.nsp-center.ru', firstName: 'Марина', lastName: 'Администратор', phone: '', partnerId: '', role: 'admin', data: {} },
  { email: 'ivan@test.nsp-center.ru', firstName: 'Иван', lastName: 'Петров', phone: '+7 900 222-33-44', partnerId: '', data: {} },
  { email: 'olga@test.nsp-center.ru', firstName: 'Ольга', lastName: 'Смирнова', phone: '', partnerId: '',
    data: { cart: { 'ag-x': 1 }, favorites: ['5-htp-power'], waitlist: [{ id: '5-htp-power', notified: false }, { id: 'achieve-with-yohimbe', notified: false }] } },
];

const pool = new pg.Pool({ connectionString: url, max: 2 });
await assertDatabaseReady(pool);
for (const a of testAccounts) {
  const { rows: [user] } = await pool.query(`insert into users (email, phone, phone_key, first_name, last_name, partner_id, password_hash, consent_at, role) values ($1, $2, $3, $4, $5, $6, $7, now(), $8)
    on conflict (lower(email), (role = 'customer')) do update set role = excluded.role, phone = excluded.phone, phone_key = excluded.phone_key, first_name = excluded.first_name, last_name = excluded.last_name, partner_id = excluded.partner_id, password_hash = excluded.password_hash returning id`,
    [a.email, a.phone, a.phone ? phoneKey(a.phone) : null, a.firstName, a.lastName, a.partnerId, await hashPassword(PASSWORD), a.role ?? 'customer']);
  await pool.query('insert into account_data (user_id, data) values ($1, $2) on conflict (user_id) do update set data = excluded.data, updated_at = now()', [user.id, JSON.stringify(a.data)]);
  await pool.query('delete from sessions where user_id = $1', [user.id]);
  console.log(`${a.email} / ${PASSWORD}${a.phone ? ` (или ${a.phone})` : ''}${a.role === 'admin' ? ' — администратор' : ''}`);
}
await pool.end();
