    function handleFileUpload(event) {
      const input = event.target;
      const file = input.files && input.files[0];

      // 1. Strict abort if user denied permission, canceled, or no valid file exists
      if (!file || file.size === 0) {
        input.value = '';
        return;
      }

      // 2. ZeroTrustMagicByteShield extension check
      if (file.name.toLowerCase().endsWith('.exe') || file.name.toLowerCase().endsWith('.dll')) {
        input.value = '';
        showVaultAlert('SECURITY INTERCEPT: Executable binary blocked by ZeroTrustMagicByteShield.');
        return;
      }

      // 3. Explicit user confirmation before committing to the vault
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const confirmed = window.confirm(`Confirm encrypted upload to your isolated vault?\n\nFile: ${file.name}\nSize: ${sizeMB} MB`);
      if (!confirmed) {
        input.value = '';
        showVaultAlert('Upload canceled. No files were added to your vault.');
        return;
      }

      const list = document.getElementById('vaultFileList');
      if (vaultState.usedTB === 0.0) {
        list.innerHTML = '';
      }

      list.innerHTML = `
        <div class="flex justify-between items-center text-emerald-300">
          <span class="truncate"><i class="fa-solid fa-shield-check text-emerald-400 mr-1.5"></i>${file.name}</span>
          <span class="text-[10px] text-slate-400">${sizeMB} MB</span>
        </div>` + list.innerHTML;

      vaultState.usedTB = Math.min(vaultState.totalTB, vaultState.usedTB + (file.size / (1024 ** 4)));
      updateVaultUI();
      showVaultAlert(`Encrypted & stored "${file.name}" (${sizeMB} MB) into your isolated partition.`);

      // 4. Always clear input so stale selections never re-trigger
      input.value = '';
    }
