import express from 'express';
import cors from 'cors';
import pkg from 'pg';

const { Pool } = pkg;

const app = express();

app.use(cors());
app.use(express.json());

// Safe PostgreSQL Connection Pool with Render SSL requirements
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Non-blocking connection test so startup never crashes
pool.connect((err, client, release) => {
    if (err) {
        console.error('⚠️ Database connection warning:', err.message);
    } else {
        console.log('📦 Connected to PostgreSQL database successfully!');
        release();
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
