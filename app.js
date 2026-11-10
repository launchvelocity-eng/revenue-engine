// Enhanced Pool Configuration with Production SSL Handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Database Verification Ping Endpoint
app.get('/api/db-ping', async (req, res) => {
  const client = await pool.connect();
  try {
    const dbResponse = await client.query('SELECT NOW() as current_server_time, count(*) from tenant_vaults;');
    res.status(200).json({
      status: 'CONNECTED',
      database_time: dbResponse.rows[0].current_server_time,
      active_vaults: parseInt(dbResponse.rows[0].count, 10),
      pool: {
        total_connections: pool.totalCount,
        idle_connections: pool.idleCount
      }
    });
  } catch (error) {
    console.error('[DATABASE VERIFICATION ERROR]:', error.message);
    res.status(500).json({ status: 'CONNECTION_FAILED', error: error.message });
  } finally {
    client.release();
  }
});
