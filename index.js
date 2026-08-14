import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';
import pkg from 'pg';

const { Pool } = pkg;

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Safe database pool initialization
let pool = null;
try {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Database connection warning:', err.message);
        } else {
            console.log('Secure Database Connected Successfully at:', res.rows[0].now);
        }
    });
} catch (e) {
    console.error('Pool initialization failed:', e.message);
}

// ... keep your rest of the endpoints (/api/signup, /api/verify) as they are ...
