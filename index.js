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
            // 1. Send confirmation/thank you email TO THE USER
            await resend.emails.send({
                from: 'onboarding@resend.dev',
                to: cleanEmail, // Sends directly to the user who signed up!
                subject: 'You are on the LaunchVelocity Waitlist!',
                html: `
                    <h2>Welcome aboard!</h2>
                    <p>We successfully received your confirmation and handshake. Thank you for joining LaunchVelocity!</p>
                    <p>We will be in touch with you soon with updates and early access details.</p>
                    <br>
                    <p>Best regards,<br>The LaunchVelocity Team</p>
                `
            });

            // 2. Send notification email TO YOU (the admin)
            await resend.emails.send({
                from: 'onboarding@resend.dev',
                to: 'mongealfredoantonio@gmail.com', // Your admin email
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
