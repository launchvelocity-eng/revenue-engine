// Vault Gatekeeper Key Manager
const GatekeeperAuth = {
  STORAGE_KEY: 'lv_vault_gatekeeper_key',

  init() {
    this.modal = document.getElementById('gatekeeperModal');
    this.keyInput = document.getElementById('gatekeeperKeyInput');
    this.statusMsg = document.getElementById('authStatusMessage');

    document.getElementById('saveGatekeeperKeyBtn').addEventListener('click', () => this.saveKey());
    document.getElementById('clearGatekeeperKeyBtn').addEventListener('click', () => this.clearKey());

    // Pre-fill key if stored locally
    const savedKey = localStorage.getItem(this.STORAGE_KEY);
    if (savedKey) {
      this.keyInput.value = savedKey;
    }
  },

  getKey() {
    return localStorage.getItem(this.STORAGE_KEY) || '';
  },

  openModal() {
    this.modal.classList.remove('hidden');
  },

  closeModal() {
    this.modal.classList.add('hidden');
  },

  saveKey() {
    const keyVal = this.keyInput.value.trim();
    if (!keyVal) {
      this.showStatus('Please enter a valid key.', '#f85149');
      return;
    }

    localStorage.setItem(this.STORAGE_KEY, keyVal);
    this.showStatus('Gatekeeper Key Authorized & Saved.', '#3fb950');
    setTimeout(() => this.closeModal(), 1000);
  },

  clearKey() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.keyInput.value = '';
    this.showStatus('Key cleared from session.', '#e3b341');
  },

  showStatus(msg, color) {
    this.statusMsg.style.color = color;
    this.statusMsg.textContent = msg;
  }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => GatekeeperAuth.init());

// Authenticated Upload Helper
async function uploadVaultFile(fileBuffer, mimeType = 'application/octet-stream') {
  const gatekeeperKey = GatekeeperAuth.getKey();
  
  if (!gatekeeperKey) {
    GatekeeperAuth.openModal();
    throw new Error('Authentication required: Gatekeeper Key missing.');
  }

  const response = await fetch('https://revenue-engine-dc8d.onrender.com/api/vault/upload', {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      'X-Vault-Gatekeeper-Key': gatekeeperKey
    },
    body: fileBuffer
  });

  return response;
}
