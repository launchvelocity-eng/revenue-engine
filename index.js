import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';

const app = express();

// 1. Security Headers (Helmet)
app.use(helmet());

// 2. CORS configuration (restrict if needed, or keep open for GitHub Pages)
app.use(cors());
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent payload stuffing

// 3. Rate Limiting Protection (Prevents brute-force & spam attacks)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' }
});

app.use('/api/', limiter);

const resend = new Resend(process.env.RESEND_API_KEY);

const pendingSignups = new Map(); // email -> { code, timestamp }

// Step 1: Request verification code securely
app.post('/api/signup', async (req, res) => {
    const { email } = req.body;
    
    // Basic validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store with expiration logic if desired
    pendingSignups.set(email.toLowerCase().trim(), verificationCode);

    try {
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'mongealfredoantonio@gmail.com', // Keep matching your Resend account email for testing
            subject: 'Your LaunchVelocity Verification Code',
            html: `<p>Security Handshake Code: <strong>${verificationCode}</strong></p>`
        });

        res.json({ success: true, message: 'Verification code sent securely!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to dispatch secure email.' });
    }
});

// Step 2: Confirm verification code
app.post('/api/verify', async (req, res) => {
    const { email, code } = req.body;
    
    if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (pendingSignups.get(cleanEmail) === code) {
        pendingSignups.delete(cleanEmail);

        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'mongealfredoantonio@gmail.com',
            subject: 'Securely Verified Waitlist Signup!',
            html: `<p>New verified user joined: <strong>${cleanEmail}</strong></p>`
        });

        return res.json({ success: true, message: 'Handshake verified successfully!' });
    }

    res.status(400).json({ error: 'Invalid verification code' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Secure server running on port ${PORT}`));
