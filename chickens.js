// === Hühnerschießen ===
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const GAME_DURATION = 60; // Sekunden
const HIGHSCORE_KEY = 'chickens_highscore';

const CHICKEN_TYPES = {
  white:   { points: 1,  speedRange: [80, 130],  size: 36, weight: 0.65, color: '#fafafa' },
  brown:   { points: 2,  speedRange: [120, 180], size: 34, weight: 0.29, color: '#a06030' },
  gold:    { points: 5,  speedRange: [220, 320], size: 32, weight: 0.05, color: '#ffd700' },
  diamond: { points: 10, speedRange: [420, 540], size: 30, weight: 0.01, color: '#ff1f3a' }
};

const state = {
  running: false,
  startTime: 0,
  timeLeft: GAME_DURATION,
  score: 0,
  hits: { white: 0, brown: 0, gold: 0, diamond: 0 },
  shotsFired: 0,
  chickens: [],
  feathers: [],
  wastes: [],
  popups: [],
  mouse: { x: W / 2, y: H / 2 },
  mouseInside: false,
  spawnTimer: 0,
  shotCooldown: 0,
  highscore: 0,
  diamondSpawns: []
};

// Diamanthuhn-Spawns pro Runde: garantiert 1, dann 60% Chance auf 2., dann 30% auf 3.
const DIAMOND_EXTRA_CHANCES = [0.6, 0.3];
// Spawn-Fenster: nicht in den ersten 5s, nicht in den letzten 5s
const DIAMOND_WINDOW = [5, GAME_DURATION - 5];

// === DOM ===
const overlayMenu = document.getElementById('overlay-menu');
const overlayGameover = document.getElementById('overlay-gameover');
const btnStart = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const hitCountEl = document.getElementById('hit-count');
const highscoreEl = document.getElementById('highscore');
const timerEl = document.getElementById('timer');

// Highscore laden
state.highscore = parseInt(localStorage.getItem(HIGHSCORE_KEY) || '0', 10);
highscoreEl.textContent = state.highscore;

btnStart.addEventListener('click', startGame);
btnRestart.addEventListener('click', () => {
  overlayGameover.classList.add('hidden');
  overlayMenu.classList.remove('hidden');
});

function startGame() {
  state.running = true;
  state.startTime = performance.now();
  state.timeLeft = GAME_DURATION;
  state.score = 0;
  state.hits = { white: 0, brown: 0, gold: 0, diamond: 0 };
  state.shotsFired = 0;
  state.chickens = [];
  state.feathers = [];
  state.wastes = [];
  state.popups = [];
  state.spawnTimer = 0;
  state.shotCooldown = 0;
  // Diamanthuhn: garantiert 1 pro Runde, plus weitere mit fallender Chance
  state.diamondSpawns = [];
  const pushDiamond = () => state.diamondSpawns.push({
    time: DIAMOND_WINDOW[0] + Math.random() * (DIAMOND_WINDOW[1] - DIAMOND_WINDOW[0]),
    spawned: false
  });
  pushDiamond();
  for (const chance of DIAMOND_EXTRA_CHANCES) {
    if (Math.random() < chance) pushDiamond();
  }
  hitCountEl.textContent = '0';
  timerEl.textContent = GAME_DURATION;
  overlayMenu.classList.add('hidden');
  overlayGameover.classList.add('hidden');
  canvas.classList.add('playing');
}

// Bonus für richtige Punktesumme
const BONUS_CORRECT = 25;

const countStepEl = document.getElementById('count-step');
const resultStepEl = document.getElementById('result-step');
const resultGridEl = document.getElementById('result-grid');
const resultTitleEl = document.getElementById('result-title');
const finalScoreEl = document.getElementById('final-score');
const bonusLineEl = document.getElementById('bonus-line');
const highscoreMsgEl = document.getElementById('highscore-message');
const btnEvaluate = document.getElementById('btn-evaluate');
const displayWhite = document.getElementById('display-white');
const displayBrown = document.getElementById('display-brown');
const displayGold = document.getElementById('display-gold');
const displayDiamond = document.getElementById('display-diamond');
const inputTotal = document.getElementById('count-total');

function endGame() {
  state.running = false;
  canvas.classList.remove('playing');

  // Anzahlen anzeigen
  displayWhite.textContent = state.hits.white;
  displayBrown.textContent = state.hits.brown;
  displayGold.textContent = state.hits.gold;
  displayDiamond.textContent = state.hits.diamond;

  inputTotal.value = '';
  countStepEl.classList.remove('hidden');
  resultStepEl.classList.add('hidden');
  overlayGameover.classList.remove('hidden');
  setTimeout(() => inputTotal.focus(), 100);
}

btnEvaluate.addEventListener('click', evaluateCounts);
inputTotal.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') evaluateCounts();
});

function parseCount(input) {
  const v = parseInt(input.value, 10);
  return isNaN(v) || v < 0 ? 0 : v;
}

function evaluateCounts() {
  const userTotal = parseCount(inputTotal);
  const types = [
    { key: 'white',   label: 'Weiß' },
    { key: 'brown',   label: 'Braun' },
    { key: 'gold',    label: 'Gold' },
    { key: 'diamond', label: 'Diamant' }
  ];

  resultGridEl.innerHTML = '';

  // Multiplikations-Breakdown anzeigen
  for (const t of types) {
    const count = state.hits[t.key];
    const points = CHICKEN_TYPES[t.key].points;
    const sub = count * points;
    const row = document.createElement('div');
    row.className = 'result-row math';
    row.innerHTML = `
      <span class="chicken-dot ${t.key}"></span>
      <span class="label">${t.label}</span>
      <span class="vals"><b>${count}</b> × <b>${points}</b> = <b>${sub}</b></span>
    `;
    resultGridEl.appendChild(row);
  }

  // Total-Zeile
  const correct = state.score === userTotal;
  const totalRow = document.createElement('div');
  totalRow.className = `result-row total ${correct ? 'correct' : 'wrong'}`;
  totalRow.innerHTML = `
    <span class="label">Total</span>
    <span class="vals">deine <b>${userTotal}</b> · richtig <b>${state.score}</b></span>
    <span class="mark">${correct ? '✓' : '✗'}</span>
  `;
  resultGridEl.appendChild(totalRow);

  // Bonus
  const bonus = correct ? BONUS_CORRECT : 0;
  const finalScore = state.score + bonus;
  finalScoreEl.textContent = finalScore;

  if (correct) {
    bonusLineEl.textContent = `Richtig gerechnet! +${BONUS_CORRECT} Bonus 🎉`;
    bonusLineEl.classList.remove('zero');
    resultTitleEl.textContent = '🌟 Super!';
  } else {
    const diff = userTotal - state.score;
    const tip = diff > 0 ? 'zu viel' : 'zu wenig';
    bonusLineEl.textContent = `Leider falsch (${Math.abs(diff)} ${tip}) — kein Bonus`;
    bonusLineEl.classList.add('zero');
    resultTitleEl.textContent = 'Auswertung';
  }

  // Highscore
  let isNew = false;
  if (finalScore > state.highscore) {
    state.highscore = finalScore;
    localStorage.setItem(HIGHSCORE_KEY, finalScore.toString());
    highscoreEl.textContent = finalScore;
    isNew = true;
  }
  highscoreMsgEl.textContent = isNew ? '🏆 Neuer Highscore!' : `Bester: ${state.highscore} Punkte`;

  countStepEl.classList.add('hidden');
  resultStepEl.classList.remove('hidden');
}

// === Mausinput ===
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = (e.clientX - rect.left) * (W / rect.width);
  state.mouse.y = (e.clientY - rect.top) * (H / rect.height);
  state.mouseInside = true;
});
canvas.addEventListener('mouseleave', () => {
  state.mouseInside = false;
});
canvas.addEventListener('mousedown', (e) => {
  if (!state.running) return;
  if (e.button !== 0) return;
  if (state.shotCooldown > 0) return;
  shoot(state.mouse.x, state.mouse.y);
});

// === Touch-Input (Handy/Tablet) ===
// Zielfernrohr sitzt über dem Finger, damit man das Ziel sehen kann.
const TOUCH_SCOPE_OFFSET_Y = 140;

function setScopeFromTouch(touch) {
  const rect = canvas.getBoundingClientRect();
  const x = (touch.clientX - rect.left) * (W / rect.width);
  const y = (touch.clientY - rect.top) * (H / rect.height) - TOUCH_SCOPE_OFFSET_Y;
  state.mouse.x = Math.max(0, Math.min(W, x));
  state.mouse.y = Math.max(0, Math.min(H, y));
  state.mouseInside = true;
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (e.touches.length === 0) return;
  setScopeFromTouch(e.touches[0]);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (e.touches.length === 0) return;
  setScopeFromTouch(e.touches[0]);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!state.running) return;
  if (e.touches.length > 0) return; // andere Finger noch unten
  if (state.shotCooldown > 0) return;
  shoot(state.mouse.x, state.mouse.y);
}, { passive: false });

canvas.addEventListener('touchcancel', (e) => {
  e.preventDefault();
}, { passive: false });

function shoot(sx, sy) {
  state.shotsFired++;
  state.shotCooldown = 0.18; // Sekunden
  // Mündungsblitz / Kamera-Shake könnten hier hin
  let hit = null;
  // Treffer prüfen — größtes vorne
  for (let i = state.chickens.length - 1; i >= 0; i--) {
    const ch = state.chickens[i];
    if (ch.dead) continue;
    const dx = sx - ch.x;
    const dy = sy - ch.y;
    const r = ch.size * 0.55;
    if (dx * dx + dy * dy <= r * r) {
      hit = ch;
      break;
    }
  }
  if (hit) {
    hit.dead = true;
    hit.deathTime = performance.now();
    hit.vy = -40;
    state.score += hit.def.points;
    state.hits[hit.type]++;
    const totalHits = state.hits.white + state.hits.brown + state.hits.gold + state.hits.diamond;
    hitCountEl.textContent = totalHits;
    spawnFeathers(hit.x, hit.y, hit.def.color);
    // Generisches Treffer-Feedback (keine Punktzahl!)
    spawnPopup(hit.x, hit.y - 30, 'TREFFER!', hit.def.color, 0.5);
  } else {
    spawnPopup(sx, sy - 12, 'X', '#ff4444', 0.5);
  }
}

// === Hühner spawnen ===
function spawnChicken(forcedType) {
  let type = forcedType;
  if (!type) {
    const r = Math.random();
    let acc = 0;
    for (const [k, def] of Object.entries(CHICKEN_TYPES)) {
      if (k === 'diamond') continue; // Diamant niemals zufällig — wird separat gesteuert
      acc += def.weight;
      if (r < acc) { type = k; break; }
    }
    if (!type) type = 'white';
  }
  const def = CHICKEN_TYPES[type];

  const fromLeft = Math.random() < 0.5;
  const speed = def.speedRange[0] + Math.random() * (def.speedRange[1] - def.speedRange[0]);
  const dir = fromLeft ? 1 : -1;
  // Höhe: oberer Drittel bis Mitte
  const y = 60 + Math.random() * (H * 0.55);
  const x = fromLeft ? -def.size : W + def.size;

  // Witz: ein kleiner Anteil der Hühner lässt im Flug einmal etwas fallen
  const dropsWaste = Math.random() < 0.08;
  state.chickens.push({
    type,
    def,
    x, y,
    vx: dir * speed,
    vy: (Math.random() - 0.5) * 20,
    size: def.size,
    dir,
    dead: false,
    deathTime: 0,
    flapPhase: Math.random() * Math.PI * 2,
    bobPhase: Math.random() * Math.PI * 2,
    wasteDropAt: dropsWaste ? performance.now() + 600 + Math.random() * 2200 : 0,
    wasteDropped: !dropsWaste
  });
}

function spawnWaste(x, y) {
  state.wastes.push({
    x, y,
    vx: (Math.random() - 0.5) * 25,
    vy: 40 + Math.random() * 30,
    rot: 0,
    vrot: (Math.random() - 0.5) * 5,
    life: 3.5,
    landed: false,
    landY: 0
  });
}

// === Federn-Partikel ===
function spawnFeathers(x, y, color) {
  for (let i = 0; i < 14; i++) {
    state.feathers.push({
      x, y,
      vx: (Math.random() - 0.5) * 240,
      vy: (Math.random() - 0.5) * 200 - 40,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 8,
      life: 1.4,
      color
    });
  }
}

function spawnPopup(x, y, text, color, life) {
  state.popups.push({
    x, y, text, color,
    life: life || 0.9,
    maxLife: life || 0.9
  });
}

// === Update ===
function update(dt) {
  if (!state.running) return;

  // Timer
  const elapsed = (performance.now() - state.startTime) / 1000;
  state.timeLeft = Math.max(0, GAME_DURATION - elapsed);
  timerEl.textContent = Math.ceil(state.timeLeft);
  if (state.timeLeft <= 0) {
    endGame();
    return;
  }

  // Schwierigkeit steigt mit der Zeit (Spawn-Rate hoch)
  const difficulty = 1 + (1 - state.timeLeft / GAME_DURATION) * 1.2;
  state.spawnTimer -= dt * difficulty;
  if (state.spawnTimer <= 0) {
    spawnChicken();
    state.spawnTimer = 0.45 + Math.random() * 0.6;
  }
  // Geplante Diamanthuhn-Spawns (1–3 pro Runde, garantiert mindestens einer)
  for (const ds of state.diamondSpawns) {
    if (!ds.spawned && elapsed >= ds.time) {
      spawnChicken('diamond');
      ds.spawned = true;
    }
  }
  // Cooldown
  if (state.shotCooldown > 0) state.shotCooldown -= dt;

  // Hühner bewegen
  for (let i = state.chickens.length - 1; i >= 0; i--) {
    const ch = state.chickens[i];
    if (ch.dead) {
      // Fällt mit Schwerkraft
      ch.vy += 600 * dt;
      ch.x += ch.vx * 0.3 * dt;
      ch.y += ch.vy * dt;
      ch.flapPhase += dt * 4;
      if (ch.y > H + 40) state.chickens.splice(i, 1);
    } else {
      ch.x += ch.vx * dt;
      ch.bobPhase += dt * 6;
      ch.y += Math.sin(ch.bobPhase) * 8 * dt + ch.vy * dt;
      ch.vy *= 0.95;
      ch.flapPhase += dt * 18;
      // Witz-Abwurf: nur einmal pro Huhn, falls geplant
      if (!ch.wasteDropped && performance.now() >= ch.wasteDropAt) {
        spawnWaste(ch.x, ch.y + ch.size * 0.4);
        ch.wasteDropped = true;
      }
      // Außerhalb? Entfernen
      if ((ch.dir > 0 && ch.x > W + ch.size) || (ch.dir < 0 && ch.x < -ch.size)) {
        state.chickens.splice(i, 1);
      }
    }
  }

  // Federn
  for (let i = state.feathers.length - 1; i >= 0; i--) {
    const f = state.feathers[i];
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vy += 200 * dt;
    f.vx *= 0.98;
    f.rot += f.vrot * dt;
    f.life -= dt;
    if (f.life <= 0) state.feathers.splice(i, 1);
  }

  // Abwurf-Partikel (der Witz)
  const groundY = H - 50;
  for (let i = state.wastes.length - 1; i >= 0; i--) {
    const w = state.wastes[i];
    if (!w.landed) {
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.vy += 600 * dt;
      w.vx *= 0.99;
      w.rot += w.vrot * dt;
      if (w.y >= groundY) {
        w.y = groundY;
        w.landed = true;
        w.landY = groundY;
        w.life = 1.6; // nach der Landung kurz liegen bleiben
      }
    } else {
      w.life -= dt;
      if (w.life <= 0) state.wastes.splice(i, 1);
    }
  }

  // Popups
  for (let i = state.popups.length - 1; i >= 0; i--) {
    const p = state.popups[i];
    p.life -= dt;
    p.y -= 30 * dt;
    if (p.life <= 0) state.popups.splice(i, 1);
  }
}

// === Render ===
function render() {
  // Himmel
  drawSky();

  // Wolken (statisch)
  drawClouds();

  // Hühner
  for (const ch of state.chickens) drawChicken(ch);

  // Federn
  for (const f of state.feathers) drawFeather(f);

  // Abwurf-Partikel
  for (const w of state.wastes) drawWaste(w);

  // Popups
  for (const p of state.popups) drawPopup(p);

  // Boden mit Bäumen (unten)
  drawHorizon();

  // Zielfernrohr
  if (state.running) {
    drawScope(state.mouse.x, state.mouse.y);
  }
}

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#3aa6e0');
  grad.addColorStop(0.6, '#87ceeb');
  grad.addColorStop(1, '#cfeefa');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Sonne
  ctx.fillStyle = 'rgba(255, 248, 200, 0.85)';
  ctx.beginPath();
  ctx.arc(W * 0.85, H * 0.18, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 200, 0.4)';
  ctx.beginPath();
  ctx.arc(W * 0.85, H * 0.18, 60, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds() {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  drawCloud(120, 90, 36);
  drawCloud(380, 140, 28);
  drawCloud(680, 70, 42);
  drawCloud(820, 200, 24);
  drawCloud(220, 240, 30);
  drawCloud(500, 220, 26);
}

function drawCloud(cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.8, cy - r * 0.2, r * 0.85, 0, Math.PI * 2);
  ctx.arc(cx + r * 1.5, cy + r * 0.1, r * 0.7, 0, Math.PI * 2);
  ctx.arc(cx - r * 0.7, cy + r * 0.1, r * 0.65, 0, Math.PI * 2);
  ctx.fill();
}

function drawHorizon() {
  // Hügel
  const horizonY = H - 100;
  ctx.fillStyle = '#5a8c3a';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, horizonY + 20);
  ctx.quadraticCurveTo(W * 0.15, horizonY - 30, W * 0.35, horizonY);
  ctx.quadraticCurveTo(W * 0.55, horizonY + 30, W * 0.75, horizonY - 10);
  ctx.quadraticCurveTo(W * 0.9, horizonY - 30, W, horizonY + 10);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  // Stadt (hinter den Bäumen, auf den Hügeln)
  drawCity(horizonY);
  // Bäume
  drawTree(80, horizonY + 4);
  drawTree(280, horizonY + 22);
  drawTree(540, horizonY + 18);
  drawTree(720, horizonY - 4);
  drawTree(880, horizonY + 14);
  // Vordergrund-Wiese
  ctx.fillStyle = '#4a7c2a';
  ctx.fillRect(0, H - 50, W, 50);
  // Grashalme
  ctx.strokeStyle = '#3a6a1a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 30; i++) {
    const gx = (i * 31) % W;
    ctx.beginPath();
    ctx.moveTo(gx, H - 50);
    ctx.lineTo(gx + 3, H - 60);
    ctx.stroke();
  }
}

function drawCity(horizonY) {
  // Drei Läden auf dem Hügel, gleichmäßig verteilt zwischen den Bäumen
  drawBuilding(180, horizonY + 6, 'Amartis Milk shake bar', '#fff5e6', '#f4a8c5', '#8a3a4a');
  drawBuilding(430, horizonY + 6, 'Hanos Angelladen',       '#bcd9ef', '#2c5f8d', '#3a4a6a');
  drawBuilding(810, horizonY + 6, 'Jos Spaeti',             '#ffe066', '#e63946', '#5a3a1a');
}

function drawBuilding(cx, baseY, name, wallColor, accentColor, roofColor) {
  ctx.save();
  const w = 110;
  const h = 48;
  const x = cx - w / 2;
  const y = baseY - h;

  // Mauerwerk
  ctx.fillStyle = wallColor;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, y, w, h);

  // Dach (Trapez mit Überhang)
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + 4, y - 10);
  ctx.lineTo(x + w - 4, y - 10);
  ctx.lineTo(x + w + 6, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tür
  const doorW = 14, doorH = 20;
  ctx.fillStyle = accentColor;
  ctx.fillRect(cx - doorW / 2, y + h - doorH, doorW, doorH);
  ctx.strokeRect(cx - doorW / 2, y + h - doorH, doorW, doorH);
  // Türknauf
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(cx + doorW / 2 - 3, y + h - doorH / 2, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Zwei Fenster
  ctx.fillStyle = '#bce8ff';
  ctx.fillRect(x + 10, y + 12, 18, 12);
  ctx.fillRect(x + w - 28, y + 12, 18, 12);
  ctx.strokeStyle = '#3a2a1a';
  ctx.strokeRect(x + 10, y + 12, 18, 12);
  ctx.strokeRect(x + w - 28, y + 12, 18, 12);
  // Fensterkreuze
  ctx.beginPath();
  ctx.moveTo(x + 19, y + 12); ctx.lineTo(x + 19, y + 24);
  ctx.moveTo(x + 10, y + 18); ctx.lineTo(x + 28, y + 18);
  ctx.moveTo(x + w - 19, y + 12); ctx.lineTo(x + w - 19, y + 24);
  ctx.moveTo(x + w - 28, y + 18); ctx.lineTo(x + w - 10, y + 18);
  ctx.stroke();

  // Schild über dem Dach
  const signY = y - 26;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 4, signY, w - 8, 14);
  ctx.strokeRect(x + 4, signY, w - 8, 14);
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, cx, signY + 7);

  ctx.restore();
}

function drawTree(x, baseY) {
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x - 3, baseY - 18, 6, 22);
  ctx.fillStyle = '#3a8c3a';
  ctx.beginPath();
  ctx.arc(x, baseY - 26, 14, 0, Math.PI * 2);
  ctx.arc(x - 8, baseY - 18, 10, 0, Math.PI * 2);
  ctx.arc(x + 8, baseY - 20, 11, 0, Math.PI * 2);
  ctx.fill();
}

// === Huhn zeichnen ===
function drawChicken(ch) {
  ctx.save();
  ctx.translate(ch.x, ch.y);
  if (ch.dead) {
    ctx.rotate((performance.now() - ch.deathTime) / 200);
  } else if (ch.dir < 0) {
    ctx.scale(-1, 1);
  }

  const s = ch.size;
  const flap = Math.sin(ch.flapPhase);

  // Körper
  ctx.fillStyle = ch.def.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.6, s * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ch.type === 'gold' ? '#a07000' : '#1a1a2e';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glanz bei goldenem Huhn
  if (ch.type === 'gold') {
    ctx.fillStyle = 'rgba(255, 255, 200, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.15, -s * 0.15, s * 0.25, s * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Diamant-Facetten und starker Glanz (jetzt in Rubin-Rot)
  if (ch.type === 'diamond') {
    // Facetten-Linien über Körper
    ctx.strokeStyle = 'rgba(255, 180, 190, 0.75)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, 0);
    ctx.lineTo(s * 0.5, 0);
    ctx.moveTo(-s * 0.3, -s * 0.35);
    ctx.lineTo(s * 0.3, s * 0.3);
    ctx.moveTo(-s * 0.3, s * 0.3);
    ctx.lineTo(s * 0.3, -s * 0.35);
    ctx.stroke();
    // Großer Lichtreflex
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.2, -s * 0.18, s * 0.18, s * 0.08, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 220, 220, 0.55)';
    ctx.beginPath();
    ctx.ellipse(s * 0.15, s * 0.05, s * 0.1, s * 0.05, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Schwanzfedern (hinten = links)
  ctx.fillStyle = ch.def.color;
  ctx.beginPath();
  ctx.moveTo(-s * 0.55, 0);
  ctx.lineTo(-s * 0.95, -s * 0.3);
  ctx.lineTo(-s * 1.0, -s * 0.05);
  ctx.lineTo(-s * 0.95, s * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Flügel (flap)
  ctx.fillStyle = ch.type === 'gold' ? '#fff3a0' : (ch.type === 'brown' ? '#7a4520' : '#e0e0e0');
  ctx.save();
  ctx.translate(-s * 0.05, -s * 0.05);
  ctx.rotate(flap * 0.5);
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.2 - flap * 6, s * 0.32, s * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ch.type === 'gold' ? '#a07000' : '#1a1a2e';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Flügel-Linien
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.4 - flap * 6);
  ctx.lineTo(0, s * 0.1 - flap * 6);
  ctx.stroke();
  ctx.restore();

  // Kopf (vorne = rechts)
  ctx.fillStyle = ch.def.color;
  ctx.beginPath();
  ctx.arc(s * 0.5, -s * 0.35, s * 0.27, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ch.type === 'gold' ? '#a07000' : '#1a1a2e';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Kamm (rot)
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.moveTo(s * 0.4, -s * 0.55);
  ctx.lineTo(s * 0.45, -s * 0.7);
  ctx.lineTo(s * 0.5, -s * 0.55);
  ctx.lineTo(s * 0.55, -s * 0.7);
  ctx.lineTo(s * 0.6, -s * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5a0a14';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Schnabel (orange)
  ctx.fillStyle = '#ff8c1a';
  ctx.beginPath();
  ctx.moveTo(s * 0.7, -s * 0.32);
  ctx.lineTo(s * 0.92, -s * 0.28);
  ctx.lineTo(s * 0.7, -s * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Auge
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(s * 0.55, -s * 0.4, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(s * 0.56, -s * 0.41, 1, 0, Math.PI * 2);
  ctx.fill();

  // Wattle (rote Hautlappen unter Schnabel)
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.ellipse(s * 0.66, -s * 0.18, s * 0.05, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5a0a14';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Beine (nicht bei totem Huhn)
  if (!ch.dead) {
    ctx.strokeStyle = '#ff8c1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, s * 0.4);
    ctx.lineTo(-s * 0.15, s * 0.6);
    ctx.moveTo(s * 0.15, s * 0.4);
    ctx.lineTo(s * 0.18, s * 0.6);
    ctx.stroke();
    // Krallen
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, s * 0.6);
    ctx.lineTo(-s * 0.22, s * 0.62);
    ctx.moveTo(-s * 0.15, s * 0.6);
    ctx.lineTo(-s * 0.08, s * 0.62);
    ctx.moveTo(s * 0.18, s * 0.6);
    ctx.lineTo(s * 0.11, s * 0.62);
    ctx.moveTo(s * 0.18, s * 0.6);
    ctx.lineTo(s * 0.25, s * 0.62);
    ctx.stroke();
  }

  // X über totem Huhn-Auge
  if (ch.dead) {
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -s * 0.46);
    ctx.lineTo(s * 0.6, -s * 0.34);
    ctx.moveTo(s * 0.6, -s * 0.46);
    ctx.lineTo(s * 0.5, -s * 0.34);
    ctx.stroke();
  }

  ctx.restore();

  // Diamant-Sparkles um lebendes Huhn herum (rot getönt)
  if (ch.type === 'diamond' && !ch.dead) {
    const t = performance.now() / 1000;
    for (let i = 0; i < 4; i++) {
      const phase = t * 4 + i * 1.6;
      const sx2 = ch.x + Math.cos(phase) * (s * 0.9) + Math.sin(phase * 1.3) * 6;
      const sy2 = ch.y + Math.sin(phase) * (s * 0.7);
      const sz = 2 + Math.abs(Math.sin(phase * 2)) * 3;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(sx2, sy2 - sz);
      ctx.lineTo(sx2 + sz * 0.3, sy2);
      ctx.lineTo(sx2, sy2 + sz);
      ctx.lineTo(sx2 - sz * 0.3, sy2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff7a8a';
      ctx.beginPath();
      ctx.arc(sx2, sy2, sz * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFeather(f) {
  const alpha = Math.min(1, f.life / 1.4);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(f.x, f.y);
  ctx.rotate(f.rot);
  ctx.fillStyle = f.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // Mittellinie
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.stroke();
  ctx.restore();
}

function drawWaste(w) {
  ctx.save();
  if (w.landed) {
    // Auf dem Boden: flacher Klecks mit Fade-out
    const alpha = Math.min(1, w.life / 1.6);
    ctx.globalAlpha = alpha;
    ctx.translate(w.x, w.y);
    ctx.fillStyle = '#5a3a1a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 1.5, 7, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Im Fall: kleines braunes Tröpfchen, leicht rotierend
    ctx.translate(w.x, w.y);
    ctx.rotate(w.rot);
    ctx.fillStyle = '#6b4423';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(-0.8, -1.4, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPopup(p) {
  const alpha = Math.min(1, p.life / p.maxLife);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 4;
  ctx.strokeText(p.text, p.x, p.y);
  ctx.fillText(p.text, p.x, p.y);
  ctx.restore();
}

// === Zielfernrohr ===
function drawScope(x, y) {
  const r = 110;
  // Vignette außen — alles abdunkeln, Innenkreis frei
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(x, y, r, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();
  ctx.restore();

  // Linsenrand (dicker schwarzer Ring)
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1a1a2e';
  ctx.stroke();

  // Innerer dünner Ring (Goldring)
  ctx.beginPath();
  ctx.arc(x, y, r - 5, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffd700';
  ctx.stroke();

  // Lichtreflex auf der Linse
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 6, 0, Math.PI * 2);
  ctx.clip();
  const reflex = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 4, x - r * 0.4, y - r * 0.4, r * 0.6);
  reflex.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
  reflex.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = reflex;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  // Fadenkreuz
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineWidth = 1.5;
  // Horizontal
  ctx.beginPath();
  ctx.moveTo(x - r + 8, y);
  ctx.lineTo(x - 12, y);
  ctx.moveTo(x + 12, y);
  ctx.lineTo(x + r - 8, y);
  ctx.stroke();
  // Vertikal
  ctx.beginPath();
  ctx.moveTo(x, y - r + 8);
  ctx.lineTo(x, y - 12);
  ctx.moveTo(x, y + 12);
  ctx.lineTo(x, y + r - 8);
  ctx.stroke();

  // Skalenstriche
  ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const off = i * 14;
    // Horizontal
    ctx.beginPath();
    ctx.moveTo(x + off, y - 4);
    ctx.lineTo(x + off, y + 4);
    ctx.stroke();
    // Vertikal
    ctx.beginPath();
    ctx.moveTo(x - 4, y + off);
    ctx.lineTo(x + 4, y + off);
    ctx.stroke();
  }

  // Mitteldot
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Cooldown-Indikator (Rückstoß): dünner Ring darunter
  if (state.shotCooldown > 0) {
    ctx.beginPath();
    ctx.arc(x, y, r - 12, -Math.PI / 2, -Math.PI / 2 + (state.shotCooldown / 0.18) * Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(230, 57, 70, 0.7)';
    ctx.stroke();
  }
}

// === Game-Loop ===
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
