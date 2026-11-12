const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`[REVENUE ENGINE] Running live on port ${PORT}`);
});
Check your Render logs after deploying—if it prints `[REVENUE ENGINE] Running live on port 10000`, the server is successfully active.
