import cors from 'cors';

app.use(cors({
  origin: ['https://github.io', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Vault-Gatekeeper-Key']
}));
