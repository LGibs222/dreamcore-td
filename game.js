// Dreamcore TD — M6: all 6 towers at base stats.
// (Aura stacking rules = M8, Supernova visual polish = M9, upgrades = M7.)

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

function spawnEnemy(hpOverride, speedOverride) {
  const maxHp = hpOverride ?? 30;
  const baseSpeed = speedOverride ?? 0.000075;
  enemies.push({
    progress: 0,
    speed: baseSpeed + Math.random() * 0.00002,
    radius: 7 + Math.random() * 3,
    hp: maxHp,
    maxHp,
    stunTimer: 0,
  });
}

// Game state — money, lives, waves, win/lose
const GAME = {
  money: 100,
  lives: 10,
  wave: 0,              // 0 before first wave starts
  toSpawn: 0,           // enemies left to spawn in current wave
  spawnTimer: 0,
  spawnInterval: 1400,
  restTimer: 3000,      // ms until next wave starts (counts down during rest)
  status: 'rest',       // 'rest' | 'wave' | 'won' | 'lost'
  waveHp: 30,
  waveSpeed: 0.00011,
};
const KILL_REWARD = 10;
const WAVES = [
  { count: 8,  hp: 30,  speed: 0.000075, gap: 1400 },
  { count: 10, hp: 40,  speed: 0.000082, gap: 1200 },
  { count: 12, hp: 55,  speed: 0.000090, gap: 1100 },
  { count: 14, hp: 75,  speed: 0.000098, gap: 1000 },
  { count: 16, hp: 100, speed: 0.000108, gap: 900  },
  { count: 20, hp: 140, speed: 0.000120, gap: 800  },
];

function startNextWave() {
  if (GAME.wave >= WAVES.length) {
    GAME.status = 'won';
    return;
  }
  const w = WAVES[GAME.wave];
  GAME.wave += 1;
  GAME.toSpawn = w.count;
  GAME.spawnInterval = w.gap;
  GAME.spawnTimer = 0;
  GAME.waveHp = w.hp;
  GAME.waveSpeed = w.speed;
  GAME.status = 'wave';
}

function updateWaves(dt) {
  if (GAME.status === 'won' || GAME.status === 'lost') return;

  if (GAME.status === 'rest') {
    GAME.restTimer -= dt;
    if (GAME.restTimer <= 0) startNextWave();
    return;
  }

  // status === 'wave'
  GAME.spawnTimer += dt;
  while (GAME.toSpawn > 0 && GAME.spawnTimer >= GAME.spawnInterval) {
    GAME.spawnTimer -= GAME.spawnInterval;
    spawnEnemy(GAME.waveHp, GAME.waveSpeed);
    GAME.toSpawn -= 1;
  }

  // wave ends when all spawns are out AND no enemies remain
  if (GAME.toSpawn === 0 && enemies.length === 0) {
    if (GAME.wave >= WAVES.length) {
      GAME.status = 'won';
    } else {
      GAME.status = 'rest';
      GAME.restTimer = 4000;
    }
  }
}

function resetGame() {
  enemies.length = 0;
  projectiles.length = 0;
  particles.length = 0;
  blasts.length = 0;
  towers.length = 0;
  GAME.money = 100;
  GAME.lives = 10;
  GAME.wave = 0;
  GAME.toSpawn = 0;
  GAME.spawnTimer = 0;
  GAME.restTimer = 3000;
  GAME.status = 'rest';
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') { resetGame(); return; }
  const idx = parseInt(e.key, 10);
  if (idx >= 1 && idx <= TYPE_KEYS.length) selectedType = TYPE_KEYS[idx - 1];
});

function enemyPos(e) { return pathPoint(e.progress); }

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.stunTimer > 0) e.stunTimer -= dt;
    const stunned = e.stunTimer > 0;
    const mult = stunned ? 0 : slowMultiplierFor(e);
    e.progress += e.speed * mult * dt;
  }
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hp <= 0) {
      const p = enemyPos(e);
      spawnDeathBurst(p.x, p.y);
      GAME.money += KILL_REWARD;
      enemies.splice(i, 1);
    } else if (e.progress >= 1) {
      GAME.lives -= 1;
      enemies.splice(i, 1);
      if (GAME.lives <= 0) {
        GAME.lives = 0;
        GAME.status = 'lost';
      }
    }
  }
}

function drawEnemies() {
  for (const e of enemies) {
    const p = pathPoint(e.progress);
    // stun halo — bright pink ring that fades as the stun wears off
    if (e.stunTimer > 0) {
      const alpha = Math.min(1, e.stunTimer / 500);
      ctx.save();
      ctx.globalAlpha = 0.7 * alpha;
      ctx.strokeStyle = '#ffd0f5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, e.radius * 2.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawGlow(p.x, p.y, e.radius * 4, '#ffd0f5', 0.25 * alpha);
    }
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

// Towers — 6 types (the full roster)
const towers = [];
const projectiles = [];
const particles = [];
const blasts = [];             // expanding AOE rings (Supernova)
const PROJECTILE_SPEED = 0.55; // px per ms

const TOWER_TYPES = {
  prism: {
    name: 'Crystal Prism',   key: '1', cost: 50,
    behavior: 'shoot',
    baseRange: 160, baseDamage: 15, fireInterval: 700,
    color: '#b8f4ff',
  },
  lantern: {
    name: 'Star Lantern',    key: '2', cost: 60,
    behavior: 'slow',
    baseRange: 120, slowMult: 0.5,
    color: '#ffd580',
  },
  beacon: {
    name: 'Memory Beacon',   key: '3', cost: 70,
    behavior: 'dot',
    baseRange: 140, tickInterval: 300, tickDamage: 9,
    color: '#a8ffd8',
  },
  watcher: {
    name: 'The Watcher',     key: '4', cost: 80,
    behavior: 'aura',
    baseRange: 180, auraType: 'range', auraMult: 1.25,
    color: '#d8b0ff',
  },
  amplifier: {
    name: 'Nightmare Amp',   key: '5', cost: 90,
    behavior: 'aura',
    baseRange: 180, auraType: 'damage', auraMult: 1.5,
    color: '#ff9ac2',
  },
  supernova: {
    name: 'Supernova Burst', key: '6', cost: 120,
    behavior: 'shoot-explode',
    baseRange: 260,                        // can lob across a wide area
    baseDamage: 20,                        // direct hit damage
    fireInterval: 1500,
    aoeDamage: 12,                         // splash to nearby enemies
    aoeRadius: 90,
    stunMs: 1500,                          // direct-hit target is frozen for 1.5s
    projectileSpeed: 0.9,                  // fast!
    homing: 0.55,                          // heavy homing blend per frame
    color: '#ffd0f5',
  },
};
const TYPE_KEYS = Object.keys(TOWER_TYPES);
let selectedType = 'prism';

// Compute each tower's effective range/damage based on nearby aura towers.
// M6 rule: aura effects of the same type stack multiplicatively.
// (M8 will refine: only highest-tier aura per type applies; L5 synergy doubles radius.)
function computeTowerEffectives() {
  for (const tw of towers) {
    const t = TOWER_TYPES[tw.type];
    let range  = t.baseRange  ?? 0;
    let damage = t.baseDamage ?? 0;
    for (const other of towers) {
      if (other === tw) continue;
      const ot = TOWER_TYPES[other.type];
      if (ot.behavior !== 'aura') continue;
      const d = Math.hypot(other.x - tw.x, other.y - tw.y);
      if (d > ot.baseRange) continue;
      if (ot.auraType === 'range')  range  *= ot.auraMult;
      if (ot.auraType === 'damage') damage *= ot.auraMult;
    }
    tw.effectiveRange  = range;
    tw.effectiveDamage = damage;
  }
}

function findTargetInRange(tower, range) {
  let best = null, bestProgress = -1;
  for (const e of enemies) {
    const p = enemyPos(e);
    const d = Math.hypot(p.x - tower.x, p.y - tower.y);
    if (d <= range && e.progress > bestProgress) {
      best = e; bestProgress = e.progress;
    }
  }
  return best;
}

function updateTowers(dt) {
  computeTowerEffectives();

  for (const tw of towers) {
    const t = TOWER_TYPES[tw.type];
    tw.fireCooldown = Math.max(0, (tw.fireCooldown || 0) - dt);

    if (t.behavior === 'shoot') {
      if (tw.fireCooldown > 0) continue;
      const target = findTargetInRange(tw, tw.effectiveRange);
      if (!target) continue;
      const p = enemyPos(target);
      const dx = p.x - tw.x, dy = p.y - tw.y;
      const len = Math.hypot(dx, dy) || 1;
      projectiles.push({
        x: tw.x, y: tw.y,
        vx: (dx / len) * PROJECTILE_SPEED,
        vy: (dy / len) * PROJECTILE_SPEED,
        damage: tw.effectiveDamage,
        target,
        color: t.color,
      });
      tw.fireCooldown = t.fireInterval;

    } else if (t.behavior === 'shoot-explode') {
      if (tw.fireCooldown > 0) continue;
      const target = findTargetInRange(tw, tw.effectiveRange);
      if (!target) continue;
      const p = enemyPos(target);
      const dx = p.x - tw.x, dy = p.y - tw.y;
      const len = Math.hypot(dx, dy) || 1;
      projectiles.push({
        x: tw.x, y: tw.y,
        vx: (dx / len) * t.projectileSpeed,
        vy: (dy / len) * t.projectileSpeed,
        speed: t.projectileSpeed,
        homing: t.homing,
        damage: tw.effectiveDamage,
        aoeDamage: t.aoeDamage,
        aoeRadius: t.aoeRadius,
        stunMs: t.stunMs,
        target,
        color: t.color,
        kind: 'explode',
        rotation: 0,
      });
      tw.fireCooldown = t.fireInterval;

    } else if (t.behavior === 'dot') {
      tw.tickTimer = (tw.tickTimer || 0) - dt;
      if (tw.tickTimer > 0) continue;
      for (const e of enemies) {
        const p = enemyPos(e);
        if (Math.hypot(p.x - tw.x, p.y - tw.y) <= tw.effectiveRange) {
          e.hp -= t.tickDamage;
        }
      }
      tw.tickTimer = t.tickInterval;
    }
    // 'slow' and 'aura' are passive — resolved in slowMultiplierFor / computeTowerEffectives
  }
}

// Slow from overlapping Star Lanterns — takes the strongest (smallest mult).
function slowMultiplierFor(e) {
  let mult = 1;
  const p = enemyPos(e);
  for (const tw of towers) {
    const t = TOWER_TYPES[tw.type];
    if (t.behavior !== 'slow') continue;
    if (Math.hypot(p.x - tw.x, p.y - tw.y) <= tw.effectiveRange) {
      mult = Math.min(mult, t.slowMult);
    }
  }
  return mult;
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    const speed = pr.speed || PROJECTILE_SPEED;
    const homing = pr.homing ?? 0.15;

    // homing: re-aim toward target each frame
    if (pr.target && pr.target.hp > 0 && enemies.includes(pr.target)) {
      const tp = enemyPos(pr.target);
      const dx = tp.x - pr.x, dy = tp.y - pr.y;
      const len = Math.hypot(dx, dy) || 1;
      const wantVx = (dx / len) * speed;
      const wantVy = (dy / len) * speed;
      pr.vx = pr.vx * (1 - homing) + wantVx * homing;
      pr.vy = pr.vy * (1 - homing) + wantVy * homing;
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    if (pr.rotation !== undefined) pr.rotation += dt * 0.02;

    // hit detection
    let hitEnemy = null;
    for (const e of enemies) {
      const p = enemyPos(e);
      if (Math.hypot(pr.x - p.x, pr.y - p.y) < e.radius + 4) {
        hitEnemy = e;
        break;
      }
    }

    if (hitEnemy) {
      if (pr.kind === 'explode') {
        // direct hit: damage + stun
        hitEnemy.hp -= pr.damage;
        hitEnemy.stunTimer = Math.max(hitEnemy.stunTimer || 0, pr.stunMs);
        // splash to all other enemies within aoeRadius of impact point
        for (const e of enemies) {
          if (e === hitEnemy) continue;
          const p = enemyPos(e);
          if (Math.hypot(pr.x - p.x, pr.y - p.y) < pr.aoeRadius) {
            e.hp -= pr.aoeDamage;
          }
        }
        // expanding ring visual
        blasts.push({
          x: pr.x, y: pr.y,
          radius: 0, maxRadius: pr.aoeRadius,
          life: 420, maxLife: 420,
          color: pr.color,
        });
      } else {
        hitEnemy.hp -= pr.damage;
      }
    }

    if (hitEnemy ||
        pr.x < -20 || pr.x > canvas.width + 20 ||
        pr.y < -20 || pr.y > canvas.height + 20) {
      projectiles.splice(i, 1);
    }
  }
}

function drawProjectiles() {
  for (const pr of projectiles) {
    if (pr.kind === 'explode') {
      // spinning 5-pointed star
      ctx.save();
      drawGlow(pr.x, pr.y, 20, pr.color, 0.7);
      ctx.translate(pr.x, pr.y);
      ctx.rotate(pr.rotation || 0);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = 1.5;
      drawStarShape(5, 10, 4);
      ctx.restore();
    } else {
      drawGlow(pr.x, pr.y, 10, pr.color || COLORS.prismCore, 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function updateBlasts(dt) {
  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i];
    b.life -= dt;
    b.radius = b.maxRadius * (1 - b.life / b.maxLife);
    if (b.life <= 0) blasts.splice(i, 1);
  }
}

function drawBlasts() {
  for (const b of blasts) {
    const alpha = b.life / b.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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

function drawStarShape(points, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawTower(tw, t) {
  const type = TOWER_TYPES[tw.type];
  drawGlow(tw.x, tw.y, 44, type.color, 0.22);
  ctx.save();
  ctx.translate(tw.x, tw.y);
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 1.5;

  if (tw.type === 'prism') {
    ctx.rotate(t * 0.0004);
    const size = 18;
    const grad = ctx.createLinearGradient(0, -size, 0, size);
    grad.addColorStop(0, '#b8f4ff'); grad.addColorStop(1, '#6ad1ff');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -size); ctx.lineTo(size * 0.65, 0);
    ctx.lineTo(0, size);  ctx.lineTo(-size * 0.65, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

  } else if (tw.type === 'lantern') {
    ctx.rotate(t * 0.0006);
    ctx.fillStyle = type.color;
    drawStarShape(6, 16, 7);
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

  } else if (tw.type === 'beacon') {
    const pulse = 1 + Math.sin(t * 0.004) * 0.15;
    ctx.fillStyle = type.color;
    ctx.beginPath(); ctx.arc(0, 0, 14 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(0, 0, 8 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

  } else if (tw.type === 'watcher') {
    ctx.fillStyle = type.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a1040';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = type.color;
    ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();

  } else if (tw.type === 'amplifier') {
    ctx.rotate(t * 0.0008);
    ctx.fillStyle = type.color;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 18, y = Math.sin(a) * 18;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();

  } else if (tw.type === 'supernova') {
    ctx.rotate(t * 0.0005);
    ctx.fillStyle = type.color;
    drawStarShape(8, 18, 7);
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawTowers(t) {
  // faint aura radius ring for aura towers (so you can see where their effect reaches)
  for (const tw of towers) {
    const type = TOWER_TYPES[tw.type];
    if (type.behavior !== 'aura') continue;
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = type.color;
    ctx.beginPath();
    ctx.arc(tw.x, tw.y, type.baseRange, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const tw of towers) drawTower(tw, t);
}

function drawTowerRanges() {
  if (!mouseInside || towers.length === 0) return;
  let nearest = towers[0];
  let bestD = Math.hypot(mouseX - nearest.x, mouseY - nearest.y);
  for (const tw of towers) {
    const d = Math.hypot(mouseX - tw.x, mouseY - tw.y);
    if (d < bestD) { bestD = d; nearest = tw; }
  }
  if (bestD > 40) return;
  const type = TOWER_TYPES[nearest.type];
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.arc(nearest.x, nearest.y, nearest.effectiveRange || type.baseRange, 0, Math.PI * 2);
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

// Layout helper — which palette cell is at (x, y), or null
function paletteCellAt(x, y) {
  const cellW = 128, cellH = 58, gap = 8;
  const n = TYPE_KEYS.length;
  const totalW = cellW * n + gap * (n - 1);
  let cx = (canvas.width - totalW) / 2;
  const cy = canvas.height - cellH - 16;
  if (y < cy || y > cy + cellH) return null;
  for (const key of TYPE_KEYS) {
    if (x >= cx && x <= cx + cellW) return key;
    cx += cellW + gap;
  }
  return null;
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // palette click → switch selected tower (works even in win/lose so you can eyeball)
  const paletteKey = paletteCellAt(x, y);
  if (paletteKey) { selectedType = paletteKey; return; }

  if (GAME.status === 'won' || GAME.status === 'lost') return;
  if (placementError(x, y)) return;
  const type = TOWER_TYPES[selectedType];
  if (GAME.money < type.cost) return;
  GAME.money -= type.cost;
  towers.push({ x, y, type: selectedType, fireCooldown: 0, tickTimer: 0 });
});

function drawPlacementHint() {
  if (!mouseInside) return;
  if (GAME.status === 'won' || GAME.status === 'lost') return;
  if (paletteCellAt(mouseX, mouseY)) return; // cursor over the palette — no placement preview
  const type = TOWER_TYPES[selectedType];
  const err = placementError(mouseX, mouseY);
  const broke = GAME.money < type.cost;
  const bad = err || broke;
  ctx.save();
  // placement ring at cursor
  ctx.globalAlpha = bad ? 0.4 : 0.85;
  ctx.strokeStyle = bad ? '#ff7aa2' : type.color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 22, 0, Math.PI * 2);
  ctx.stroke();
  // preview this tower's range/aura radius
  if (!bad) {
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = type.color;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, type.baseRange, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTowerPalette() {
  const cellW = 128, cellH = 58, gap = 8;
  const n = TYPE_KEYS.length;
  const totalW = cellW * n + gap * (n - 1);
  let x = (canvas.width - totalW) / 2;
  const y = canvas.height - cellH - 16;

  ctx.save();
  ctx.font = '12px system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  for (const key of TYPE_KEYS) {
    const type = TOWER_TYPES[key];
    const selected = key === selectedType;
    const broke = GAME.money < type.cost;

    ctx.globalAlpha = selected ? 0.35 : 0.15;
    ctx.fillStyle = type.color;
    ctx.fillRect(x, y, cellW, cellH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = selected ? '#ffffff' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#cfd0ff';
    ctx.fillText(type.key, x + 10, y + 20);

    ctx.fillStyle = selected ? '#ffffff' : '#cfd0ff';
    ctx.fillText(type.name, x + 26, y + 20);

    ctx.fillStyle = broke ? '#ff7aa2' : (selected ? '#b8f4ff' : '#a8b0d8');
    ctx.fillText(`✦ ${type.cost}`, x + 10, y + cellH - 12);

    x += cellW + gap;
  }
  ctx.restore();
}

function drawHUD() {
  ctx.save();
  ctx.font = '14px system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#cfd0ff';
  ctx.globalAlpha = 0.92;

  // top-right panel: money, lives, wave
  const lines = [
    `✦  ${GAME.money}`,
    `♡  ${GAME.lives}`,
    `Wave  ${GAME.wave} / ${WAVES.length}`,
  ];
  const pad = 16;
  let x = canvas.width - pad;
  let y = pad;
  ctx.textAlign = 'right';
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += 20;
  }

  // status strip (center-top, smaller)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b8f4ff';
  if (GAME.status === 'rest') {
    const s = Math.max(0, Math.ceil(GAME.restTimer / 1000));
    const label = GAME.wave === 0 ? 'First wave in' : `Wave ${GAME.wave + 1} in`;
    ctx.fillText(`${label}  ${s}`, canvas.width / 2, 14);
  } else if (GAME.status === 'wave') {
    ctx.fillText(`Wave ${GAME.wave} — ${GAME.toSpawn + enemies.length} remaining`, canvas.width / 2, 14);
  }

  // hint bar (bottom-left) — palette handles the rest
  ctx.textAlign = 'left';
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#cfd0ff';
  ctx.fillText(`Keys 1–6 pick a tower · Click to place · Press R to restart`, pad, 18);

  // tower palette — 6 cells along the bottom
  drawTowerPalette();

  // win / lose banner
  if (GAME.status === 'won' || GAME.status === 'lost') {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(10,10,31,0.7)';
    ctx.fillRect(0, canvas.height / 2 - 70, canvas.width, 140);
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillStyle = GAME.status === 'won' ? '#b8f4ff' : '#ff9ad6';
    ctx.fillText(
      GAME.status === 'won' ? 'Dreamcore Cleared' : 'The Star Fades',
      canvas.width / 2, canvas.height / 2 - 30
    );
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#cfd0ff';
    ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 20);
  }
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

  updateWaves(dt);
  updateTowers(dt);        // compute effectives first — enemies need slow mult
  updateEnemies(dt);
  updateProjectiles(dt);
  updateParticles(dt);
  updateBlasts(dt);

  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawBlasts();
  drawTowers(t);
  drawTowerRanges();
  drawPlacementHint();

  // Center star — the thing enemies are trying to reach
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const pulse = 26 + Math.sin(t * 0.002) * 4;
  drawOrb(cx, cy, pulse);

  drawHUD();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
