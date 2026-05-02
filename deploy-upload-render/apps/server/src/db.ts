import Database from "better-sqlite3";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { config, isPostgresUrl } from "./config.js";

const usingPostgres = isPostgresUrl();

export const sqliteDb = usingPostgres ? null : new Database(config.databaseUrl);
export const pgPool = usingPostgres
  ? new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false }
    })
  : null;

if (sqliteDb) {
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("foreign_keys = ON");
}

export function isPostgres() {
  return usingPostgres;
}

export async function migrate() {
  if (pgPool) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        ordered_at TEXT NOT NULL,
        orderer_name TEXT NOT NULL,
        team TEXT,
        contact TEXT,
        memo TEXT,
        status TEXT NOT NULL DEFAULT 'submitted'
      );
    `);
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        brand TEXT NOT NULL,
        menu_id TEXT NOT NULL,
        menu_name TEXT NOT NULL,
        category TEXT NOT NULL,
        size TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        custom_request TEXT
      );
    `);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_orders_ordered_at ON orders(ordered_at);`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
    await pgPool.query(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);`);
    return;
  }

  sqliteDb!.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      ordered_at TEXT NOT NULL,
      orderer_name TEXT NOT NULL,
      team TEXT,
      contact TEXT,
      memo TEXT,
      status TEXT NOT NULL DEFAULT 'submitted'
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      brand TEXT NOT NULL,
      menu_id TEXT NOT NULL,
      menu_name TEXT NOT NULL,
      category TEXT NOT NULL,
      size TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      custom_request TEXT,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orders_ordered_at ON orders(ordered_at);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  `);
}

export async function withPgTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  if (!pgPool) {
    throw new Error("POSTGRES_NOT_CONFIGURED");
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function pgAll<T extends QueryResultRow>(query: string, values: unknown[] = []) {
  if (!pgPool) {
    throw new Error("POSTGRES_NOT_CONFIGURED");
  }
  const result = await pgPool.query<T>(query, values);
  return result.rows;
}

export async function pgOne<T extends QueryResultRow>(query: string, values: unknown[] = []) {
  const rows = await pgAll<T>(query, values);
  return rows[0];
}
