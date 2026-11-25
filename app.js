import express from 'express';
import pg from 'pg';

const app = express();
const PORT = process.env.PORT || 10000;
const KEY = 'LV-KEY-B826EA2203EAACCA';

process.on('uncaughtException', (err) => console.error('UNCAUGHT:', err));
process.on('unhandledRejection', (err) => console.error('UNHANDLED:', err));

const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://launchvelocity-eng.github.io');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-hardware-key, x-tenant-id');
  return req.method === 'OPTIONS' ? res.sendStatus(204) : next();
});
app.use(express.json());
