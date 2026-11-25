import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 10000;
const MASTER_HARDWARE_KEY = 'LV-KEY-B826EA2203EAACCA';

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  : null;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://launchvelocity-eng.github.io');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-hardware-key, x-tenant-id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.use(express.json());

function verifyHardwareKey(req, res, next) {
  const clientKey = req.header('x-hardware-key');
  if (!clientKey || clientKey !== MASTER_HARDWARE_KEY) {
    return res.status(403).json({ error: 'Sovereign Access Denied: Invalid Hardware Key'
