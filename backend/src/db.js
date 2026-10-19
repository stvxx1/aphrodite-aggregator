import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export function createPool() {
  const pool = new Pool({
    user: process.env.DB_USER || 'u0_a403', // default termux user
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'aphrodite',
    password: process.env.DB_PASSWORD || undefined,
    port: Number(process.env.DB_PORT) || 5432,
  });
  // An idle client dying (DB restart etc.) emits 'error'; unhandled, it kills the process.
  pool.on('error', (err) => console.error('Unexpected idle DB client error:', err.message));
  return pool;
}
