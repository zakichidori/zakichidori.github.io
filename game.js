const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  score: document.getElementById("score"),
  bestScore: document.getElementById("bestScore"),
  lives: document.getElementById("lives"),
  energy: document.getElementById("energy"),
  control: document.getElementById("control"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  startBtn: document.getElementById("startBtn")
};

const W = canvas.width;
const H = canvas.height;
const keys = {};

let gameState = "menu";
let paused = false;
let lastTs = 0;
let time = 0;
let bestScore = Number(localStorage.getItem("zaki-chidori-best") || 0);
const playerName = (window.prompt("Name lightning buddy 1 (you):", "raiden") || "raiden").trim() || "raiden";

const player = {
  x: W * 0.5,
  y: H * 0.55,
  r: 16,
  speed: 280,
  lives: 5,
  score: 0,
  energy: 100,
  invuln: 0,
  burstCd: 0
};

const lightningBuddy = {
  name: "zakichidori",
  x: W * 0.5 + 80,
  y: H * 0.55,
  targetX: W * 0.5 + 80,
  targetY: H * 0.55,
  speed: 180,
  blastCd: 0,
  pulse: 0
};

const enemies = [];
const orbs = [];
const particles = [];

function showOverlay(title, text, button = "Start Run") {
  ui.overlayTitle.textContent = title;
  ui.overlayText.textContent = text;
  ui.startBtn.textContent = button;
  ui.overlay.classList.add("visible");
}

function hideOverlay() {
  ui.overlay.classList.remove("visible");
}

function updateUI() {
  ui.score.textContent = Math.floor(player.score);
  ui.bestScore.textContent = bestScore;
  ui.lives.textContent = player.lives;
  ui.energy.textContent = Math.floor(player.energy);
  ui.control.textContent = player.burstCd > 0 ? "Cooldown" : "Charged";
}

function resetGame() {
  player.x = W * 0.5;
  player.y = H * 0.55;
  player.lives = 5;
  player.score = 0;
  player.energy = 100;
  player.invuln = 0;
  player.burstCd = 0;
  lightningBuddy.x = player.x + 80;
  lightningBuddy.y = player.y;
  lightningBuddy.targetX = player.x + 80;
  lightningBuddy.targetY = player.y;
  lightningBuddy.blastCd = 0.4;
  lightningBuddy.pulse = 0;
  enemies.length = 0;
  orbs.length = 0;
  particles.length = 0;
  time = 0;

  for (let i = 0; i < 4; i += 1) spawnEnemy();
  for (let i = 0; i < 6; i += 1) spawnOrb();
  updateUI();
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  if (side === 0) {
    x = -20;
    y = Math.random() * H;
  } else if (side === 1) {
    x = W + 20;
    y = Math.random() * H;
  } else if (side === 2) {
    x = Math.random() * W;
    y = -20;
  } else {
    x = Math.random() * W;
    y = H + 20;
  }
  enemies.push({
    x,
    y,
    r: 13 + Math.random() * 5,
    speed: 80 + Math.random() * 45,
    hp: 2
  });
}

function spawnOrb() {
  orbs.push({
    x: 80 + Math.random() * (W - 160),
    y: 80 + Math.random() * (H - 160),
    r: 8
  });
}

function emit(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() * 2 - 1) * 180,
      vy: (Math.random() * 2 - 1) * 180,
      life: 0.25 + Math.random() * 0.4,
      size: 1 + Math.random() * 3,
      color
    });
  }
}

function burst() {
  if (player.energy < 25 || player.burstCd > 0) return;
  player.energy -= 25;
  player.burstCd = 0.6;
  emit(player.x, player.y, 50, "#8fefff");

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const e = enemies[i];
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 110) {
      player.score += 35;
      emit(e.x, e.y, 20, "#78d6ff");
      enemies.splice(i, 1);
    }
  }
}

function hurtPlayer() {
  if (player.invuln > 0) return;
  player.lives -= 1;
  player.invuln = 1;
  emit(player.x, player.y, 30, "#7fc9ff");
  if (player.lives <= 0) {
    gameOver();
  }
}

function gameOver() {
  gameState = "over";
  if (player.score > bestScore) {
    bestScore = Math.floor(player.score);
    localStorage.setItem("zaki-chidori-best", bestScore.toString());
  }
  showOverlay(
    "Storm Run Ended",
    `Score: ${Math.floor(player.score)}. Press Enter to jump back into the lightning arena.`,
    "Restart"
  );
}

function update(dt) {
  if (gameState !== "playing" || paused) return;

  time += dt;
  player.score += dt * 8;
  player.energy = Math.min(100, player.energy + dt * 14);
  player.invuln = Math.max(0, player.invuln - dt);
  player.burstCd = Math.max(0, player.burstCd - dt);
  lightningBuddy.blastCd = Math.max(0, lightningBuddy.blastCd - dt);
  lightningBuddy.pulse = Math.max(0, lightningBuddy.pulse - dt);

  const moveX = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const moveY = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  const mag = Math.hypot(moveX, moveY) || 1;

  player.x += (moveX / mag) * player.speed * dt;
  player.y += (moveY / mag) * player.speed * dt;
  player.x = Math.max(player.r, Math.min(W - player.r, player.x));
  player.y = Math.max(player.r, Math.min(H - player.r, player.y));

  const nearestEnemy = enemies.reduce((nearest, enemy) => {
    if (!nearest) return enemy;
    const nDist = Math.hypot(nearest.x - player.x, nearest.y - player.y);
    const eDist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    return eDist < nDist ? enemy : nearest;
  }, null);

  if (nearestEnemy) {
    lightningBuddy.targetX = nearestEnemy.x + Math.sin(time * 8) * 26;
    lightningBuddy.targetY = nearestEnemy.y + Math.cos(time * 8) * 26;
  } else {
    lightningBuddy.targetX = player.x + Math.cos(time * 3) * 70;
    lightningBuddy.targetY = player.y + Math.sin(time * 3) * 70;
  }
  const bdx = lightningBuddy.targetX - lightningBuddy.x;
  const bdy = lightningBuddy.targetY - lightningBuddy.y;
  const bdist = Math.hypot(bdx, bdy) || 1;
  lightningBuddy.x += (bdx / bdist) * lightningBuddy.speed * dt;
  lightningBuddy.y += (bdy / bdist) * lightningBuddy.speed * dt;
  lightningBuddy.x = Math.max(16, Math.min(W - 16, lightningBuddy.x));
  lightningBuddy.y = Math.max(16, Math.min(H - 16, lightningBuddy.y));

  if (Math.random() < dt * 0.9 && enemies.length < 12) spawnEnemy();
  if (Math.random() < dt * 0.8 && orbs.length < 10) spawnOrb();

  for (const e of enemies) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.x += (dx / dist) * e.speed * dt;
    e.y += (dy / dist) * e.speed * dt;

    if (dist < e.r + player.r - 2) {
      hurtPlayer();
    }
  }

  if (lightningBuddy.blastCd === 0) {
    let blasted = false;
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const e = enemies[i];
      const dx = e.x - lightningBuddy.x;
      const dy = e.y - lightningBuddy.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 95) {
        blasted = true;
        player.score += 20;
        emit(e.x, e.y, 16, "#90e9ff");
        enemies.splice(i, 1);
      }
    }
    if (blasted) {
      lightningBuddy.blastCd = 1.6;
      lightningBuddy.pulse = 0.18;
      emit(lightningBuddy.x, lightningBuddy.y, 28, "#a4f7ff");
    }
  }

  for (let i = orbs.length - 1; i >= 0; i -= 1) {
    const o = orbs[i];
    const dx = o.x - player.x;
    const dy = o.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < o.r + player.r) {
      player.score += 20;
      player.energy = Math.min(100, player.energy + 10);
      emit(o.x, o.y, 12, "#94f5ff");
      orbs.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.life <= 0) particles.splice(i, 1);
  }

  updateUI();
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#030a18");
  g.addColorStop(0.45, "#082d62");
  g.addColorStop(1, "#020713");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 80; i += 1) {
    const x = ((i * 130 + time * 45) % (W + 70)) - 35;
    const y = (i * 43) % H;
    ctx.fillStyle = "rgba(125, 210, 255, 0.2)";
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawArena() {
  ctx.strokeStyle = "rgba(92, 192, 255, 0.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  for (let i = 0; i < 8; i += 1) {
    const y = 50 + i * 58;
    ctx.fillStyle = "rgba(120, 220, 255, 0.06)";
    ctx.fillRect(28, y, W - 56, 2);
  }
}

function drawWatermarks() {
  const marks = [
    [88, 42],
    [W - 160, 52],
    [120, H - 30],
    [W - 190, H - 28],
    [W * 0.24, H * 0.2],
    [W * 0.7, H * 0.22],
    [W * 0.32, H * 0.84],
    [W * 0.68, H * 0.8]
  ];
  ctx.font = '13px "Press Start 2P", monospace';
  ctx.fillStyle = "rgba(130, 220, 255, 0.22)";
  for (const [x, y] of marks) ctx.fillText("ZAKI CHIDORI", x, y);
}

function drawPlayer() {
  if (player.invuln > 0 && Math.floor(time * 20) % 2 === 0) return;

  // Chidori aura tail.
  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = `rgba(135, 232, 255, ${0.3 - i * 0.045})`;
    ctx.lineWidth = 4 - i * 0.6;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x - 22 - i * 10, player.y + Math.sin(time * 12 + i) * 10);
    ctx.stroke();
  }

  ctx.fillStyle = "#274ea8";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#9befff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r * 0.52, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '10px "Press Start 2P", monospace';
  ctx.fillStyle = "rgba(210, 245, 255, 0.95)";
  ctx.textAlign = "center";
  ctx.fillText(playerName, player.x, player.y - 24);
}

function drawLightningBuddy() {
  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  for (let i = 0; i < 4; i += 1) {
    ctx.strokeStyle = `rgba(140, 235, 255, ${0.28 - i * 0.05})`;
    ctx.lineWidth = 3 - i * 0.45;
    ctx.beginPath();
    ctx.moveTo(lightningBuddy.x, lightningBuddy.y);
    ctx.lineTo(
      lightningBuddy.x - 12 - i * 7,
      lightningBuddy.y + Math.sin(time * 11 + i) * (7 + i * 2)
    );
    ctx.stroke();
  }

  if (lightningBuddy.pulse > 0) {
    ctx.strokeStyle = "rgba(168, 248, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lightningBuddy.x, lightningBuddy.y, 20 + lightningBuddy.pulse * 130, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#61b3ff";
  ctx.beginPath();
  ctx.arc(lightningBuddy.x, lightningBuddy.y, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b4f7ff";
  ctx.beginPath();
  ctx.arc(lightningBuddy.x, lightningBuddy.y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(210, 245, 255, 0.95)";
  ctx.fillText(lightningBuddy.name, lightningBuddy.x, lightningBuddy.y - 16);
}

function draw() {
  drawBackground();
  drawArena();

  for (const o of orbs) {
    ctx.strokeStyle = "rgba(147, 248, 255, 0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const e of enemies) {
    ctx.fillStyle = "rgba(80, 176, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(173, 238, 255, 0.65)";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlayer();
  drawLightningBuddy();

  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }

  drawWatermarks();

  // Right-side shout-out outside gameplay center.
  ctx.font = '18px "Press Start 2P", monospace';
  ctx.fillStyle = "rgba(152, 235, 255, 0.96)";
  ctx.textAlign = "right";
  ctx.fillText("raseem ❤️", W - 16, H * 0.5);
  ctx.fillText("haythm ❤️", W - 16, H * 0.56);
  ctx.fillText("imran ❤️", W - 16, H * 0.62);
  ctx.fillText("mud arc ❤️", W - 16, H * 0.68);
  ctx.fillText("sahid ❤️", W - 16, H * 0.74);
  ctx.fillText("bailout ❤️", W - 16, H * 0.8);
  ctx.fillText("mo ❤️", W - 16, H * 0.86);
  ctx.fillText("safwan ❤️", W - 16, H * 0.92);
  ctx.fillText("weezy ❤️", W - 16, H * 0.44);
  ctx.fillText("abx ❤️", W - 16, H * 0.38);

  if (paused && gameState === "playing") {
    ctx.fillStyle = "rgba(2, 8, 20, 0.72)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#d4f1ff";
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", W * 0.5, H * 0.5);
  }
}

function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000 || 0, 0.033);
  lastTs = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function startGame() {
  resetGame();
  gameState = "playing";
  paused = false;
  hideOverlay();
}

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }

  if (e.code === "Space" && gameState === "playing" && !paused) burst();
  if (e.code === "KeyP" && gameState === "playing") paused = !paused;
  if (e.code === "Enter" && (gameState === "menu" || gameState === "over")) startGame();
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

ui.startBtn.addEventListener("click", () => {
  if (gameState === "menu" || gameState === "over") startGame();
});

updateUI();
showOverlay(
  "Zaki Chidori Run",
  "Stable mode: move with WASD or arrows, collect chakra orbs, avoid storm drones, and press Space for Chidori Burst."
);

requestAnimationFrame(loop);
