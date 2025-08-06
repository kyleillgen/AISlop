export function startGame({
  canvas,
  playerColor = 'blue',
  enemyColor = 'red',
  playerSpeed = 5,
  enemySpeed = 2
}) {
  const ctx = canvas.getContext('2d');
  const player = { x: canvas.width / 2, y: canvas.height / 2 };
  const enemy = { x: 20, y: 20 };
  const keys = {};

  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
    keys[e.key] = true;
  });

  window.addEventListener('keyup', e => {
    keys[e.key] = false;
  });

  function update() {
    if (keys.ArrowUp) player.y -= playerSpeed;
    if (keys.ArrowDown) player.y += playerSpeed;
    if (keys.ArrowLeft) player.x -= playerSpeed;
    if (keys.ArrowRight) player.x += playerSpeed;

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      enemy.x += (enemySpeed * dx) / len;
      enemy.y += (enemySpeed * dy) / len;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = playerColor;
    ctx.fillRect(player.x - 10, player.y - 10, 20, 20);
    ctx.fillStyle = enemyColor;
    ctx.fillRect(enemy.x - 10, enemy.y - 10, 20, 20);
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  loop();

  return { player, enemy };
}
