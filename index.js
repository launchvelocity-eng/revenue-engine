import express from 'express';
import cors from 'cors';
import router from './index.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mount the API router
app.use('/api', router);

// Health check route for Render
app.get('/', (req, res) => {
    res.status(200).json({ status: 'Revenue-Engine API is running successfully' });
});

// Start server on Render's assigned port or fallback to 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
