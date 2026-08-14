import crypto from 'crypto';

// Encryption configuration (use an environment variable for production secret keys)
const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET_KEY || crypto.randomBytes(32); // Must be 32 bytes
const IV_LENGTH = 16; // For AES decryption

// Encrypt function for user assets
function encryptData(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decrypt function for authorized retrieval
function decryptData(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Secure Asset Upload Endpoint
app.post('/api/secure-store', async (req, res) => {
  const { email, dataPayload, tierName } = req.body;
  if (!email || !dataPayload) {
    return res.status(400).json({ error: 'Email and data payload are required.' });
  }

  try {
    // Encrypt the sensitive payload before saving
    const encryptedPayload = encryptData(dataPayload);

    // Store securely in database
    if (pool) {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS user_assets (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          tier_name VARCHAR(50) NOT NULL,
          encrypted_data TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO user_assets (email, tier_name, encrypted_data) VALUES ($1, $2, $3);`,
        [email, tierName || 'Standard', encryptedPayload]
      );
    }

    res.json({ success: true, message: 'Data encrypted and stored securely under tiered protocols.' });
  } catch (err) {
    console.error('Security Storage Error:', err);
    res.status(500).json({ error: 'Failed to process secure storage.' });
  }
});
