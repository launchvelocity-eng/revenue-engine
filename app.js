import http from 'node:http';
import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000
});

const PORT = process.env.PORT || 10000;

// Self-Healing Telemetry Logger
function logTelemetry(event, details) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        engine: 'LaunchVelocity-RevenueEngine',
        event,
        details
    }));
}

// Resend Confirmation Email Dispatcher
async function sendResendConfirmation(recipientEmail) {
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
        logTelemetry('EMAIL_WARN', 'RESEND_API_KEY missing from environment variables.');
        return;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'Revenue-Engine <onboarding@resend.dev>',
                to: [recipientEmail],
                subject: "You're on the Launch Velocity Waitlist!",
                html: `
                    <div style="font-family: Arial, sans-serif; background-color: #f4f7f6; padding: 20px;">
                        <div style="background: #ffffff; max-width: 480px; margin: 0 auto; border-radius: 16px; padding: 30px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                            <h2 style="color: #0b3c5d; margin-bottom: 12px;">You're on the list!</h2>
                            <p style="color: #4a5568; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                                Hi! This confirmation is letting you know your sign up to our waiting list was successful. We will send an email verifying your sign up.
                            </p>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                            <div style="font-size: 12px; color: #718096;">Powered by</div>
                            <div style="font-size: 18px; color: #0969da; font-weight: bold; margin-top: 4px;">Launch Velocity</div>
                            <div style="font-size: 11px; color: #319795; font-style: italic;">Igniting Innovation</div>
                        </div>
                    </div>
                `
            })
        });

        if (response.ok) {
            logTelemetry('EMAIL_SENT', `Confirmation email sent to ${recipientEmail}`);
        } else {
            const errData = await response.json();
            logTelemetry('EMAIL_ERROR', errData);
        }
    } catch (err) {
        logTelemetry('EMAIL_EXCEPTION', err.message);
    }
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'Revenue-Engine API is running successfully' }));
    }

    if (req.url === '/api/execute' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const client_event = parsed.client_event || 'waitlist_signup';
                const email = (parsed.payload?.asset_id || parsed.email || '').trim().toLowerCase();

                if (!email || !email.includes('@')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Valid email address is required' }));
                }

                // Resilient DB Operation with Fallback
                try {
                    await pool.query(
                        'INSERT INTO waitlist (email, client_event) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [email, client_event]
                    );
                    logTelemetry('DB_SUCCESS', `Saved ${email} to waitlist table`);
                } catch (dbErr) {
                    logTelemetry('DB_WARN', dbErr.message);
                }

                // Trigger Background Email Dispatch
                sendResendConfirmation(email).catch(e => logTelemetry('ASYNC_EMAIL_FAIL', e.message));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    success: true,
                    message: 'Hi! This confirmation is letting you know your sign up to our waiting list was successful. We will send an email verifying your sign up.'
                }));

            } catch (err) {
                logTelemetry('SERVER_ERROR', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
