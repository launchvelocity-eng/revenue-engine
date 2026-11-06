import express from 'express';

const router = express.Router();

router.post('/execute', async (req, res, next) => {
    try {
        const { client_event, payload } = req.body;

        // Basic payload validation
        if (!client_event || !payload || !payload.asset_id) {
            return res.status(400).json({ error: 'Invalid payload structure' });
        }

        res.status(200).json({ status: 'received', asset_id: payload.asset_id });
    } catch (err) {
        next(err);
    }
});

export default router;
