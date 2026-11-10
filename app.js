import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 10000;

// Enable CORS for cross-origin requests from GitHub Pages
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Raw binary parser for stream byte-level threat inspection up to 50MB
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

// Zero-Trust Gatekeeper & Threat Shield Middleware
app.post('/api/vault/upload', (req, res) => {
  const gatekeeperKey = req.headers['x-vault-gatekeeper-key'];
  const expectedKey = process.env.VAULT_GATEKEEPER_KEY;

  if (!gatekeeperKey || gatekeeperKey !== expectedKey) {
    return res.status(401).json({ error: 'UNAUTHORIZED_GATEKEEPER_KEY' });
  }

  // Magic Byte Stream Inspection (Blocking MZ and ELF Headers)
  const buffer = req.body;
  if (buffer && buffer.length >= 2) {
    const header = buffer.toString('utf8', 0, 2);
    
