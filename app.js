/**
 * Step 2: Inline Threat & Payload Inspection Middleware
 * Validates payload byte sizes and restricts dangerous executable extensions
 * prior to commiting files or enterprise metadata to storage partitions.
 */
export function inspectPayloadSecurity(req, res, next) {
  const maxPayloadBytes = 500 * 1024 * 1024; // 500 MB max threshold limit
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  // 1. Verify byte threshold
  if (contentLength > maxPayloadBytes) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      success: false, 
      error: 'SECURITY_VIOLATION: Payload exceeds max safe inspection threshold (500MB).' 
    }));
  }

  // 2. Scan file extension headers for restricted executable scripts/binaries
  const blockedExtensions = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.scr', '.dll', '.so'];
  const fileNameHeader = (req.headers['x-file-name'] || '').toString().toLowerCase();
  
  const isBlocked = blockedExtensions.some(ext => fileNameHeader.endsWith(ext));

  if (isBlocked) {
    console.warn(`[THREAT DETECTED] Blocked upload attempt for restricted file: ${fileNameHeader}`);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      success: false, 
      error: 'SECURITY_ALERT: File type restricted by zero-trust vault policy.' 
    }));
  }

  // Proceed to next execution block if payload passes inspection
  if (typeof next === 'function') {
    next();
  }
}
