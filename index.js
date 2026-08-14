// Add to your PostgreSQL table initializations:
/*
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
*/

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// 1. Generate MFA Secret and QR Code for a user
app.post('/api/mfa/setup', authenticateToken, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({ name: `RevenueEngine (${req.user.email})` });
    
    if (pool) {
      await pool.query(
        'UPDATE users SET mfa_secret = $1 WHERE email = $2',
        [secret.base32, req.user.email]
      );
    }

    QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
      if (err) return res.status(500).json({ error: 'Failed to generate MFA QR code.' });
      res.json({ success: true, secret: secret.base32, qrCodeUrl: dataUrl });
    });
  } catch (err) {
    console.error('MFA Setup Error:', err);
    res.status(500).json({ error: 'Failed to initialize MFA setup.' });
  }
});

// 2. Verify and Enable MFA Token
app.post('/api/mfa/verify', authenticateToken, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'MFA token is required.' });

  try {
    let userSecret = '';
    if (pool) {
      const userQuery = await pool.query('SELECT mfa_secret FROM users WHERE email = $1', [req.user.email]);
      if (userQuery.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
      userSecret = userQuery.rows[0].mfa_secret;
    }

    const verified = speakeasy.totp.verify({
      secret: userSecret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (!verified) return res.status(400).json({ error: 'Invalid MFA token.' });

    if (pool) {
      await pool.query('UPDATE users SET mfa_enabled = true WHERE email = $1', [req.user.email]);
    }

    res.json({ success: true, message: 'MFA successfully enabled.' });
  } catch (err) {
    console.error('MFA Verification Error:', err);
    res.status(500).json({ error: 'Failed to verify MFA token.' });
  }
});
