// Dreamcore TD — M1: glowing orb drifts on a dark canvas
// Teaching notes (Xavier):
//   - requestAnimationFrame = "call me on the next frame, ~60 times a second"
//   - We clear the canvas each frame, then redraw everything in its new position
//   - Math.sin(time) gives a smooth wave between -1 and 1 — perfect for drifting

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Dreamcore palette
const COLORS = {
  bgDeep:   '#0a0a1f',
  bgGlow:   '#1a1040',
  orbCore:  '#ffd6f5',
  orbMid:   '#c9a6ff',
  orbOuter: '#6ad1ff',
};

// Resize the canvas to fill the window (and handle window resizes)
function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Starfield — a cheap sense of space
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

// Draw a radial-gradient background so the center glows softly
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

// A glowing orb — three stacked radial gradients for soft bloom
function drawOrb(x, y, radius) {
  const layers = [
    { r: radius * 4.0, color: COLORS.orbOuter, alpha: 0.15 },
    { r: radius * 2.2, color: COLORS.orbMid,   alpha: 0.35 },
    { r: radius * 1.0, color: COLORS.orbCore,  alpha: 1.00 },
  ];
  for (const layer of layers) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, layer.r);
    grad.addColorStop(0, layer.color);
    grad.addColorStop(1, 'rgba(10,10,31,0)');
    ctx.globalAlpha = layer.alpha;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, layer.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// The main loop — runs ~60x per second
function loop(t) {
  drawBackground();
  drawStars(t);

  // Orb drifts in a slow Lissajous figure around the center
  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;
  const driftX = Math.sin(t * 0.0004) * 140;
  const driftY = Math.cos(t * 0.0003) * 90;
  const pulse  = 22 + Math.sin(t * 0.002) * 4; // gentle radius pulse

  drawOrb(cx + driftX, cy + driftY, pulse);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
