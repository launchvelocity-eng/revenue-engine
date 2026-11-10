import express from 'express';
import cors from 'cors';
import pg from 'pg';

// 1. Extract Pool constructor first
const { Pool } = pg;

const app = express();
const PORT = process.env.PORT || 10000;

// 2. Safely configure the Pool instance below the import
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ... the rest of your server configuration, middleware, and routes
