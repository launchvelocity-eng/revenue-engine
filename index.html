<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Launch Velocity | Enterprise Vault Portal</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #131b2e;
      --accent: #38bdf8;
      --text: #f8fafc;
      --muted: #94a3b8;
      --border: #1e293b;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .portal-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 40px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    h1 {
      color: var(--accent);
      font-size: 24px;
      margin-top: 0;
      letter-spacing: 1px;
    }
    p {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.5;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    input {
      width: 100%;
      padding: 12px;
      background: #0b1120;
      border: 1px solid var(--border);
      border-radius: 6px;
      color: #fff;
      font-size: 14px;
      box-sizing: border-box;
    }
    input:focus {
      outline: none;
      border-color: var(--accent);
    }
    button {
      width: 100%;
      padding: 14px;
      background: var(--accent);
      color: #090d16;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 0.9;
    }
    #responseMessage {
      margin-top: 20px;
      font-size: 13px;
      text-align: center;
    }
  </style>
</head>
<body>

  <div class="portal-card">
    <h1>LAUNCH VELOCITY</h1>
    <p>Zero-Trust Enterprise Cloud Storage Partition Waitlist</p>

    <form id="waitlistForm">
      <div class="form-group">
        <label for="company">Company / Organization</label>
        <input type="text" id="company" placeholder="Acme Corporation" required>
      </div>

      <div class="form-group">
        <label for="email">Corporate Email</label>
        <input type="email" id="email" placeholder="admin@company.com" required>
      </div>

      <button type="submit" id="submitBtn">Request Vault Partition</button>
    </form>

    <div id="responseMessage"></div>
  </div>

  <script>
    const form = document.getElementById('waitlistForm');
    const msg = document.getElementById('responseMessage');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.style.color = '#94a3b8';
      msg.innerText = 'Provisioning request...';

      const payload = {
        company: document.getElementById('company').value,
        email: document.getElementById('email').value
      };

      try {
        const response = await fetch('https://revenue-engine-dc8d.onrender.com/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
          msg.style.color = '#38bdf8';
          msg.innerText = 'Request logged. Key assigned: ' + data.tenantKeyId;
          form.reset();
        } else {
          msg.style.color = '#ef4444';
          msg.innerText = 'Error: ' + (data.error || 'Failed to submit request');
        }
      } catch (err) {
        msg.style.color = '#ef4444';
        msg.innerText = 'Connection error. Please try again.';
      }
    });
  </script>

</body>
</html>
