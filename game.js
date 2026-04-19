// Dreamcore TD — M2: enemies follow a dreamcore spiral toward the center star
// The orb from M1 is now the "Forgotten Star" — the thing enemies are marching toward.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const COLORS = {
  bgDeep:    '#0a0a1f',
  bgGlow:    '#1a1040',
  orbCore:   '#ffd6f5',
  orbMid:    '#c9a6ff',
  orbOuter:  '#6ad1ff',
  path:      'rgba(201, 166, 255, 0.5)',
  enemyCore: '#ff9ad6',
  enemyMid:  '#c2a0ff',
};

const PATH = {
  turns: 3,       // spiral loops from edge to center
  samples: 400,   // resolution for drawing the visible line
};

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const stars = [];
function makeStars() {
  stars.length = 0;
  const count = Math.floor((canvas.width * canvas.height) / 6000);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      twinkle: Math.random() * Math.PI * 2,
    });
  }
}
makeStars();
window.addEventListener('resize', makeStars);

// progress 0 = outside of spiral, progress 1 = center star
function pathPoint(progress) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const maxR = Math.min(canvas.width, canvas.height) * 0.45;
  const angle  = progress * Math.PI * 2 * PATH.turns;
  const radius = maxR * (1 - progress);
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function drawBackground() {
  const grad = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 0,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 1.2
  );
  grad.addColorStop(0, COLORS.bgGlow);
  grad.addColorStop(1, COLORS.bgDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawStars(t) {
  for (const s of stars) {
    const alpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.001 + s.twinkle));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#e8e8ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPath() {
  ctx.strokeStyle = COLORS.path;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= PATH.samples; i++) {
    const p = pathPoint(i / PATH.samples);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else         ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

function drawGlow(x, y, radius, coreColor, outerAlpha) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, coreColor);
  grad.addColorStop(1, 'rgba(10,10,31,0)');
  ctx.globalAlpha = outerAlpha;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawOrb(x, y, radius) {
  drawGlow(x, y, radius * 4.0, COLORS.orbOuter, 0.15);
  drawGlow(x, y, radius * 2.2, COLORS.orbMid,   0.35);
  drawGlow(x, y, radius * 1.0, COLORS.orbCore,  1.00);
}

// Enemies — Void Shards
const enemies = [];
let spawnTimer = 0;
const SPAWN_INTERVAL_MS = 1400;

function spawnEnemy() {
  enemies.push({
    progress: 0,
    speed: 0.00011 + Math.random() * 0.00005, // progress per ms
    radius: 7 + Math.random() * 3,
  });
}

function updateEnemies(dt) {
  spawnTimer += dt;
  while (spawnTimer >= SPAWN_INTERVAL_MS) {
    spawnTimer -= SPAWN_INTERVAL_MS;
    spawnEnemy();
  }
  for (const e of enemies) e.progress += e.speed * dt;
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].progress >= 1) enemies.splice(i, 1);
  }
}

function drawEnemies() {
  for (const e of enemies) {
    const p = pathPoint(e.progress);
    drawGlow(p.x, p.y, e.radius * 3, COLORS.enemyMid,  0.35);
    drawGlow(p.x, p.y, e.radius,     COLORS.enemyCore, 1.00);
  }
}

// Main loop with delta time — keeps motion framerate-independent
let lastT = 0;
function loop(t) {
  const dt = Math.min(t - lastT, 64); // clamp so tab-switches don't teleport enemies
  lastT = t;

  drawBackground();
  drawStars(t);
  drawPath();

  updateEnemies(dt);
  drawEnemies();

  // Center star — the thing enemies are trying to reach
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const pulse = 26 + Math.sin(t * 0.002) * 4;
  drawOrb(cx, cy, pulse);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
