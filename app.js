// Security Middleware: Inline Threat & Payload Inspection
function inspectPayloadSecurity(req, res, next) {
  const maxPayloadBytes = 500 * 1024 * 1024; // 500 MB per chunk limit
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  if (contentLength > maxPayloadBytes) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      success: false, 
      error: 'SECURITY_VIOLATION: Payload exceeds max safe inspection threshold (500MB).' 
    }));
  }

  // Block dangerous executable extensions in file upload metadata
  const blockedExtensions = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.scr', '.dll', '.so'];
  const fileNameHeader = req.headers['x-file-name'] || '';
  const isBlocked = blockedExtensions.some(ext => fileNameHeader.toLowerCase().endsWith(ext));

  if (isBlocked) {
    console.warn(`[THREAT DETECTED] Blocked upload attempt with extension: ${fileNameHeader}`);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      success: false, 
      error: 'SECURITY_ALERT: File type restricted by zero-trust vault policy.' 
    }));
  }

  next();
}
