// --- LAUNCH VELOCITY ENTERPRISE SECURITY FIREWALL ---

// 1. In-Memory Rate Limiting Tracker (IP-based)
const requestTracker = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;  // Max 30 requests per minute per IP

function enforceRateLimit(req) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    if (!requestTracker.has(clientIp)) {
        requestTracker.set(clientIp, { count: 1, startTime: now });
        return true;
    }

    const tracker = requestTracker.get(clientIp);
    if (now - tracker.startTime > RATE_LIMIT_WINDOW) {
        tracker.count = 1;
        tracker.startTime = now;
        return true;
    }

    tracker.count++;
    return tracker.count <= MAX_REQUESTS_PER_WINDOW;
}

// 2. Advanced Magic Byte / Buffer Threat Inspection
// Detects executable file signatures even if the extension was renamed
function inspectBinaryThreats(buffer) {
    if (!buffer || buffer.length < 4) return null;

    // Common dangerous magic bytes (MZ header for PE/EXE, ELF for linux binaries, etc.)
    const headerHex = buffer.subarray(0, 4).toString('hex').toUpperCase();
    
    // MZ Header (Windows PE executables .exe, .dll, .scr)
    if (headerHex.startsWith('4D5A')) return 'Prohibited PE Executable Signature (MZ Header)';
    
    // ELF Header (Linux executables/scripts)
    if (headerHex.startsWith('7F454C46')) return 'Prohibited ELF Binary Signature';
    
    // Java Archive / ZIP container check if disguised
    if (headerHex.startsWith('504B0304') && buffer.toString('utf8', 0, 100).includes('.class')) {
        return 'Prohibited Compiled Java Archive payload';
    }

    return null; // Clean
}
