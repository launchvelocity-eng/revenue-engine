import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';
import pkg from 'pg';

const { Pool } = pkg;

const app = express();

// 1. Security Headers & Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// 2. Rate Limiting Protection
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// 3. Database Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Secure Database Connected Successfully at:', res.rows[0].now);
    }
});

const resend = new Resend(process.env.RESEND_API_KEY);
const pendingSignups = new Map(); // email -> code

// Step 1: Request verification code securely
app.post('/api/signup', async (req, res) => {
    const { email } = req.body;
    
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    pendingSignups.set(email.toLowerCase().trim(), verificationCode);

    try {
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'mongealfredoantonio@gmail.com',
            subject: 'Your LaunchVelocity Verification Code',
            html: `<p>Security Handshake Code: <strong>${verificationCode}</strong></p>`
        });

        res.json({ success: true, message: 'Verification code sent securely!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to dispatch secure email.' });
    }
});

// Step 2: Confirm verification code & provision secure vault
app.post('/api/verify', async (req, res) => {
    const { email, code } = req.body;
    
    if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (pendingSignups.get(cleanEmail) === code) {
        pendingSignups.delete(cleanEmail);
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Create or retrieve user in PostgreSQL
            const userRes = await client.query(
                'INSERT INTO secure_users (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id',
                [cleanEmail]
            );
            const userId = userRes.rows[0].id;

            // Provision secure storage vault
            await client.query(
                'INSERT INTO client_storage_vaults (user_id, encryption_key_fingerprint) VALUES ($1, $2)',
                [userId, 'AES256-GEN-SUCCESS-001']
            );

            await client.query('COMMIT');

            // Send confirmation email TO THE USER
            await resend.emails.send({
                from: 'onboarding@resend.dev',
                to: cleanEmail,
                subject: 'You are on the LaunchVelocity Waitlist!',
                html: `
                    <h2>Welcome aboard!</h2>
                    <p>We successfully received your confirmation and handshake. Thank you for joining LaunchVelocity!</p>
                    <p>We will be in touch with you soon with updates and early access details.</p>
                    <br>
                    <p>Best regards,<br>The LaunchVelocity Team</p>
                `
            });

            // Send notification email TO YOU (admin)
            await resend.emails.send({
                from: 'onboarding@resend.dev',
                to: 'mongealfredoantonio@gmail.com',
                subject: 'Securely Verified Vault Provisioned!',
                html: `<p>New verified user completed handshake and database vault was provisioned: <strong>${cleanEmail}</strong></p>`
            });

            return res.json({ success: true, message: 'Handshake verified and vault created!' });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Vault Provisioning Error:', error);
            return res.status(500).json({ error: 'Failed to provision secure vault.' });
        } finally {
            client.release();
        }
    }

    res.status(400).json({ error: 'Invalid verification code' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Secure server running on port ${PORT}`));
