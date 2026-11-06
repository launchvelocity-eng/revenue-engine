import express from 'express';
import cors from 'cors';
import router from './index.js'; // Assuming your router file is named index.js

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mount the router
app.use('/api', router);

// Health check route
app.get('/', (req, res) => {
    res.status(200).json({ status: 'Revenue-Engine API is running' });
});

// Start server on Render's assigned port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
