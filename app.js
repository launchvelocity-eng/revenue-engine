// Enterprise Onboarding Lead Flow Controller (Client Browser Only)
const EnterpriseOnboard = {
  init() {
    const form = document.getElementById('enterpriseOnboardForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  },

  handleSubmit(e) {
    e.preventDefault();
    const company = document.getElementById('companyName').value.trim();
    const email = document.getElementById('adminEmail').value.trim();
    const tier = document.getElementById('vaultTier').value;
    const statusMsg = document.getElementById('onboardStatusMessage');

    if (!company || !email) {
      this.showStatus('All fields are required for enterprise vetting.', '#f85149', statusMsg);
      return;
    }

    // Simulate secure intake transmission
    this.showStatus('Validating corporate credentials & provisioning queue...', '#e3b341', statusMsg);
    
    setTimeout(() => {
      this.showStatus(`Enclave application received for ${company}. Our security team will reach out via ${email}.`, '#3fb950', statusMsg);
      e.target.reset();
    }, 1200);
  },

  showStatus(msg, color, element) {
    if (element) {
      element.style.color = color;
      element.textContent = msg;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => EnterpriseOnboard.init());
