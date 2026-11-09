import cors from 'cors';

// Configure strict CORS for frontend origin
app.use(cors({
  origin: [
    'https://launchvelocity-eng.github.io',
    'http://localhost:3000' // For local frontend development
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Vault-Gatekeeper-Key']
}));
