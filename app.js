app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
  
  // 1. First, build or verify missing database structures natively
  await runDatabaseMigrations();
  
  // 2. Then, run your background audit tracking cycles safely
  try {
    await executeTenantOffboardingAudit();
  } catch (startupErr) {
    console.warn('[STARTUP NOTICE] Background worker deferred:', startupErr.message);
  }
});
