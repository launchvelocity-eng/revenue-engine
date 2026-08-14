// Encrypt text client-side using Web Crypto API (AES-GCM)
async function encryptClientSide(plainText, secretPassphrase) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(secretPassphrase.padEnd(32, '0').slice(0, 32)), // Ensure 256-bit key
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const key = await window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );

    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        enc.encode(plainText)
    );

    // Bundle salt, iv, and ciphertext together for storage transmission
    return {
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: btoa(String.fromCharCode(...iv)),
        salt: btoa(String.fromCharCode(...salt))
    };
}

// Example usage when submitting data to your authenticated secure-store route
async function submitSecureData(userToken, secretPassphrase, rawData) {
    const encryptedPayload = await encryptClientSide(rawData, secretPassphrase);

    const response = await fetch('https://revenue-engine-dc8d.onrender.com/api/secure-store', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ zeroKnowledgePayload: encryptedPayload })
    });

    return await response.json();
}
