// Inside your startup initialization block in app.js
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
  
  try {
    // Attempt the audit sweep defensively without crashing the whole process if schema drops
    await executeTenantOffboardingAudit();
  } catch (err) {
    console.error('[STARTUP WARNING] Automated background audit deferred:', err.message);
  }
});
