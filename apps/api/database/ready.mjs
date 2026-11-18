export const DATABASE_VERSION = '004_order_guards.sql';
/** Read-only readiness: requests never create or alter database objects. */
export async function assertDatabaseReady(pool) {
  const {rows} = await pool.query('select version from schema_migrations where version=$1', [DATABASE_VERSION]);
  if (!rows.length) throw new Error('Database migrations required: run npm run db:migrate before starting the API.');
}
