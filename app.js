// =========================================================================
// ADVANCED ENTERPRISE ROUTING CORE FOR LAUNCH VELOCITY
// =========================================================================
const BACKEND_URL = "https://onrender.com";

// Centralized log stream router
function writeLog(text, mode = 'info') {
  const screen = document.getElementById('terminal-screen') || document.getElementById('console-output');
  if (!screen) return;
  const time = new Date().toLocaleTimeString();
  let statusColor = 'text-zinc-400';
  
  if (mode === 'ok') statusColor = 'text-green-400 font-bold';
  if (mode === 'alert') statusColor = 'text-red-400 font-bold';
  if (mode === 'network') statusColor = 'text-yellow-500 font-light';

  screen.innerHTML += `<div class="block"><span class="text-zinc-700">[${time}]</span> <span class="${statusColor}">&gt; ${text}</span></div>`;
  screen.scrollTop = screen.scrollHeight;
}

// 1. ADVANCED STREAM INGESTION ACTION
async function streamPayload(type) {
  writeLog(`Preparing structural payload transmission for: [${type.toUpperCase()}]`, 'info');
  
  let mockBody = "";
  if (type === 'clean') mockBody = "%PDF-1.4\n%LAUNCH_VELOCITY_SECURE_VAULT_STREAM_CLEAR_BLOCK";
  if (type === 'exe') mockBody = "MZ\x90\x00\x03\x00\x00\x00Prohibited_Windows_Executable_Injected";
  if (type === 'elf') mockBody = "\x7FELFProhibited_Linux_Compiled_Binary_Injected";

  try {
    writeLog(`Opening direct stream socket connection to Render gateway node...`, 'network');
    
    // Simulating progress tracking animations visually on the dropzone progress bar
    const progressBar = document.querySelector('.bg-green-500');
    if (progressBar) progressBar.style.width = '50%';

    const res = await fetch(`${BACKEND_URL}/api/vault/upload`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/octet-stream',
        'X-Vault-Gatekeeper-Key': 'vk_live_998124719284719284' // Grounded from onboarding UI
      },
      body: mockBody
    });

    const data = await res.json();
    if (progressBar) progressBar.style.width = '100%';

    if (res.status === 201) {
      writeLog(`INLINE INGESTION COMPLETE: Status ${res.status}. Bytes Vaulted: ${data.bytesProcessed}`, 'ok');
    } else {
      writeLog(`FIREWALL POLICY REJECTION: Status ${res.status} [${data.error}]. ${data.details || 'Blocked.'}`, 'alert');
    }
  } catch (err) {
    writeLog(`PIPELINE EXCEPTION: Transport link timeout -> ${err.message}`, 'alert');
  }
}

// 2. LIVE DECLUTTER ASSISTANT TRIGGER SWEEP
async function triggerDeclutter() {
  writeLog('Requesting system file audit sweep optimization sequence...', 'network');
  try {
    const res = await fetch(`${BACKEND_URL}/api/vault/declutter`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      writeLog(`DECLUTTER TASK SUCCESS: Partition cleanup finished. Status: ${data.message}`, 'ok');
    } else {
      writeLog(`DECLUTTER BLOCKED: API Gateway refused operational request.`, 'alert');
    }
  } catch (err) {
    writeLog(`DECLUTTER COMPILER EXCEPTION: Target node connection error -> ${err.message}`, 'alert');
  }
}

// 3. ENTERPRISE TENANT PROVISIONING SIMULATOR
async function provisionTenantLease(event) {
  if (event) event.preventDefault();
  
  const tenantId = document.getElementById('tenant-id-input')?.value || 'globex-corporation-prod';
  writeLog(`Initiating cryptographic provisioning layout parameters for tenant [${tenantId}]...`, 'network');
  
  try {
    // Calling the automated background lease sweep internally to mock/seed initial transaction entries
    const res = await fetch(`${BACKEND_URL}/api/admin/lease-sweep`, { method: 'POST' });
    if (res.ok) {
      writeLog(`PROVISIONING REPLICATED: Relational tenant schemas mapped and locked under $2,500/mo retainer.`, 'ok');
    } else {
      writeLog(`PROVISIONING ERROR: Gateway rejected transaction sequence mapping.`, 'alert');
    }
  } catch (err) {
    writeLog(`PROVISIONING EXCEPTION: Core database thread connection refused -> ${err.message}`, 'alert');
  }
}
