import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';

const app = express();

// 1. Security Headers
app.use(helmet());

// 2. CORS & JSON Body Limit
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// 3. Rate Limiting Protection
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many requests from this IP, please try again later.' }
});

app.use('/api/', limiter);

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
            to: 'mongealfredoantonio@gmail.com', // Your Resend account email for testing
            subject: 'Your LaunchVelocity Verification Code',
            html: `<p>Security Handshake Code: <strong>${verificationCode}</strong></p>`
        });

        res.json({ success: true, message: 'Verification code sent securely!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to dispatch secure email.' });
    }
});

// Step 2: Confirm verification code & email the user back
app.post('/api/verify', async (req, res) => {
    const { email, code } = req.body;
    
    if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (pendingSignups.get(cleanEmail) === code) {
        pendingSignups.delete(cleanEmail);

        try {
            // Send confirmation thank-you email TO THE USER
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
                subject: 'Securely Verified Waitlist Signup!',
                html: `<p>New verified user completed the handshake and joined: <strong>${cleanEmail}</strong></p>`
            });

            return res.json({ success: true, message: 'Handshake verified successfully!' });
        } catch (error) {
            return res.status(500).json({ error: 'Failed to send confirmation email.' });
        }
    }

    res.status(400).json({ error: 'Invalid verification code' });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Secure server running on port ${PORT}`));
