curl -X POST https://revenue-engine-dc8d.onrender.com/api/vault/upload \
  -H "Content-Type: application/octet-stream" \
  --data-binary "MZ99ThisIsASimulatedMaliciousBinaryPayload"
