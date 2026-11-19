import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL?.trim() ||
      (process.env.SQL_HOST?.trim() && process.env.SQL_DB_NAME?.trim())
  );
}

function buildPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (connectionString) {
    const isLocal =
      connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    const useSsl =
      process.env.DATABASE_SSL === 'true' ||
      (process.env.DATABASE_SSL !== 'false' && !isLocal);

    return {
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      connectionTimeoutMillis: 15000,
    };
  }

  return {
    host: process.env.SQL_HOST || '127.0.0.1',
    port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 10,
    connectionTimeoutMillis: 15000,
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig());

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
