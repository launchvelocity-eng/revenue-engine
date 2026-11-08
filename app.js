import express from 'express';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

const app = express();
const PORT = process.env.PORT || 10000;

// ==========================================
// 1. ZERO-TRUST STREAM TRANSFORM MODULES
// ==========================================

class MaxLengthLimiter extends Transform {
  constructor(maxBytes) {
    super();
    this.maxBytes = maxBytes;
    this.bytesRead = 0;
  }
  _transform(chunk, encoding, callback) {
    this.bytesRead += chunk.length;
    if (this.bytesRead > this.maxBytes) {
      return callback(new Error('PAYLOAD_TOO_LARGE'));
    }
    this.push(chunk);
    callback();
  }
  _destroy(err, callback) {
    this.bytesRead = 0;
    this.removeAllListeners();
    callback(err);
  }
}

class ZeroTrustMagicByteShield extends Transform {
  constructor() {
    super();
    this.headBuffer = Buffer.alloc(0);
    this.checked = false;
  }
  _transform(chunk, encoding, callback) {
    if (!this.checked) {
      this.headBuffer = Buffer.concat([this.headBuffer, chunk]);
      
      // Look at the first 4 bytes to check signatures
      if (this.headBuffer.length >= 4) {
        const magicHex = this.headBuffer.toString('hex', 0, 4).toUpperCase();
        
        // Match against 4D5A (MZ / Windows Executable) and 7F454C46 (ELF / Linux Executable)
        if (magicHex.startsWith('4D5A') || magicHex === '7F454C46') {
          return callback(new Error('MALICIOUS_BINARY_DETECTED'));
        }
        this.checked = true;
      }
    }
    this.push(chunk);
    callback();
  }
  _destroy(err, callback) {
    this.headBuffer = null;
    this.removeAllListeners();
    callback(err);
  }
}

// Mock function for your air-gapped targets (Replace with your actual storage writer)
const getAirGappedStorageStream = () => {
  // e.g., return fs.createWriteStream('/tmp/vault_chunk');
  const { Writable } = require('stream');
  return new Writable({ write(chunk, enc, cb) { cb(); } });
};

// ==========================================
// 2. THE SECURE INGESTION ROUTE (/api/vault/upload)
// ==========================================
app.post('/api/vault/upload', async (req, res) => {
  const MAX_500MB = 500 * 1024 * 1024;
  
  if (req.destroyed) {
    return res.status(400).json({ error: 'Connection aborted by client.' });
  }

  const limiter = new MaxLengthLimiter(MAX_500MB);
  const shield = new ZeroTrustMagicByteShield();
  const secureDestination = getAirGappedStorageStream();

  try {
    // Sequential execution: network chunk -> limit check -> threat shield -> storage write
    await pipeline(
      req,
      limiter,
      shield,
      secureDestination
    );

    return res.status(201).json({ 
      status: 'success', 
      message: 'Payload cleared threat inspection and vaulted securely.',
      bytesProcessed: limiter.bytesRead
    });

  } catch (err) {
    // Defensive cleanup of file handles if a pipe failure aborts mid-stream
    if (secureDestination && typeof secureDestination.destroy === 'function') {
      try { secureDestination.destroy(); } catch (_) {}
    }

    // Handle distinct threat vectors with unique security alerts
    if (err.message === 'MALICIOUS_BINARY_DETECTED') {
      console.warn(`[SECURITY ALERT] Blocked prohibited binary upload attempt.`);
      return res.status(400).json({ 
        error: 'Security Policy Violation', 
        details: 'Executable binaries (.exe / ELF) are strictly prohibited from entering the vault.' 
      });
    }

    if (err.message === 'PAYLOAD_TOO_LARGE') {
      res.setHeader('Connection', 'close'); // Kill the TCP socket completely to preserve network bandwidth
      return res.status(413).json({ 
        error: 'Quota Exceeded', 
        details: 'Payload exceeds the maximum 500MB inline ingestion ceiling.' 
      });
    }

    console.error('Ingestion pipeline systemic failure:', err);
    return res.status(500).json({ error: 'Internal pipeline storage exception.' });
  }
});

// App listener configured correctly
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
