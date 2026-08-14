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

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many requests' }
});
app.use('/api/', limiter);

let pool = null;
try {
    if (process.env.DATABASE_URL) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        console.log('Database pool initialized.');
    }
} catch (e) {
    console.error('Database init error:', e.message);
}

const resend = new Resend(process.env.RESEND_API_KEY || 're_123');
const pendingSignups = new Map();

app.post('/api/signup', async (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pendingSignups.set(email.toLowerCase().trim(), code);

    try {
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'mongealfredoantonio@gmail.com',
            subject: 'LaunchVelocity Code',
            html: `<p>Code: <strong>${code}</strong></p>`
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Email dispatch failed' });
    }
});

app.post('/api/verify', async (req, res) => {
    const { email, code } = req.body;
    const cleanEmail = email?.toLowerCase().trim();

    if (pendingSignups.get(cleanEmail) === code) {
        pendingSignups.delete(cleanEmail);
        
        if (pool) {
            try {
                const client = await pool.connect();
                const userRes = await client.query(
                    'INSERT INTO secure_users (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id',
                    [cleanEmail]
                );
                await client.query(
                    'INSERT INTO client_storage_vaults (user_id, encryption_key_fingerprint) VALUES ($1, $2)',
                    [userRes.rows[0].id, 'AES256-KEY-001']
                );
                client.release();
            } catch (dbErr) {
                console.error('DB error during verify:', dbErr);
            }
        }

        return res.json({ success: true });
    }

    res.status(400).json({ error: 'Invalid code' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
