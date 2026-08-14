const PORT = process.env.PORT || 10000;

try {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} catch (err) {
  console.error('Failed to start server:', err);
}
