// Add this route to your Express app in app.js
app.get('/api/telemetry', async (req, res) => {
  try {
    // Optional: Query recent metrics or worker run stats from your database
    const result = await pool.query('SELECT NOW() AS server_time');
    
    res.json({
      status: 'online',
      database: 'connected',
      serverTime: result.rows[0].server_time,
      workers: {
        leaseWorker: { status: 'idle', lastRun: 'Just now', recordsProcessed: 0 },
        declutterAssistant: { status: 'idle', lastRun: 'Just now', purgedRecords: 0 }
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});
