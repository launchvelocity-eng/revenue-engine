if (err.message.startsWith('THREAT_DETECTED_')) {
    res.setHeader('Connection', 'close');
    return res.status(400).json({ 
        error: 'Zero-Trust Firewall Blocked Payload: Prohibited binary signature detected.' 
    });
}
