import http from 'http';
import { pipeline } from 'stream/promises';
import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 1. Explicitly create the server instance first
const server = http.createServer(async (req, res) => {
    // Your routing and stream handlers go here...
});

// 2. Bind and listen using the correctly defined 'server' variable
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER ENGINE] Launch Velocity running and listening on port ${PORT}`);
});
