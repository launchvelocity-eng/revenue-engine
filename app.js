import express from 'express';
import cors from 'cors';
import pkg from 'pg';

const { Pool } = pkg;

// Initialize express app first
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool using Render's environment variable
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('📦 Connected to PostgreSQL database at:', res.rows[0].now);
    }
});

// Health check route
app.get('/', (req, res) => {
    res.status(200).json({ status: 'Revenue-Engine API is running successfully' });
});

// Start server bound to 0.0.0.0 for Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is live and listening on port ${PORT}`);
});
