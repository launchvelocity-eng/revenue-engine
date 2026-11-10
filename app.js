const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test DB connection without crashing startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('[DB ERROR] Failed to connect to PostgreSQL:', err.stack);
  } else {
    console.log('[DB ENGINE] Connected to PostgreSQL successfully');
    release();
  }
});

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
