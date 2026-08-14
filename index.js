// Replace the cron schedule block with this native Node.js interval timer
// Runs the audit check every 24 hours (86400000 ms)
setInterval(async () => {
  if (!pool) return;
  console.log('Running daily billing & retention audit...');
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE secure_users 
      SET account_status = 'locked' 
      WHERE account_status = 'active' 
      AND next_billing_date < NOW() - INTERVAL '4 days'
    `);

    const purgedUsers = await client.query(`
      UPDATE secure_users 
      SET account_status = 'purged', storage_allocated_gb = 0 
      WHERE account_status = 'locked' 
      AND next_billing_date < NOW() - INTERVAL '30 days'
      RETURNING email
    `);
    
    console.log(`Audit complete. Purged ${purgedUsers.rowCount} abandoned accounts.`);
  } catch (err) {
    console.error('Audit Error:', err);
  } finally {
    client.release();
  }
}, 24 * 60 * 60 * 1000);
