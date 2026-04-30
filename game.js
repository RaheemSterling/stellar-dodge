const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const shieldEl = document.querySelector("#shield");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");

const keys = new Set();
const state = {
  mode: "ready",
  time: 0,
  score: 0,
  best: Number(localStorage.getItem("stellar-dodge-best") || 0),
  spawnTimer: 0,
  pickupTimer: 4,
  entities: [],
  particles: [],
  stars: [],
  player: {
    x: 480,
    y: 310,
    r: 14,
    speed: 340,
    shield: 0
  },
  pointer: null,
  last: performance.now()
};

bestEl.textContent = state.best;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  seedStars(rect.width, rect.height);
}

function seedStars(width, height) {
  state.stars = Array.from({ length: 120 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    z: 0.35 + Math.random() * 1.2
  }));
}

function startGame() {
  state.mode = "running";
  state.time = 0;
  state.score = 0;
  state.spawnTimer = 0;
  state.pickupTimer = 3.5;
  state.entities = [];
  state.particles = [];
  const rect = canvas.getBoundingClientRect();
  state.player.x = rect.width * 0.5;
  state.player.y = rect.height * 0.62;
  state.player.shield = 1;
  overlay.classList.add("is-hidden");
  updateHud();
}

function togglePause() {
  if (state.mode === "running") {
    state.mode = "paused";
    showOverlay("Paused", "Press Space or tap to continue.");
  } else if (state.mode === "paused") {
    state.mode = "running";
    overlay.classList.add("is-hidden");
  } else {
    startGame();
  }
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("is-hidden");
}

function loop(now) {
  const dt = Math.min(0.033, (now - state.last) / 1000);
  state.last = now;

  if (state.mode === "running") update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  const rect = canvas.getBoundingClientRect();
  state.time += dt;
  state.score += dt * 14;
  updatePlayer(dt, rect);
  spawnObjects(dt, rect);
  updateEntities(dt, rect);
  updateParticles(dt);
  updateHud();
}

function updatePlayer(dt, rect) {
  const p = state.player;
  let dx = 0;
  let dy = 0;

  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;
  if (keys.has("arrowup") || keys.has("w")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s")) dy += 1;

  if (state.pointer) {
    const tx = state.pointer.x - p.x;
    const ty = state.pointer.y - p.y;
    const dist = Math.hypot(tx, ty) || 1;
    dx += tx / dist;
    dy += ty / dist;
  }

  const mag = Math.hypot(dx, dy) || 1;
  p.x += (dx / mag) * p.speed * dt;
  p.y += (dy / mag) * p.speed * dt;
  p.x = clamp(p.x, p.r + 4, rect.width - p.r - 4);
  p.y = clamp(p.y, p.r + 4, rect.height - p.r - 4);
}

function spawnObjects(dt, rect) {
  const difficulty = 1 + state.time / 42;
  state.spawnTimer -= dt;
  state.pickupTimer -= dt;

  if (state.spawnTimer <= 0) {
    state.spawnTimer = Math.max(0.28, 0.9 / difficulty);
    const r = 12 + Math.random() * 24;
    state.entities.push({
      type: "debris",
      x: Math.random() * rect.width,
      y: -r - 20,
      r,
      vx: (Math.random() - 0.5) * 70 * difficulty,
      vy: 105 * difficulty + Math.random() * 120,
      spin: (Math.random() - 0.5) * 4,
      angle: Math.random() * Math.PI * 2
    });
  }

  if (state.pickupTimer <= 0) {
    state.pickupTimer = 6 + Math.random() * 4;
    state.entities.push({
      type: Math.random() > 0.72 ? "shield" : "core",
      x: 40 + Math.random() * (rect.width - 80),
      y: -24,
      r: 12,
      vx: (Math.random() - 0.5) * 55,
      vy: 88 + Math.random() * 80,
      angle: 0,
      spin: 2
    });
  }
}

function updateEntities(dt, rect) {
  const p = state.player;

  for (const e of state.entities) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.angle += e.spin * dt;

    if (distance(p, e) < p.r + e.r) {
      if (e.type === "debris") {
        if (p.shield > 0) {
          p.shield -= 1;
          burst(e.x, e.y, "#51d6a4", 18);
          e.dead = true;
        } else {
          endGame();
        }
      } else {
        if (e.type === "shield") p.shield = Math.min(3, p.shield + 1);
        if (e.type === "core") state.score += 120;
        burst(e.x, e.y, e.type === "shield" ? "#51d6a4" : "#f0bf54", 20);
        e.dead = true;
      }
    }

    if (e.y > rect.height + 70 || e.x < -90 || e.x > rect.width + 90) e.dead = true;
  }

  state.entities = state.entities.filter((e) => !e.dead);
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function endGame() {
  state.mode = "over";
  const rounded = Math.floor(state.score);
  if (rounded > state.best) {
    state.best = rounded;
    localStorage.setItem("stellar-dodge-best", String(rounded));
  }
  updateHud();
  showOverlay("Game Over", "Press Space or tap to restart.");
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 190;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.45,
      color
    });
  }
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawBackground(rect);
  state.entities.forEach(drawEntity);
  state.particles.forEach(drawParticle);
  drawPlayer(state.player);
}

function drawBackground(rect) {
  ctx.fillStyle = "#07101c";
  ctx.fillRect(0, 0, rect.width, rect.height);
  for (const star of state.stars) {
    star.y += star.z * (state.mode === "running" ? 0.6 : 0.15);
    if (star.y > rect.height) {
      star.y = 0;
      star.x = Math.random() * rect.width;
    }
    ctx.fillStyle = `rgba(244, 247, 251, ${0.18 + star.z * 0.28})`;
    ctx.fillRect(star.x, star.y, star.z * 1.8, star.z * 1.8);
  }
}

function drawPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = "#f4f7fb";
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(14, 16);
  ctx.lineTo(0, 9);
  ctx.lineTo(-14, 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#51d6a4";
  ctx.fillRect(-4, 2, 8, 9);
  if (p.shield > 0) {
    ctx.strokeStyle = "rgba(81, 214, 164, 0.75)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEntity(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);

  if (e.type === "debris") {
    ctx.fillStyle = "#7d8798";
    ctx.strokeStyle = "#c3cad6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 7; i += 1) {
      const angle = (Math.PI * 2 * i) / 7;
      const radius = e.r * (0.72 + (i % 2) * 0.32);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = e.type === "shield" ? "#51d6a4" : "#f0bf54";
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
    ctx.beginPath();
    ctx.arc(-4, -5, e.r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawParticle(particle) {
  ctx.globalAlpha = Math.max(0, particle.life / 0.8);
  ctx.fillStyle = particle.color;
  ctx.fillRect(particle.x, particle.y, 3, 3);
  ctx.globalAlpha = 1;
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score);
  bestEl.textContent = state.best;
  shieldEl.textContent = state.player.shield;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.addEventListener("resize", resizeCanvas);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === " ") {
    event.preventDefault();
    togglePause();
  }
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("pointerdown", (event) => {
  if (state.mode !== "running") {
    togglePause();
    return;
  }
  state.pointer = pointerPosition(event);
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (state.mode === "running" && state.pointer) state.pointer = pointerPosition(event);
});

canvas.addEventListener("pointerup", () => {
  state.pointer = null;
});

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

resizeCanvas();
requestAnimationFrame(loop);
