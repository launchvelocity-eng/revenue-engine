<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Revenue Engine Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen flex flex-col items-center justify-center p-4">

    <div class="w-full max-w-md bg-gray-800 rounded-lg shadow-xl p-6 space-y-6">
        <h1 class="text-2xl font-bold text-center text-indigo-400">Revenue Engine Portal</h1>

        <!-- Step 1: Authentication / Login -->
        <div class="space-y-4">
            <h2 class="text-lg font-semibold border-b border-gray-700 pb-2">1. Authenticate</h2>
            <div>
                <label class="block text-sm font-medium text-gray-400">Email Address</label>
                <input type="email" id="emailInput" class="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="you@example.com">
            </div>
            <button onclick="loginUser()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium p-2 rounded transition">Set Session Token</button>
        </div>

        <!-- Step 2: MFA Setup & Verification -->
        <div class="space-y-4 pt-4 border-t border-gray-700">
            <h2 class="text-lg font-semibold border-b border-gray-700 pb-2">2. Security & MFA</h2>
            <button onclick="setupMFA()" class="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium p-2 rounded transition">Generate MFA Secret & QR</button>
            <div id="qrContainer" class="flex flex-col items-center space-y-2 hidden">
                <img id="qrCodeImg" class="w-32 h-32 bg-white p-1 rounded" alt="MFA QR Code">
                <p id="secretText" class="text-xs text-gray-400 font-mono"></p>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-400">6-Digit TOTP Code</label>
                <input type="text" id="mfaTokenInput" class="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="123456">
            </div>
            <button onclick="verifyMFA()" class="w-full bg-green-600 hover:bg-green-700 text-white font-medium p-2 rounded transition">Verify & Enable MFA</button>
        </div>

        <!-- Step 3: Secure Asset Vault -->
        <div class="space-y-4 pt-4 border-t border-gray-700">
            <h2 class="text-lg font-semibold border-b border-gray-700 pb-2">3. Secure Vault</h2>
            <div>
                <label class="block text-sm font-medium text-gray-400">Secret Data / Payload</label>
                <input type="text" id="vaultInput" class="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Confidential project note...">
            </div>
            <button onclick="storeAsset()" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium p-2 rounded transition">Store in Vault (Requires Subscription)</button>
        </div>

        <p id="statusMsg" class="text-sm text-center text-indigo-300 h-6"></p>
    </div>

    <script>
        const API_URL = 'https://revenue-engine-dc8d.onrender.com'; // Your live Render URL

        function getAuthHeader() {
            const email = document.getElementById('emailInput').value.trim();
            return email ? { 'Authorization': `Bearer ${email}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
        }

        function showStatus(msg, isError = false) {
            const el = document.getElementById('statusMsg');
            el.textContent = msg;
            el.className = `text-sm text-center h-6 ${isError ? 'text-red-400' : 'text-green-400'}`;
        }

        function loginUser() {
            const email = document.getElementById('emailInput').value.trim();
            if (!email) return showStatus('Please enter a valid email.', true);
            showStatus(`Session token set for ${email}`);
        }

        async function setupMFA() {
            try {
                const res = await fetch(`${API_URL}/api/mfa/setup`, {
                    method: 'POST',
                    headers: getAuthHeader()
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to setup MFA');
                
                document.getElementById('qrCodeImg').src = data.qrCodeUrl;
                document.getElementById('secretText').textContent = `Secret: ${data.secret}`;
                document.getElementById('qrContainer').classList.remove('hidden');
                showStatus('MFA initialized successfully.');
            } catch (err) {
                showStatus(err.message, true);
            }
        }

        async function verifyMFA() {
            const token = document.getElementById('mfaTokenInput').value.trim();
            if (!token) return showStatus('Enter your 6-digit TOTP code.', true);

            try {
                const res = await fetch(`${API_URL}/api/mfa/verify`, {
                    method: 'POST',
                    headers: getAuthHeader(),
                    body: JSON.stringify({ token })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Verification failed');
                showStatus(data.message);
            } catch (err) {
                showStatus(err.message, true);
            }
        }

        async function storeAsset() {
            const payload = document.getElementById('vaultInput').value.trim();
            if (!payload) return showStatus('Payload cannot be empty.', true);

            try {
                const res = await fetch(`${API_URL}/api/secure-store`, {
                    method: 'POST',
                    headers: getAuthHeader(),
                    body: JSON.stringify({ encryptedPayload: { data: payload } })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to store asset');
                showStatus(data.message);
            } catch (err) {
                showStatus(err.message, true);
            }
        }
    </script>
</body>
</html>
