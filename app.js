import pkg from 'pg';
const { Pool } = pkg;

// Initialize PostgreSQL connection pool with strict timeout and limit configurations
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,              // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error if connection takes > 2s
});

pool.on('error', (err) => {
  console.error('[DATABASE CRITICAL] Unexpected error on idle PostgreSQL client', err);
});
