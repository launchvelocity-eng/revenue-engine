// Middleware to enforce specific access tiers
export const requireTier = (...allowedTiers) => {
    return (req, res, next) => {
        if (!req.user || !req.user.tier) {
            return res.status(401).json({ error: 'Unauthorized access. Session context missing.' });
        }

        const userTier = req.user.tier.toLowerCase();
        
        // Check if user's tier is included in the allowed list
        if (!allowedTiers.map(t => t.toLowerCase()).includes(userTier)) {
            return res.status(403).json({ 
                error: 'Forbidden. Your current tier does not grant access to this resource.',
                requiredTier: allowedTiers,
                currentTier: userTier
            });
        }

        next();
    };
};
