const PORT = process.env.PORT || 10000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
