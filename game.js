const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const livesValue = document.getElementById("livesValue");
const statusText = document.getElementById("statusText");
const startBtn = document.getElementById("startBtn");
const shareBtn = document.getElementById("shareBtn");

const VERSION = "v1.7.0";
const W = canvas.width;
const H = canvas.height;
const PLAY_TOP = 170;
const FLOOR_Y = 468;
const PLAY_LEFT = 18;
const PLAY_RIGHT = W - 18;

const img = {
  bg: loadImage("assets/squadmania.jpeg"),
  player: loadImage("assets/player.jpg"),
  monad: loadImage("assets/monad.jpg"),
  blue: loadImage("assets/blue-bird.png"),
  yellow: loadImage("assets/yellow-bird.png"),
  tenk: loadImage("assets/tenk-stamp.png"),
};

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

const state = {
  running: false,
  gameOver: false,
  score: 0,
  best: Number(localStorage.getItem("tenKRushBest") || 0),
  lives: 3,
  speed: 3.0,
  spawnTimer: 0,
  spawnEvery: 44,
  keys: new Set(),
  items: [],
  bullets: [],
  particles: [],
  fireTimer: 0,
  shotCooldown: 0,
};

const player = {
  x: W / 2,
  y: FLOOR_Y - 60,
  w: 54,
  h: 54,
  speed: 7.5,
  targetX: W / 2,
  targetY: FLOOR_Y - 60,
};

const collectables = [
  { kind: "monad", points: 1, image: "monad", weight: 45, size: 46 },
  { kind: "blue", points: 2, image: "blue", weight: 28, size: 54 },
  { kind: "yellow", points: 3, image: "yellow", weight: 16, size: 54 },
  { kind: "bomb", points: 0, image: null, weight: 13, size: 46, bad: true },
];

function pickType() {
  const total = collectables.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of collectables) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return collectables[0];
}

function resetGame() {
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.lives = 3;
  state.speed = 3.0;
  state.spawnTimer = 0;
  state.spawnEvery = 44;
  state.items = [];
  state.bullets = [];
  state.particles = [];
  state.fireTimer = 0;
  state.shotCooldown = 0;
  player.x = W / 2;
  player.y = FLOOR_Y - 60;
  player.targetX = player.x;
  player.targetY = player.y;
  statusText.textContent = `Run started. Move freely. Space shoots. Monad = fire mode. (${VERSION})`;
  updateUI();
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem("tenKRushBest", String(state.best));
  }
  statusText.textContent = `Game over. Score: ${state.score}. Best: ${state.best}. (${VERSION})`;
  updateUI();
}

function updateUI() {
  scoreValue.textContent = state.score;
  bestValue.textContent = state.best;
  livesValue.textContent = state.lives;
}

function spawnItem() {
  const type = pickType();
  const margin = 80;
  state.items.push({
    ...type,
    x: margin + Math.random() * (W - margin * 2),
    y: PLAY_TOP - 75,
    r: type.size / 2,
    vy: state.speed + Math.random() * 1.8,
    drift: (Math.random() - 0.5) * 0.9,
    spin: Math.random() * Math.PI * 2,
    dead: false,
  });
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H,
  };
}

function rectCircleCollide(rect, circle) {
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

function circleCircleCollide(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
}

function collect(item, byShot = false) {
  item.dead = true;

  if (item.bad) {
    if (byShot) {
      state.score += 1;
      burst(item.x, item.y, "#ff4b5c", 28);
      statusText.textContent = `Bomb destroyed. +1. (${VERSION})`;
    } else {
      state.lives -= 1;
      burst(item.x, item.y, "#ff4b5c", 26);
      statusText.textContent = `Bomb hit. Lives: ${state.lives}. (${VERSION})`;
      if (state.lives <= 0) endGame();
    }
  } else {
    state.score += item.points;
    const color = item.kind === "yellow" ? "#ffd166" : item.kind === "monad" ? "#8e6cff" : "#ff7adf";
    burst(item.x, item.y, color, 18);

    if (item.kind === "monad") {
      state.fireTimer = 420; // about 7 seconds at 60 FPS
      statusText.textContent = `Monad power! Fire shots activated. (${VERSION})`;
    } else {
      statusText.textContent = `+${item.points} collected. Score: ${state.score}. (${VERSION})`;
    }
  }

  updateUI();
}

function shoot() {
  if (!state.running || state.shotCooldown > 0) return;

  const fire = state.fireTimer > 0;
  state.bullets.push({
    x: player.x,
    y: player.y - player.h / 2,
    r: fire ? 12 : 7,
    vy: fire ? -12.5 : -10,
    fire,
    dead: false,
  });

  state.shotCooldown = fire ? 8 : 12;
  if (fire) burst(player.x, player.y - 42, "#ff8a2a", 7);
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 24 + Math.random() * 22,
      color,
    });
  }
}

function update() {
  if (!state.running) {
    updateParticles();
    return;
  }

  if (state.shotCooldown > 0) state.shotCooldown--;
  if (state.fireTimer > 0) state.fireTimer--;

  let dx = 0;
  let dy = 0;

  if (state.keys.has("ArrowLeft") || state.keys.has("a") || state.keys.has("A")) dx -= 1;
  if (state.keys.has("ArrowRight") || state.keys.has("d") || state.keys.has("D")) dx += 1;
  if (state.keys.has("ArrowUp") || state.keys.has("w") || state.keys.has("W")) dy -= 1;
  if (state.keys.has("ArrowDown") || state.keys.has("s") || state.keys.has("S")) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy) || 1;
    player.x += (dx / len) * player.speed;
    player.y += (dy / len) * player.speed;
    player.targetX = player.x;
    player.targetY = player.y;
  } else {
    player.x += (player.targetX - player.x) * 0.18;
    player.y += (player.targetY - player.y) * 0.18;
  }

  player.x = Math.max(PLAY_LEFT + 30, Math.min(PLAY_RIGHT - 30, player.x));
  player.y = Math.max(PLAY_TOP + 48, Math.min(FLOOR_Y - 38, player.y));

  state.speed += 0.0017;
  state.spawnEvery = Math.max(18, 44 - state.speed * 2.3);
  state.spawnTimer++;

  if (state.spawnTimer >= state.spawnEvery) {
    state.spawnTimer = 0;
    spawnItem();
    if (Math.random() < 0.10) spawnItem();
  }

  state.bullets.forEach((bullet) => {
    bullet.y += bullet.vy;
    if (bullet.y < PLAY_TOP - 40) bullet.dead = true;
  });

  state.items.forEach((item) => {
    item.y += item.vy;
    item.x += item.drift;
    item.spin += 0.035;
  });

  const rect = {
    x: player.x - player.w / 2,
    y: player.y - player.h / 2,
    w: player.w,
    h: player.h,
  };

  state.items.forEach((item) => {
    if (!item.dead && rectCircleCollide(rect, item)) {
      collect(item, false);
    }
  });

  state.bullets.forEach((bullet) => {
    state.items.forEach((item) => {
      if (!bullet.dead && !item.dead && circleCircleCollide(bullet, item)) {
        bullet.dead = true;
        collect(item, true);
      }
    });
  });

  state.items = state.items.filter((item) => !item.dead && item.y < H + 80);
  state.bullets = state.bullets.filter((bullet) => !bullet.dead);
  updateParticles();
}

function updateParticles() {
  state.particles.forEach((p) => {
    p.life -= 1;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
  });
  state.particles = state.particles.filter((p) => p.life > 0);
}

function drawBackground() {
  const playX = 12;
  const playW = W - 24;
  const bannerY = 16;
  const bannerH = 146;
  const stageY = 170;
  const stageH = FLOOR_Y - 152;
  const floorY = FLOOR_Y - 2;
  const floorH = 74;

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#17031d");
  sky.addColorStop(0.38, "#7f2dff");
  sky.addColorStop(0.72, "#57106f");
  sky.addColorStop(1, "#190317");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Header banner
  ctx.save();
  roundedClip(playX, bannerY, playW, bannerH, 18);
  if (img.bg.complete) {
    ctx.drawImage(img.bg, playX, bannerY, playW, bannerH);
    const bannerShade = ctx.createLinearGradient(0, bannerY, 0, bannerY + bannerH);
    bannerShade.addColorStop(0, "rgba(15, 0, 25, 0.28)");
    bannerShade.addColorStop(1, "rgba(15, 0, 25, 0.40)");
    ctx.fillStyle = bannerShade;
    ctx.fillRect(playX, bannerY, playW, bannerH);
  }
  ctx.restore();

  // Main stage
  const stage = ctx.createLinearGradient(0, stageY, 0, FLOOR_Y);
  stage.addColorStop(0, "#bb85ff");
  stage.addColorStop(0.18, "#9c54ff");
  stage.addColorStop(0.50, "#6a22a8");
  stage.addColorStop(0.82, "#2b083d");
  stage.addColorStop(1, "#15021c");
  ctx.fillStyle = stage;
  roundRect(playX, stageY, playW, stageH, 22);
  ctx.fill();

  // White 10K tags
  ctx.save();
  roundRect(playX, stageY, playW, stageH, 22);
  ctx.clip();

  const tags = [
    {x: 120, y: 255, rot: -0.18, size: 56, alpha: 0.10},
    {x: 270, y: 225, rot: 0.08, size: 64, alpha: 0.09},
    {x: 440, y: 280, rot: -0.14, size: 82, alpha: 0.10},
    {x: 650, y: 230, rot: 0.12, size: 68, alpha: 0.09},
    {x: 830, y: 288, rot: -0.11, size: 60, alpha: 0.10},
    {x: 235, y: 360, rot: 0.14, size: 54, alpha: 0.09},
    {x: 575, y: 356, rot: -0.08, size: 58, alpha: 0.09},
    {x: 760, y: 370, rot: 0.10, size: 48, alpha: 0.08}
  ];

  for (const t of tags) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rot);
    ctx.globalAlpha = t.alpha;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 3;
    ctx.font = `900 italic ${t.size}px Arial Black, Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("10K", 0, 0);
    ctx.fillText("10K", 0, 0);
    ctx.restore();
  }

  // Motion streaks
  ctx.strokeStyle = "rgba(255, 122, 223, 0.10)";
  ctx.lineWidth = 2;
  for (let x = 145; x < W; x += 165) {
    ctx.beginPath();
    ctx.moveTo(x, 178);
    ctx.lineTo(x - 82, FLOOR_Y - 24);
    ctx.stroke();
  }

  // Clean separator and inner shadow between field and floor
  const seamShadow = ctx.createLinearGradient(0, FLOOR_Y - 22, 0, FLOOR_Y + 8);
  seamShadow.addColorStop(0, "rgba(0,0,0,0)");
  seamShadow.addColorStop(1, "rgba(0,0,0,0.30)");
  ctx.fillStyle = seamShadow;
  ctx.fillRect(playX + 2, FLOOR_Y - 22, playW - 4, 30);

  ctx.fillStyle = "rgba(255, 232, 247, 0.28)";
  roundRect(playX + 10, FLOOR_Y - 6, playW - 20, 4, 4);
  ctx.fill();

  // Floor body
  const floor = ctx.createLinearGradient(0, floorY, 0, floorY + floorH);
  floor.addColorStop(0, "#ff87ea");
  floor.addColorStop(0.10, "#ff5ede");
  floor.addColorStop(0.32, "#f633ca");
  floor.addColorStop(0.70, "#a61db4");
  floor.addColorStop(1, "#4a0d58");
  ctx.fillStyle = floor;
  roundRect(playX, floorY, playW, floorH, 18);
  ctx.fill();

  // Gloss strip
  const gloss = ctx.createLinearGradient(0, floorY, 0, floorY + 18);
  gloss.addColorStop(0, "rgba(255,255,255,0.48)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  roundRect(playX + 10, floorY + 6, playW - 20, 14, 10);
  ctx.fill();

  // Bottom depth shading
  const depth = ctx.createLinearGradient(0, floorY + 24, 0, floorY + floorH);
  depth.addColorStop(0, "rgba(0,0,0,0)");
  depth.addColorStop(1, "rgba(28, 0, 37, 0.42)");
  ctx.fillStyle = depth;
  roundRect(playX + 2, floorY + 12, playW - 4, floorH - 14, 14);
  ctx.fill();

  ctx.restore();

  if (state.fireTimer > 0) {
    ctx.fillStyle = "rgba(255, 120, 30, 0.12)";
    roundRect(playX, stageY, playW, stageH, 22);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath();
  ctx.ellipse(0, 34, 36, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = state.fireTimer > 0 ? "rgba(255, 124, 26, 0.9)" : "rgba(255, 79, 216, 0.45)";
  ctx.shadowBlur = state.fireTimer > 0 ? 34 : 24;

  ctx.save();
  roundedClip(-player.w / 2, -player.h / 2, player.w, player.h, 20);
  if (img.player.complete) {
    ctx.drawImage(img.player, -player.w / 2, -player.h / 2, player.w, player.h);
  } else {
    ctx.fillStyle = "#ff5ebc";
    ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);
  }
  ctx.restore();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = state.fireTimer > 0 ? "#ff8a2a" : "#ff7adf";
  ctx.lineWidth = 4;
  roundRect(-player.w / 2, -player.h / 2, player.w, player.h, 20);
  ctx.stroke();

  if (state.fireTimer > 0) {
    ctx.fillStyle = "#ff8a2a";
    ctx.font = "900 13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FIRE", 0, -38);
  }

  ctx.restore();
}

function drawItem(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.spin);

  if (item.bad) {
    drawBomb(item.r);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, item.r, 0, Math.PI * 2);
    ctx.clip();
    const image = img[item.image];
    if (image && image.complete) {
      ctx.drawImage(image, -item.r, -item.r, item.r * 2, item.r * 2);
    } else {
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(-item.r, -item.r, item.r * 2, item.r * 2);
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(255,170,240,0.95)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, item.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBomb(r) {
  ctx.fillStyle = "#15141d";
  ctx.beginPath();
  ctx.arc(0, 4, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ff4b5c";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(6, -r + 4);
  ctx.quadraticCurveTo(18, -r - 12, 29, -r - 3);
  ctx.stroke();

  ctx.fillStyle = "#ff4b5c";
  ctx.font = "900 13px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BOMB", 0, 6);
}

function drawBullets() {
  state.bullets.forEach((bullet) => {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    if (bullet.fire) {
      const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, bullet.r + 9);
      grad.addColorStop(0, "#fff3a0");
      grad.addColorStop(0.35, "#ff8a2a");
      grad.addColorStop(1, "rgba(255,40,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, bullet.r + 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffdd55";
      ctx.beginPath();
      ctx.arc(0, 0, bullet.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#ff7adf";
      ctx.beginPath();
      ctx.arc(0, 0, bullet.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawParticles() {
  state.particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 32));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawOverlay() {
  if (state.running) return;

  ctx.save();
  ctx.fillStyle = "rgba(17, 0, 25, 0.58)";
  roundRect(230, 200, 500, 176, 24);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,122,223,0.32)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 italic 48px Arial Black, Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("10K", W / 2, 248);

  ctx.fillStyle = "#fff0fb";
  ctx.font = "800 16px Inter, sans-serif";
  const msg = state.gameOver
    ? `Game over · Score ${state.score} · Best ${state.best}`
    : "Move with WASD / arrows. Space shoots. Monad gives fire.";
  ctx.fillText(msg, W / 2, 303);

  ctx.fillStyle = "#f0b6e9";
  ctx.font = "700 14px Inter, sans-serif";
  ctx.fillText("Press Start / Restart or tap the canvas", W / 2, 332);
  ctx.restore();
}

function roundedClip(x, y, w, h, r) {
  roundRect(x, y, w, h, r);
  ctx.clip();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw() {
  drawBackground();
  state.items.forEach(drawItem);
  drawBullets();
  drawPlayer();
  drawParticles();
  drawOverlay();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (state.running) shoot();
    return;
  }

  state.keys.add(event.key);

  if ((event.key === "Enter") && !state.running) resetGame();
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.key);
});

canvas.addEventListener("pointerdown", (event) => {
  const p = pointerPosition(event);
  player.targetX = p.x;
  player.targetY = p.y;
  if (!state.running) resetGame();
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.running) return;
  const p = pointerPosition(event);
  player.targetX = p.x;
  player.targetY = p.y;
});

startBtn.addEventListener("click", resetGame);

shareBtn.addEventListener("click", () => {
  const text = encodeURIComponent(`I scored ${state.score} in 10K Rush Shooter Edition. Can you beat me?`);
  const url = encodeURIComponent(window.location.href);
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer");
});

updateUI();
statusText.textContent = `10K Rush ready. WASD/arrows move. Space shoots. (${VERSION})`;
loop();
