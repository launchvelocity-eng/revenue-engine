import express from 'express';
import cors from 'cors';

const app = express(); // <-- Initialize app first

app.use(cors());       // <-- Then apply middleware
app.use(express.json());

// Rest of your routes and server setup...
