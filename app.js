import express from 'express';
import cors from 'cors';
import router from './index.js';

// Catch unhandled exceptions so Render logs them instead of exiting silently
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
    process.exit(1);
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mount the API router
app.use('/api', router);

// Health check route for Render
app.get('/', (req, res) => {
    res.status(200).json({ status: 'Revenue-Engine API is running successfully' });
});

// Start server on Render's assigned port
const PORT = process.env.PORT || 3000;

console.log(`Attempting to bind server to port ${PORT}...`);

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server successfully running and listening on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('SERVER ERROR EVENT:', err);
});
