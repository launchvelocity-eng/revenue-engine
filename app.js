    // Live Cyber Data Stream & HUD Canvas Engine
    const canvas = document.getElementById('cyberMatrixCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let width = canvas.width = window.innerWidth;
      let height = canvas.height = window.innerHeight;

      window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      });

      const chars = '01101001010101010101010100101010101';
      const fontSize = 14;
      const columns = Math.floor(width / fontSize);
      const drops = Array(columns).fill(1);

      function drawMatrix() {
        // Semi-transparent fade effect for streaming code
        ctx.fillStyle = 'rgba(2, 6, 23, 0.1)';
        ctx.fillRect(0, 0, width, height);

        // HUD Perspective Grid Lines
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.08)';
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < width; x += gridSize) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        // Cyan Matrix Rain Stream
        ctx.fillStyle = '#06b6d4';
        ctx.font = fontSize + 'px monospace';

        for (let i = 0; i < drops.length; i++) {
          const text = chars.charAt(Math.floor(Math.random() * chars.length));
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);

          if (drops[i] * fontSize > height && Math.random() > 0.975) {
            drops[i] = 0;
          }
          drops[i]++;
        }
      }
      setInterval(drawMatrix, 33);
    }
