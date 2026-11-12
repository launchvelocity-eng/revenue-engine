async function uploadToVault(fileBuffer, gatekeeperKey) {
  const response = await fetch(`${API_BASE_URL}/api/vault/upload`, {
    method: 'POST',
    headers: {
      'X-Vault-Gatekeeper-Key': gatekeeperKey,
      'Content-Type': 'application/octet-stream'
    },
    body: fileBuffer
  });

  const result = await response.json();
  if (!response.ok) {
    console.error('[SECURITY SHIELD]', result.message);
    alert(`Upload Blocked: ${result.message}`);
    return false;
  }

  console.log('[VAULT SUCCESS]', result.message);
  return true;
}
