import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

// 1. Initialize Express first
const app = express();
const PORT = process.env.PORT || 10000;

// 2. Setup Database Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 3. Define routes using the initialized 'app' instance
app.get('/api/telemetry', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS server_time');
    res.json({
      status: 'online',
      database: 'connected',
      serverTime: result.rows[0].server_time
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use(express.static('public'));

// 4. Start listener
app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
