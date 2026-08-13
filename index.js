const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');

const app = express();
app.use(express.json());
app.use(cors());

// Initialize Resend with your API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

app.post('/api/waitlist', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    console.log(`Received email: ${email}`);

    try {
        // Send email notification using Resend
        const data = await resend.emails.send({
            from: 'onboarding@resend.dev', // Or your verified domain email
            to: 'mongealfredoantonio@gmail.com',
            subject: 'New LaunchVelocity Waitlist Signup!',
            html: `<p>New signup received: <strong>${email}</strong></p>`
        });

        console.log('Email sent successfully:', data);
        return res.status(200).json({ message: 'Success! You are on the waitlist.' });
    } catch (error) {
        console.error('Failed to send email:', error);
        return res.status(500).json({ message: 'Server error sending email.' });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
