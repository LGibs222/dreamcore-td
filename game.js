// Dreamcore TD — M7: 5-tier upgrade system for all 6 towers.
// (Aura stacking rules = M8, dreamcore polish = M10.)

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
  selectedTower = null;
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
  if (e.key === 'Escape') { selectedTower = null; return; }
  if (e.key === 'u' || e.key === 'U') { if (selectedTower) tryUpgrade(selectedTower); return; }
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
    baseRange: 128, baseDamage: 15, fireInterval: 700,
    color: '#b8f4ff',
  },
  lantern: {
    name: 'Star Lantern',    key: '2', cost: 60,
    behavior: 'slow',
    baseRange: 96, slowMult: 0.5,
    color: '#ffd580',
  },
  beacon: {
    name: 'Memory Beacon',   key: '3', cost: 70,
    behavior: 'dot',
    baseRange: 112, tickInterval: 300, tickDamage: 9,
    color: '#a8ffd8',
  },
  watcher: {
    name: 'The Watcher',     key: '4', cost: 80,
    behavior: 'aura',
    baseRange: 144, auraType: 'range', auraMult: 1.25,
    color: '#d8b0ff',
  },
  amplifier: {
    name: 'Nightmare Amp',   key: '5', cost: 90,
    behavior: 'aura',
    baseRange: 144, auraType: 'damage', auraMult: 1.5,
    color: '#ff9ac2',
  },
  supernova: {
    name: 'Supernova Burst', key: '6', cost: 120,
    behavior: 'shoot-explode',
    baseRange: 208,                        // can lob across a wide area
    baseDamage: 20,                        // direct hit damage
    fireInterval: 1500,
    aoeDamage: 12,                         // splash to nearby enemies
    aoeRadius: 90,
    stunMs: 500,                           // 0.5s base stun (tier scaling adds more)
    projectileSpeed: 0.9,                  // fast!
    homing: 0.55,                          // heavy homing blend per frame
    color: '#ffd0f5',
  },
};
const TYPE_KEYS = Object.keys(TOWER_TYPES);
let selectedType = 'prism';

// Upgrade tiers — cumulative stat multipliers (index by tier 1-5)
const TIER_MULT        = [null, 1.00, 1.30, 1.65, 2.10, 2.75];
// Cost to REACH a tier (as fraction of base cost). Tier 1 is free (placement).
const UPGRADE_COST_FRAC = [null, 0, 0.5, 0.9, 1.4, 2.2];
const SELL_FRACTION = 0.7;
let selectedTower = null;  // reference to a placed tower object (or null)

function upgradeCost(tw) {
  if (tw.tier >= 5) return null;
  const type = TOWER_TYPES[tw.type];
  return Math.ceil(type.cost * UPGRADE_COST_FRAC[tw.tier + 1]);
}
function sellValue(tw) {
  return Math.floor((tw.totalSpent || TOWER_TYPES[tw.type].cost) * SELL_FRACTION);
}
function tryUpgrade(tw) {
  const cost = upgradeCost(tw);
  if (cost == null || GAME.money < cost) return;
  GAME.money -= cost;
  tw.totalSpent = (tw.totalSpent || 0) + cost;
  tw.tier += 1;
}
function sellTower(tw) {
  GAME.money += sellValue(tw);
  const idx = towers.indexOf(tw);
  if (idx >= 0) towers.splice(idx, 1);
  if (selectedTower === tw) selectedTower = null;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
function panelGeometry(tw) {
  const panelW = 240, panelH = 132;
  const px = tw.x + 30;
  const py = tw.y - 60;
  const x = Math.min(canvas.width - panelW - 12, Math.max(12, px));
  const y = Math.min(canvas.height - panelH - 90, Math.max(12, py));  // stay above the tower palette
  return {
    x, y, panelW, panelH,
    upgradeRect: { x: x + 12,            y: y + panelH - 34, w: 104, h: 24 },
    sellRect:    { x: x + panelW - 116,  y: y + panelH - 34, w: 104, h: 24 },
  };
}

// Compute tier-scaled "self" stats per tower, then apply aura bonuses from neighbors.
function computeTowerEffectives() {
  // Pass 1: tier-scaled self stats
  for (const tw of towers) {
    const t = TOWER_TYPES[tw.type];
    const m = TIER_MULT[tw.tier];
    tw.selfRange        = (t.baseRange  ?? 0) * m;
    tw.selfDamage       = (t.baseDamage ?? 0) * m;
    tw.selfTickDamage   = t.tickDamage   ? t.tickDamage * m : 0;
    tw.selfAoeDamage    = t.aoeDamage    ? t.aoeDamage * m : 0;
    tw.selfAoeRadius    = t.aoeRadius    ? t.aoeRadius * (1 + (m - 1) * 0.3) : 0;
    tw.selfStunMs       = t.stunMs       ? t.stunMs + (m - 1) * 500 : 0;
    tw.selfSlowMult     = t.slowMult     ? Math.max(0.08, t.slowMult - (m - 1) * 0.08) : 1;
    tw.selfAuraMult     = t.auraMult     ? 1 + (t.auraMult - 1) * m : 1;
    tw.selfFireInterval = t.fireInterval ? Math.max(150, t.fireInterval / (1 + (m - 1) * 0.25)) : 0;
  }
  // Pass 2: aura bonuses on range/damage from nearby aura towers
  for (const tw of towers) {
    tw.effectiveRange  = tw.selfRange;
    tw.effectiveDamage = tw.selfDamage;
    for (const other of towers) {
      if (other === tw) continue;
      const ot = TOWER_TYPES[other.type];
      if (ot.behavior !== 'aura') continue;
      const d = Math.hypot(other.x - tw.x, other.y - tw.y);
      if (d > other.selfRange) continue;
      if (ot.auraType === 'range')  tw.effectiveRange  *= other.selfAuraMult;
      if (ot.auraType === 'damage') tw.effectiveDamage *= other.selfAuraMult;
    }
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
      const baseAngle = Math.atan2(p.y - tw.y, p.x - tw.x);
      // Prism T5 signature: prism-split — fire 3 shots in a cone
      const offsets = (tw.type === 'prism' && tw.tier === 5) ? [-0.20, 0, 0.20] : [0];
      for (const off of offsets) {
        const a = baseAngle + off;
        projectiles.push({
          x: tw.x, y: tw.y,
          vx: Math.cos(a) * PROJECTILE_SPEED,
          vy: Math.sin(a) * PROJECTILE_SPEED,
          damage: tw.effectiveDamage,
          target: off === 0 ? target : null, // only the center shot homes
          color: t.color,
        });
      }
      tw.fireCooldown = tw.selfFireInterval;

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
        aoeDamage: tw.selfAoeDamage,
        aoeRadius: tw.selfAoeRadius,
        stunMs: tw.selfStunMs,
        target,
        color: t.color,
        kind: 'explode',
        rotation: 0,
        // Supernova T5 signature: on explosion, chain-blast the nearest surviving enemy
        chain: tw.tier === 5,
      });
      tw.fireCooldown = tw.selfFireInterval;

    } else if (t.behavior === 'dot') {
      tw.tickTimer = (tw.tickTimer || 0) - dt;
      if (tw.tickTimer > 0) continue;
      for (const e of enemies) {
        const p = enemyPos(e);
        if (Math.hypot(p.x - tw.x, p.y - tw.y) <= tw.selfRange) {
          e.hp -= tw.selfTickDamage;
        }
      }
      tw.tickTimer = t.tickInterval;
    }
    // 'slow' and 'aura' are passive — resolved in slowMultiplierFor / computeTowerEffectives
  }
}

function findNearestEnemyWithin(x, y, radius, except) {
  let best = null, bestD = radius;
  for (const e of enemies) {
    if (e === except) continue;
    const p = enemyPos(e);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) { best = e; bestD = d; }
  }
  return best;
}

// Slow from overlapping Star Lanterns — takes the strongest (smallest mult).
function slowMultiplierFor(e) {
  let mult = 1;
  const p = enemyPos(e);
  for (const tw of towers) {
    const t = TOWER_TYPES[tw.type];
    if (t.behavior !== 'slow') continue;
    if (Math.hypot(p.x - tw.x, p.y - tw.y) <= tw.selfRange) {
      mult = Math.min(mult, tw.selfSlowMult);
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
        hitEnemy.hp -= pr.damage;
        hitEnemy.stunTimer = Math.max(hitEnemy.stunTimer || 0, pr.stunMs);
        for (const e of enemies) {
          if (e === hitEnemy) continue;
          const p = enemyPos(e);
          if (Math.hypot(pr.x - p.x, pr.y - p.y) < pr.aoeRadius) {
            e.hp -= pr.aoeDamage;
          }
        }
        blasts.push({
          x: pr.x, y: pr.y,
          radius: 0, maxRadius: pr.aoeRadius,
          life: 420, maxLife: 420,
          color: pr.color,
        });
        // Supernova T5 chain: hop once to the nearest surviving enemy within 150px
        if (pr.chain) {
          const chainT = findNearestEnemyWithin(pr.x, pr.y, 150, hitEnemy);
          if (chainT) {
            const cp = enemyPos(chainT);
            chainT.hp -= pr.aoeDamage * 1.5;
            chainT.stunTimer = Math.max(chainT.stunTimer || 0, pr.stunMs * 0.6);
            blasts.push({
              x: cp.x, y: cp.y,
              radius: 0, maxRadius: pr.aoeRadius * 0.7,
              life: 360, maxLife: 360,
              color: pr.color,
            });
          }
        }
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

// Crystal Prism visual — evolves across tiers from a simple diamond
// into a sharper "ethereal mythical" crystal with a realistic watching eye.
// Dreamcore vibe: beautiful but unsettling.
function drawCrystalPrismTiered(tw, t) {
  const tier = tw.tier;
  // Size and sharpness grow with tier — taller/thinner at T5
  const size = 16 + tier * 4;                    // 20, 24, 28, 32, 36
  const widthRatio = 0.68 - (tier - 1) * 0.055;  // 0.68 → 0.46
  const rot = t * 0.0004;

  // Outer aura — brighter each tier
  drawGlow(0, 0, size * 2.4, '#b8f4ff', 0.18 + (tier - 1) * 0.05);
  if (tier >= 4) drawGlow(0, 0, size * 3.6, '#6ad1ff', 0.10);

  // Diamond body (rotates slowly)
  ctx.save();
  ctx.rotate(rot);
  const grad = ctx.createLinearGradient(0, -size, 0, size);
  // deeper colors at higher tiers — the crystal gets more "alive"
  grad.addColorStop(0, tier >= 4 ? '#e4f8ff' : '#b8f4ff');
  grad.addColorStop(1, tier >= 4 ? '#4aa5ff' : '#6ad1ff');
  ctx.fillStyle = grad;
  ctx.strokeStyle = tier === 5 ? '#ffffff' : '#b8f4ff';
  ctx.lineWidth = 1.5 + (tier - 1) * 0.35;

  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * widthRatio, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * widthRatio, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner facet highlight (gets brighter at higher tiers)
  ctx.globalAlpha = 0.35 + (tier - 1) * 0.1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.78);
  ctx.lineTo(-size * widthRatio * 0.35, -size * 0.1);
  ctx.lineTo(-size * widthRatio * 0.55, size * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // The Eye — does NOT rotate with the diamond (keeps looking out).
  // Appears gradually: T2 is a subtle slit, T5 is a realistic watching eye.
  if (tier >= 2) {
    const growth = (tier - 1) / 4;           // 0.25, 0.50, 0.75, 1.00
    const eyeW = size * 0.46 * growth;
    const eyeH = size * 0.24 * growth;

    if (tier === 2) {
      // just a faint vertical pupil slit — the hint of something alive
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#1a0a2a';
      ctx.fillRect(-0.9, -eyeH, 1.8, eyeH * 2);
      ctx.restore();
    } else {
      // Sclera (white of the eye) — slightly off-white for realism
      ctx.save();
      ctx.fillStyle = tier >= 5 ? '#f8efe0' : '#ede0ca';
      ctx.beginPath();
      ctx.ellipse(0, 0, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 10, 30, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Iris — deep dreamy purple
      const irisR = eyeH * 0.85;
      ctx.fillStyle = tier >= 5 ? '#2a0d4f' : '#3a1f6a';
      ctx.beginPath();
      ctx.arc(0, 0, irisR, 0, Math.PI * 2);
      ctx.fill();

      // Iris detail ring
      ctx.strokeStyle = '#9a6ad0';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, irisR * 0.62, 0, Math.PI * 2);
      ctx.stroke();

      // Pupil — tracks the cursor for "it's watching you" effect
      let px = 0, py = 0;
      if (mouseInside) {
        const dx = mouseX - tw.x;
        const dy = mouseY - tw.y;
        const len = Math.hypot(dx, dy) || 1;
        const maxOff = eyeH * 0.4;
        px = (dx / len) * maxOff;
        py = (dy / len) * maxOff;
      }
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(px, py, eyeH * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Catchlight on the pupil (T4+) — the realism tell
      if (tier >= 4) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px - eyeH * 0.15, py - eyeH * 0.15, eyeH * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // T5: the unsettling details — veins and a subtle blood-red edge
      if (tier === 5) {
        ctx.strokeStyle = 'rgba(185, 40, 55, 0.7)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(-eyeW * 0.95, -eyeH * 0.25);
        ctx.quadraticCurveTo(-eyeW * 0.55, -eyeH * 0.05, -eyeW * 0.22, eyeH * 0.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(eyeW * 0.9, eyeH * 0.3);
        ctx.quadraticCurveTo(eyeW * 0.5, eyeH * 0.4, eyeW * 0.15, eyeH * 0.2);
        ctx.stroke();
        // a slow, subtle pulse on the iris edge
        const pulse = 0.4 + 0.3 * Math.sin(t * 0.003);
        ctx.globalAlpha = pulse * 0.5;
        ctx.strokeStyle = '#ff6a88';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, irisR * 1.02, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }
}

function drawTower(tw, t) {
  const type = TOWER_TYPES[tw.type];
  drawGlow(tw.x, tw.y, 44, type.color, 0.22);
  ctx.save();
  ctx.translate(tw.x, tw.y);
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 1.5;

  if (tw.type === 'prism') {
    drawCrystalPrismTiered(tw, t);

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
    ctx.arc(tw.x, tw.y, tw.selfRange, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const tw of towers) drawTower(tw, t);
  // tier pips — 5 small dots below each tower
  for (const tw of towers) drawTierPips(tw);
  // selection highlight + effective range for the selected tower
  if (selectedTower) {
    const sel = selectedTower;
    const type = TOWER_TYPES[sel.type];
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(sel.x, sel.y, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = type.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.arc(sel.x, sel.y, sel.effectiveRange || sel.selfRange, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawTierPips(tw) {
  const type = TOWER_TYPES[tw.type];
  const pipR = 2.2;
  const gap = 7;
  const totalW = gap * 4;
  const y = tw.y + 26;
  const x0 = tw.x - totalW / 2;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const filled = i < tw.tier;
    ctx.globalAlpha = filled ? 1 : 0.3;
    ctx.fillStyle = filled ? type.color : '#6a6a8a';
    ctx.beginPath();
    ctx.arc(x0 + i * gap, y, pipR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawUpgradePanel() {
  if (!selectedTower) return;
  const tw = selectedTower;
  const type = TOWER_TYPES[tw.type];
  const g = panelGeometry(tw);
  const { x, y, panelW, panelH } = g;

  ctx.save();
  // panel bg
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = 'rgba(10,10,31,0.92)';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, panelW - 1, panelH - 1);

  // title + tier
  ctx.font = 'bold 14px system-ui';
  ctx.fillStyle = type.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(type.name, x + 12, y + 10);

  ctx.font = '12px system-ui';
  ctx.fillStyle = '#cfd0ff';
  const pips = '●'.repeat(tw.tier) + '○'.repeat(5 - tw.tier);
  ctx.fillText(`Tier ${tw.tier} / 5   ${pips}`, x + 12, y + 30);

  // stats — show the ones that matter for this behavior
  ctx.font = '11px system-ui';
  ctx.fillStyle = '#a8b0d8';
  let sy = y + 50;
  const stat = (label, val) => { ctx.fillText(`${label}  ${val}`, x + 12, sy); sy += 14; };

  if (type.behavior === 'shoot') {
    stat('Damage',  Math.round(tw.effectiveDamage));
    stat('Range',   Math.round(tw.effectiveRange));
    stat('Fire rate', `${(1000 / tw.selfFireInterval).toFixed(1)}/s`);
  } else if (type.behavior === 'shoot-explode') {
    stat('Direct',  Math.round(tw.effectiveDamage));
    stat('Splash',  `${Math.round(tw.selfAoeDamage)} in ${Math.round(tw.selfAoeRadius)}px`);
    stat('Stun',    `${(tw.selfStunMs / 1000).toFixed(1)}s`);
  } else if (type.behavior === 'dot') {
    stat('Per tick', Math.round(tw.selfTickDamage));
    stat('Range',    Math.round(tw.selfRange));
  } else if (type.behavior === 'slow') {
    stat('Slow to', `${Math.round(tw.selfSlowMult * 100)}%`);
    stat('Range',   Math.round(tw.selfRange));
  } else if (type.behavior === 'aura') {
    const pct = Math.round((tw.selfAuraMult - 1) * 100);
    stat(type.auraType === 'range' ? 'Range aura' : 'Damage aura', `+${pct}%`);
    stat('Aura radius', Math.round(tw.selfRange));
  }

  // T5 signature text
  if (tw.tier === 5) {
    const sig = T5_TEXT[tw.type];
    if (sig) {
      ctx.fillStyle = type.color;
      ctx.fillText(`✦ ${sig}`, x + 12, sy);
    }
  }

  // buttons
  const up = upgradeCost(tw);
  const sell = sellValue(tw);
  drawPanelButton(g.upgradeRect, up == null ? 'MAX' : `Upgrade  ✦${up}`, up == null || GAME.money < up, type.color);
  drawPanelButton(g.sellRect, `Sell  ✦${sell}`, false, '#ff9ac2');

  ctx.restore();
}

const T5_TEXT = {
  prism:     'Prism-split: fires 3 shots',
  supernova: 'Chain-blast on explosion',
  lantern:   'Deeper slow',
  beacon:    'Ticks harder',
  watcher:   'Massive range aura',
  amplifier: 'Massive damage aura',
};

function drawPanelButton(r, label, disabled, color) {
  ctx.save();
  ctx.globalAlpha = disabled ? 0.35 : 1;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  ctx.restore();
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

  // Upgrade panel (if open) — buttons first, then outside-click deselects
  if (selectedTower) {
    const g = panelGeometry(selectedTower);
    if (pointInRect(x, y, g.upgradeRect)) { tryUpgrade(selectedTower); return; }
    if (pointInRect(x, y, g.sellRect))    { sellTower(selectedTower);  return; }
    const insidePanel = x >= g.x && x <= g.x + g.panelW && y >= g.y && y <= g.y + g.panelH;
    if (insidePanel) return;       // click inside panel but not on a button — ignore
    selectedTower = null;           // click outside panel — deselect, fall through
  }

  // Palette click switches the tower-to-place
  const paletteKey = paletteCellAt(x, y);
  if (paletteKey) { selectedType = paletteKey; return; }

  if (GAME.status === 'won' || GAME.status === 'lost') return;

  // Click on an existing tower → open its upgrade panel
  for (const tw of towers) {
    if (Math.hypot(x - tw.x, y - tw.y) < 22) { selectedTower = tw; return; }
  }

  // Otherwise try to place a new tower
  if (placementError(x, y)) return;
  const type = TOWER_TYPES[selectedType];
  if (GAME.money < type.cost) return;
  GAME.money -= type.cost;
  towers.push({
    x, y,
    type: selectedType,
    tier: 1,
    totalSpent: type.cost,
    fireCooldown: 0,
    tickTimer: 0,
  });
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
  ctx.fillText(`Keys 1–6 pick a tower · Click tower to upgrade (U) or sell · ESC closes · R restarts`, pad, 18);

  // tower palette — 6 cells along the bottom
  drawTowerPalette();
  // upgrade panel for the selected placed tower
  drawUpgradePanel();

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
