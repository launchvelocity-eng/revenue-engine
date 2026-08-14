// Background Cron Job: Run daily at midnight to check subscription health
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily subscription maintenance check...');
  try {
    if (!pool) return;

    // Example: Mark subscriptions as expired if past due grace period expires
    const result = await pool.query(
      `UPDATE users 
       SET subscription_status = 'expired' 
       WHERE subscription_status = 'past_due' 
       AND created_at < NOW() - INTERVAL '30 days'`
    );
    
    console.log(`Maintenance complete. Updated ${result.rowCount} expired accounts.`);
  } catch (err) {
    console.error('Subscription Maintenance Cron Error:', err);
  }
});
