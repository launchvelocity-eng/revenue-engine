curl -X POST https://revenue-engine-dc8d.onrender.com/api/vault/upload \
  -H "Content-Type: application/octet-stream" \
  -H "X-Vault-Gatekeeper-Key: YOUR_VAULT_GATEKEEPER_KEY" \
  --data-binary "MZ\x90\x00\x03\x00\x00\x00Malicious Windows Executable Intrusion Packet"
