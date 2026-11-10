import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

app.post('/api/vault/upload', (req, res) => {
  const gatekeeperKey = req.headers['x-vault-gatekeeper-key'];
  const expectedKey = process.env.VAULT_GATEKEEPER_KEY;

  if (!gatekeeperKey || gatekeeperKey !== expectedKey) {
    return res.status(401).json({ error: 'UNAUTHORIZED_GATEKEEPER_KEY' });
  }

  const buffer = req.body;
  if (buffer && buffer.length >= 2) {
    const header = buffer.toString('utf8', 0, 2);
    if (header === 'MZ' || header === '\x7fE') {
      return res.status(400).json({
        error: 'MALICIOUS_PAYLOAD_DETECTED',
        details: 'Magic-byte inspection rejected prohibited binary header.'
      });
    }
  }

  return res.status(200).json({ status: 'SUCCESS', message: 'Payload verified and ingested.' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
