// Vault Gatekeeper Key Manager (Browser Side Only)
const GatekeeperAuth = {
  STORAGE_KEY: 'lv_vault_gatekeeper_key',

  init() {
    this.modal = document.getElementById('gatekeeperModal');
    this.keyInput = document.getElementById('gatekeeperKeyInput');
    this.statusMsg = document.getElementById('authStatusMessage');

    const saveBtn = document.getElementById('saveGatekeeperKeyBtn');
    const clearBtn = document.getElementById('clearGatekeeperKeyBtn');

    if (saveBtn) saveBtn.addEventListener('click', () => this.saveKey());
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearKey());

    const savedKey = localStorage.getItem(this.STORAGE_KEY);
    if (savedKey && this.keyInput) {
      this.keyInput.value = savedKey;
    }
  },

  getKey() {
    return localStorage.getItem(this.STORAGE_KEY) || '';
  },

  openModal() {
    if (this.modal) this.modal.classList.remove('hidden');
  },

  closeModal() {
    if (this.modal) this.modal.classList.add('hidden');
  },

  saveKey() {
    const keyVal = this.keyInput ? this.keyInput.value.trim() : '';
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
    if (this.keyInput) this.keyInput.value = '';
    this.showStatus('Key cleared from session.', '#e3b341');
  },

  showStatus(msg, color) {
    if (this.statusMsg) {
      this.statusMsg.style.color = color;
      this.statusMsg.textContent = msg;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => GatekeeperAuth.init());
