import http from 'http';
import { pipeline } from 'stream/promises';
import pkg from 'pg';
const { Pool } = pkg;

// Database pool setup...
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Your server creation and route handlers start here inside functions!
