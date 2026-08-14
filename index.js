// 1. Imports at the top
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();

// 2. Middleware & Routes in the middle
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// ... your database init, routes, and logic here ...

// 3. app.listen() goes ONLY at the very bottom
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
