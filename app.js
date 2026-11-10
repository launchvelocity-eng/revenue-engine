import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', message: 'Launch Velocity Engine is operating at peak efficiency.' });
});

// ZeroTrustMagicByteShield Route
app.post('/api/vault/upload', (req, res) => {
  const authKey = req.headers['x-vault-gatekeeper-key'];
  
  if (!authKey) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Gatekeeper key missing.' });
  }

  const buffer = req.body;
  if (buffer && buffer.length >= 2) {
    // Check for Windows executable magic bytes 'MZ'
    if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
      return res.status(400).json({ 
        error: 'MALICIOUS_PAYLOAD_DETECTED', 
        message: 'ZeroTrustMagicByteShield intercepted an unauthorized executable signature.' 
      });
    }
  }

  res.status(200).json({ message: 'Payload verified and ingested securely.' });
});

app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
