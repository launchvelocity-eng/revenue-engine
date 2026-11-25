const bgLockGraphic = document.getElementById('bgLockGraphic');

document.querySelectorAll('.lock-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lock-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (bgLockGraphic) {
      bgLockGraphic.src = btn.dataset.img;
    }
    document.body.style.backgroundImage =
      `linear-gradient(180deg, rgba(6, 11, 20, 0.78), rgba(6, 11, 20, 0.9)), url('${btn.dataset.img}')`;
  });
});
