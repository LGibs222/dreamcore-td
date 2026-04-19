// Dreamcore TD — M4: towers shoot, enemies take damage and die.

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
  prismCore: '#b8f4ff',
  prismEdge: '#6ad1ff',
  prismGlow: '#a8c8ff',
  hint:      'rgba(184, 244, 255, 0.35)',
};

const MIN_TOWER_SPACING = 48;   // px — don't let towers stack on top of each other
const MIN_PATH_DISTANCE = 34;   // px — can't place directly on the path
const CENTER_KEEPOUT    = 80;   // px — can't cover the Forgotten Star

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
  const maxHp = 30;
  enemies.push({
    progress: 0,
    speed: 0.00011 + Math.random() * 0.00005, // progress per ms
    radius: 7 + Math.random() * 3,
    hp: maxHp,
    maxHp,
  });
}

function enemyPos(e) { return pathPoint(e.progress); }

function updateEnemies(dt) {
  spawnTimer += dt;
  while (spawnTimer >= SPAWN_INTERVAL_MS) {
    spawnTimer -= SPAWN_INTERVAL_MS;
    spawnEnemy();
  }
  for (const e of enemies) e.progress += e.speed * dt;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp <= 0) {
      const p = enemyPos(e);
      spawnDeathBurst(p.x, p.y);
      enemies.splice(i, 1);
    } else if (e.progress >= 1) {
      enemies.splice(i, 1);
    }
  }
}

function drawEnemies() {
  for (const e of enemies) {
    const p = pathPoint(e.progress);
    drawGlow(p.x, p.y, e.radius * 3, COLORS.enemyMid,  0.35);
    drawGlow(p.x, p.y, e.radius,     COLORS.enemyCore, 1.00);
    // thin HP bar above the shard, only when damaged
    if (e.hp < e.maxHp) {
      const w = 24, h = 3;
      const bx = p.x - w / 2, by = p.y - e.radius * 2.2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, w, h);
      ctx.fillStyle = '#b8f4ff';
      ctx.fillRect(bx, by, w * (e.hp / e.maxHp), h);
    }
  }
}

// Towers — Crystal Prisms (tower #1 from the roster)
const towers = [];
const TOWER_STATS = {
  range: 160,
  fireIntervalMs: 700,
  damage: 10,
};
const PROJECTILE_SPEED = 0.55; // px per ms
const projectiles = [];
const particles = [];

function findTarget(tower) {
  // pick the enemy furthest along the path (closest to the star) that's in range
  let best = null;
  let bestProgress = -1;
  for (const e of enemies) {
    const p = enemyPos(e);
    const d = Math.hypot(p.x - tower.x, p.y - tower.y);
    if (d <= TOWER_STATS.range && e.progress > bestProgress) {
      best = e;
      bestProgress = e.progress;
    }
  }
  return best;
}

function updateTowers(dt) {
  for (const tw of towers) {
    tw.fireCooldown = Math.max(0, (tw.fireCooldown || 0) - dt);
    if (tw.fireCooldown > 0) continue;
    const target = findTarget(tw);
    if (!target) continue;
    const p = enemyPos(target);
    const dx = p.x - tw.x, dy = p.y - tw.y;
    const len = Math.hypot(dx, dy) || 1;
    projectiles.push({
      x: tw.x, y: tw.y,
      vx: (dx / len) * PROJECTILE_SPEED,
      vy: (dy / len) * PROJECTILE_SPEED,
      damage: TOWER_STATS.damage,
      target, // homing — we re-aim toward this enemy each frame
    });
    tw.fireCooldown = TOWER_STATS.fireIntervalMs;
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    // mild homing so projectiles don't miss curving enemies
    if (pr.target && pr.target.hp > 0 && enemies.includes(pr.target)) {
      const tp = enemyPos(pr.target);
      const dx = tp.x - pr.x, dy = tp.y - pr.y;
      const len = Math.hypot(dx, dy) || 1;
      const want_vx = (dx / len) * PROJECTILE_SPEED;
      const want_vy = (dy / len) * PROJECTILE_SPEED;
      // blend toward desired direction (soft homing)
      pr.vx = pr.vx * 0.85 + want_vx * 0.15;
      pr.vy = pr.vy * 0.85 + want_vy * 0.15;
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    // hit detection — any enemy within its radius
    let hit = false;
    for (const e of enemies) {
      const p = enemyPos(e);
      if (Math.hypot(pr.x - p.x, pr.y - p.y) < e.radius + 4) {
        e.hp -= pr.damage;
        hit = true;
        break;
      }
    }
    // off-screen or hit → remove
    if (hit ||
        pr.x < -20 || pr.x > canvas.width + 20 ||
        pr.y < -20 || pr.y > canvas.height + 20) {
      projectiles.splice(i, 1);
    }
  }
}

function drawProjectiles() {
  for (const pr of projectiles) {
    drawGlow(pr.x, pr.y, 10, COLORS.prismCore, 0.7);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function spawnDeathBurst(x, y) {
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.08 + Math.random() * 0.12;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 500,
      maxLife: 500,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    drawGlow(p.x, p.y, 6, COLORS.enemyCore, 0.9);
  }
  ctx.globalAlpha = 1;
}

function drawCrystalPrism(x, y, t, pulse = 1) {
  const size = 18 * pulse;
  // soft aura
  drawGlow(x, y, size * 2.6, COLORS.prismGlow, 0.25);
  // diamond body — 4 points, rotating slowly for a living feel
  const rot = t * 0.0004;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const grad = ctx.createLinearGradient(0, -size, 0, size);
  grad.addColorStop(0, COLORS.prismCore);
  grad.addColorStop(1, COLORS.prismEdge);
  ctx.fillStyle = grad;
  ctx.strokeStyle = COLORS.prismCore;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.65, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.65, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // inner highlight
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = COLORS.prismCore;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.5);
  ctx.lineTo(size * 0.25, 0);
  ctx.lineTo(0, size * 0.5);
  ctx.lineTo(-size * 0.25, 0);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawTowers(t) {
  for (const tw of towers) {
    // faint range circle, only briefly visible after placement or when idle
    drawCrystalPrism(tw.x, tw.y, t);
  }
}

function drawTowerRanges() {
  // show range ring for the tower nearest the cursor (helps placement intuition)
  if (!mouseInside || towers.length === 0) return;
  let nearest = towers[0];
  let bestD = Math.hypot(mouseX - nearest.x, mouseY - nearest.y);
  for (const tw of towers) {
    const d = Math.hypot(mouseX - tw.x, mouseY - tw.y);
    if (d < bestD) { bestD = d; nearest = tw; }
  }
  if (bestD > 40) return; // only when hovering close to a tower
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = COLORS.prismGlow;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.arc(nearest.x, nearest.y, TOWER_STATS.range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Placement validation — returns null if OK, else a human-readable reason
function placementError(x, y) {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  if (Math.hypot(x - cx, y - cy) < CENTER_KEEPOUT) return 'too close to the star';
  for (const tw of towers) {
    if (Math.hypot(x - tw.x, y - tw.y) < MIN_TOWER_SPACING) return 'too close to another tower';
  }
  // sample the path and reject if close to any sample
  for (let i = 0; i <= 60; i++) {
    const p = pathPoint(i / 60);
    if (Math.hypot(x - p.x, y - p.y) < MIN_PATH_DISTANCE) return 'on the path';
  }
  return null;
}

// Mouse tracking for the placement hint
let mouseX = -999, mouseY = -999, mouseInside = false;
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  mouseInside = true;
});
canvas.addEventListener('mouseleave', () => { mouseInside = false; });

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (placementError(x, y)) return;
  towers.push({ x, y, fireCooldown: 0 });
});

function drawPlacementHint() {
  if (!mouseInside) return;
  const err = placementError(mouseX, mouseY);
  ctx.save();
  ctx.globalAlpha = err ? 0.4 : 0.8;
  ctx.strokeStyle = err ? '#ff7aa2' : COLORS.hint;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
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
  updateTowers(dt);
  updateProjectiles(dt);
  updateParticles(dt);

  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawTowers(t);
  drawTowerRanges();
  drawPlacementHint();

  // Center star — the thing enemies are trying to reach
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const pulse = 26 + Math.sin(t * 0.002) * 4;
  drawOrb(cx, cy, pulse);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
