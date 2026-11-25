      } catch (err) {
        console.error('Settlement error:', err);
        btn.textContent = `Error: ${err.message}`;
        btn.style.background = '#e11d48';
      }
