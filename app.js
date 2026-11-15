try {
  console.log("Setting up Express middleware...");
  const app = express();
  const PORT = Number(process.env.PORT) || 10000;
  
  // ... middleware and routes ...

  console.log("Attempting to bind port " + PORT + "...");
  app.listen(PORT, '0.0.0.0', () => {
    console.log("Launch Velocity API live on port " + PORT);
  });
} catch (err) {
  console.error("Fatal startup error:", err);
}
