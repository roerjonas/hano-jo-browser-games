// === Banküberfall ===

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// === Konstanten ===
const CAR_ACCEL = 360;
const CAR_FRICTION = 1.5;
const CAR_MAX_SPEED = 290;
const COP_MAX_SPEED = 290;
const COP_ACCEL = 340;
const COP_FRICTION = 1.5;
const COP_HIT_RADIUS = 30;
const HEART_SPEED = 420;
const HEART_HIT_RADIUS = 22;
const HEART_LIFETIME = 2.0;
const HEART_COOLDOWN = 0.18;
const COPS_PER_ROBBERY = 3;
const CAUGHT_PENALTY = 25;
const BANK_COOLDOWN = 14;
const CHASE_GRACE_PERIOD = 2;        // Sekunden Vorsprung
const COP_CHASE_SPAWN_INTERVAL = 10; // alle 10 Sekunden ein neues Polizeiauto
const ROADBLOCK_SPAWN_INTERVAL = 3.5;
const ROADBLOCK_RADIUS = 22;

// === Spielzustand ===
const STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  ROBBERY: 'robbery',
  CAUGHT: 'caught',
};

let gameState = STATE.MENU;
let money = 0;
let banksRobbed = 0;
let pendingRobbery = null;

let car = null;
let cops = [];
let bullets = [];
let bulletCooldown = 0;

// Verfolgungsjagd
let chaseActive = false;
let chaseGracePeriod = 0;
let chaseElapsed = 0;          // Sekunden überlebt
let copChaseSpawnTimer = 0;    // Timer für periodisch neue Polizeiautos
let roadblocks = [];
let roadblockSpawnTimer = 0;

// Toast-Nachricht (z. B. "Geschafft!")
let toastMessage = null;
let toastTimer = 0;
let toastColor = '#a3e635';

// === Stadt-Layout ===
// Straßenraster: 4 horizontal × 5 vertikal, je 44px breit
// H-Straßen: y=55, 215, 375, 535   V-Straßen: x=65, 255, 445, 635, 825
const ROADS = [
  { x: 0,   y: 55,  w: W,  h: 44 },  // H1
  { x: 0,   y: 215, w: W,  h: 44 },  // H2
  { x: 0,   y: 375, w: W,  h: 44 },  // H3
  { x: 0,   y: 535, w: W,  h: 44 },  // H4
  { x: 65,  y: 0,   w: 44, h: H },   // V1
  { x: 255, y: 0,   w: 44, h: H },   // V2
  { x: 445, y: 0,   w: 44, h: H },   // V3
  { x: 635, y: 0,   w: 44, h: H },   // V4
  { x: 825, y: 0,   w: 44, h: H },   // V5
];

// Blöcke zwischen den Straßen:
//  Spalten (x): 113–251, 303–441, 493–631, 683–821, 873–956
//  Zeilen  (y): 103–211, 263–371, 423–531
const BUILDINGS = [
  // === ZEILE 1 (y: 103–211) ===

  // Spalte 1 — linker Teil neben Bank 1
  { x: 195, y: 107, w: 52, h: 66, color: '#8fa3b8' },  // Glas-Hochhaus
  { x: 117, y: 182, w: 130, h: 26, color: '#9b8e7a' }, // Flachbau drunter

  // Spalte 2
  { x: 303, y: 107, w: 58, h: 60, color: '#8b6f47' },
  { x: 367, y: 107, w: 70, h: 46, color: '#a98c5b' },
  { x: 303, y: 173, w: 58, h: 34, color: '#7a5e3d' },
  { x: 367, y: 159, w: 70, h: 48, color: '#c4a882' },

  // Spalte 3
  { x: 493, y: 107, w: 134, h: 46, color: '#8fa3b8' }, // Großes Bürogebäude
  { x: 493, y: 159, w: 62, h: 48, color: '#9b7f4d' },
  { x: 561, y: 159, w: 66, h: 48, color: '#a0826d' },

  // Spalte 4
  { x: 683, y: 107, w: 60, h: 56, color: '#7d9a7d' },  // grünes Gebäude
  { x: 749, y: 107, w: 68, h: 70, color: '#8b6f47' },
  { x: 683, y: 169, w: 60, h: 38, color: '#c4a882' },

  // Spalte 5 (schmal, x: 873–956)
  { x: 873, y: 107, w: 80, h: 52, color: '#9b9080' },
  { x: 873, y: 165, w: 80, h: 42, color: '#8b6f47' },

  // === ZEILE 2 (y: 263–371) ===

  // Spalte 1
  { x: 113, y: 267, w: 62, h: 54, color: '#a98c5b' },
  { x: 181, y: 267, w: 66, h: 46, color: '#8b6f47' },
  { x: 113, y: 327, w: 130, h: 40, color: '#6b5a4e' },

  // Spalte 2 — großes Lager
  { x: 303, y: 267, w: 134, h: 68, color: '#9b8e7a' },
  { x: 303, y: 341, w: 62, h: 26, color: '#7a5e3d' },
  { x: 371, y: 341, w: 66, h: 26, color: '#8b6f47' },

  // Spalte 3 — neben Bank 2
  { x: 577, y: 267, w: 50, h: 66, color: '#8fa3b8' },
  { x: 499, y: 342, w: 76, h: 25, color: '#9b7f4d' },
  { x: 577, y: 339, w: 50, h: 28, color: '#a98c5b' },

  // Spalte 4
  { x: 683, y: 267, w: 60, h: 58, color: '#c4a882' },
  { x: 749, y: 267, w: 68, h: 46, color: '#8b6f47' },
  { x: 683, y: 331, w: 60, h: 36, color: '#9b7f4d' },
  { x: 749, y: 319, w: 68, h: 48, color: '#7a5e3d' },

  // Spalte 5
  { x: 873, y: 267, w: 80, h: 68, color: '#a98c5b' },
  { x: 873, y: 341, w: 80, h: 26, color: '#8b6f47' },

  // === ZEILE 3 (y: 423–531) ===

  // Spalte 1
  { x: 113, y: 427, w: 62, h: 58, color: '#8b6f47' },
  { x: 181, y: 427, w: 66, h: 46, color: '#9b7f4d' },
  { x: 113, y: 491, w: 62, h: 36, color: '#a98c5b' },
  { x: 181, y: 479, w: 66, h: 48, color: '#7a5e3d' },

  // Spalte 2
  { x: 303, y: 427, w: 58, h: 54, color: '#6b5a4e' },
  { x: 367, y: 427, w: 70, h: 42, color: '#c4a882' },
  { x: 303, y: 487, w: 58, h: 40, color: '#9b8e7a' },
  { x: 367, y: 475, w: 70, h: 52, color: '#8b6f47' },

  // Spalte 3
  { x: 493, y: 427, w: 58, h: 68, color: '#8fa3b8' }, // Hochhaus
  { x: 557, y: 427, w: 70, h: 48, color: '#a0826d' },
  { x: 557, y: 481, w: 70, h: 46, color: '#9b7f4d' },

  // Spalte 4 — neben Bank 3
  { x: 765, y: 427, w: 52, h: 66, color: '#8b6f47' },
  { x: 689, y: 501, w: 76, h: 26, color: '#a98c5b' },
  { x: 765, y: 499, w: 52, h: 28, color: '#7a5e3d' },

  // Spalte 5
  { x: 873, y: 427, w: 80, h: 52, color: '#9b9080' },
  { x: 873, y: 485, w: 80, h: 42, color: '#8b6f47' },
];

let banks = [
  { id: 1, x: 117, y: 107, w: 70, h: 66, ready: true, cooldown: 0, wasIn: false },
  { id: 2, x: 493, y: 267, w: 70, h: 66, ready: true, cooldown: 0, wasIn: false },
  { id: 3, x: 683, y: 427, w: 70, h: 66, ready: true, cooldown: 0, wasIn: false },
];

// Bäume in Randstreifen und Blockecken
const TREES = [
  // oberer Randstreifen (y=0–55)
  { x: 32,  y: 28 }, { x: 165, y: 22 }, { x: 350, y: 28 },
  { x: 540, y: 22 }, { x: 738, y: 28 }, { x: 938, y: 24 },
  // unterer Randstreifen (y=579–640)
  { x: 32,  y: 608 }, { x: 170, y: 612 }, { x: 355, y: 607 },
  { x: 545, y: 612 }, { x: 740, y: 607 }, { x: 935, y: 610 },
  // linker Randstreifen (x=0–65)
  { x: 38, y: 160 }, { x: 38, y: 320 }, { x: 38, y: 478 },
  // Ecken zwischen Blöcken
  { x: 255, y: 215 }, { x: 445, y: 215 }, { x: 635, y: 215 },
  { x: 255, y: 375 }, { x: 445, y: 375 }, { x: 635, y: 375 },
  // Ein kleiner Park (Spalte 2 / Zeile 2 Ecke)
  { x: 440, y: 340 }, { x: 460, y: 358 },
];

// === Eingabe ===
const keys = {};

window.addEventListener('keydown', (e) => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
    e.preventDefault();
  }
  if (e.repeat) return;
  if (e.key === ' ' && gameState === STATE.PLAYING) {
    shootBullet();
  } else if (e.key === 'Enter' && gameState === STATE.MENU) {
    startGame();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

function isLeft()  { return keys['arrowleft']  || keys['a']; }
function isRight() { return keys['arrowright'] || keys['d']; }
function isUp()    { return keys['arrowup']    || keys['w']; }
function isDown()  { return keys['arrowdown']  || keys['s']; }

// === DOM ===
const $ = (id) => document.getElementById(id);
const OVERLAYS = ['overlay-menu', 'overlay-rob', 'overlay-caught'];

function showOverlay(id) {
  OVERLAYS.forEach(o => $(o).classList.toggle('hidden', o !== id));
}

function hideOverlays() {
  OVERLAYS.forEach(o => $(o).classList.add('hidden'));
}

// === Spielablauf ===
function startGame() {
  money = 0;
  banksRobbed = 0;
  car = {
    x: 467,  // Kreuzung V3 × H3
    y: 397,
    vx: 0,
    vy: 0,
    angle: 0,
  };
  cops = [];
  bullets = [];
  bulletCooldown = 0;
  banks.forEach(b => { b.ready = true; b.cooldown = 0; b.wasIn = false; });
  pendingRobbery = null;
  chaseActive = false;
  chaseGracePeriod = 0;
  chaseElapsed = 0;
  copChaseSpawnTimer = 0;
  roadblocks = [];
  roadblockSpawnTimer = 0;
  toastMessage = null;
  toastTimer = 0;
  hideOverlays();
  gameState = STATE.PLAYING;
  updateHUD();
}

function updateHUD() {
  $('money-total').textContent = money;
  $('banks-robbed').textContent = banksRobbed;
  $('cops-active').textContent = cops.filter(c => !c.defeated).length;
  const cs = $('chase-status');
  if (chaseActive) {
    cs.classList.remove('hidden');
    $('chase-timer').textContent = Math.floor(chaseElapsed);
  } else {
    cs.classList.add('hidden');
  }
}

// === Auto ===
function updateCar(dt) {
  let ax = 0, ay = 0;
  if (isLeft())  ax -= 1;
  if (isRight()) ax += 1;
  if (isUp())    ay -= 1;
  if (isDown())  ay += 1;

  const mag = Math.hypot(ax, ay);
  if (mag > 0) { ax /= mag; ay /= mag; }

  car.vx += ax * CAR_ACCEL * dt;
  car.vy += ay * CAR_ACCEL * dt;

  const fr = Math.exp(-CAR_FRICTION * dt);
  car.vx *= fr;
  car.vy *= fr;

  const sp = Math.hypot(car.vx, car.vy);
  if (sp > CAR_MAX_SPEED) {
    car.vx = (car.vx / sp) * CAR_MAX_SPEED;
    car.vy = (car.vy / sp) * CAR_MAX_SPEED;
  }

  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Spielfeld-Grenzen
  const m = 24;
  if (car.x < m)         { car.x = m;         car.vx = 0; }
  if (car.x > W - m)     { car.x = W - m;     car.vx = 0; }
  if (car.y < m)         { car.y = m;         car.vy = 0; }
  if (car.y > H - m)     { car.y = H - m;     car.vy = 0; }

  if (sp > 5) car.angle = Math.atan2(car.vy, car.vx);
}

// === Banken ===
function updateBanks(dt) {
  for (const bank of banks) {
    if (!bank.ready) {
      bank.cooldown -= dt;
      if (bank.cooldown <= 0) bank.ready = true;
    }
  }
}

function checkBankTrigger() {
  for (const bank of banks) {
    const inside = car.x > bank.x - 5 && car.x < bank.x + bank.w + 5 &&
                   car.y > bank.y - 5 && car.y < bank.y + bank.h + 5;
    if (inside && !bank.wasIn && bank.ready && !chaseActive) {
      openRobbery(bank);
    }
    bank.wasIn = inside;
  }
}

function openRobbery(bank) {
  gameState = STATE.ROBBERY;

  // Zufällige Scheine generieren
  const denominations = [5, 10, 20, 50, 100];
  const count = 3 + Math.floor(Math.random() * 4); // 3-6 Scheine
  const bills = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const value = denominations[Math.floor(Math.random() * denominations.length)];
    bills.push(value);
    total += value;
  }

  pendingRobbery = { bank, bills, total };

  // Im DOM darstellen
  $('rob-title').textContent = `Jo Banking überfallen!`;
  const billsEl = $('rob-bills');
  billsEl.innerHTML = '';
  for (const value of bills) {
    const billEl = document.createElement('div');
    billEl.className = 'bill b' + value;
    billEl.textContent = value + '€';
    billEl.style.setProperty('--rot', (Math.random() * 16 - 8).toFixed(1) + 'deg');
    billsEl.appendChild(billEl);
  }

  $('rob-input').value = '';
  const fb = $('rob-feedback');
  fb.textContent = '\u00a0';
  fb.className = '';

  showOverlay('overlay-rob');
  setTimeout(() => $('rob-input').focus(), 50);
}

function attemptRob() {
  if (!pendingRobbery) return;
  const input = $('rob-input');
  const fb = $('rob-feedback');
  const answer = parseInt(input.value, 10);
  if (isNaN(answer)) {
    fb.textContent = 'Bitte eine Zahl eingeben!';
    fb.className = 'error';
    input.focus();
    return;
  }
  if (answer === pendingRobbery.total) {
    money += pendingRobbery.total;
    banksRobbed++;
    fb.textContent = `Richtig! +${pendingRobbery.total}€  —  flieh, gleich kommt die Polizei!`;
    fb.className = 'success';
    pendingRobbery.bank.ready = false;
    pendingRobbery.bank.cooldown = BANK_COOLDOWN;
    startChase();
    setTimeout(() => closeRobbery(), 1400);
  } else {
    fb.textContent = 'Hmm, das ist nicht richtig. Zähl nochmal!';
    fb.className = 'error';
    input.select();
  }
}

function closeRobbery() {
  $('rob-input').blur();
  pendingRobbery = null;
  hideOverlays();
  gameState = STATE.PLAYING;
  updateHUD();
}

// === Verfolgungsjagd ===
function startChase() {
  chaseActive = true;
  chaseGracePeriod = CHASE_GRACE_PERIOD;
  chaseElapsed = 0;
  copChaseSpawnTimer = COP_CHASE_SPAWN_INTERVAL;
  roadblockSpawnTimer = ROADBLOCK_SPAWN_INTERVAL;
}

function spawnOneCopFromEdge() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0)      { x = Math.random() * W; y = -30; }
  else if (side === 1) { x = W + 30; y = Math.random() * H; }
  else if (side === 2) { x = Math.random() * W; y = H + 30; }
  else                 { x = -30; y = Math.random() * H; }
  cops.push({ x, y, vx: 0, vy: 0, angle: 0, defeated: false, defeatedTimer: 0 });
}

function spawnCopsFromEdge() {
  for (let i = 0; i < COPS_PER_ROBBERY; i++) spawnOneCopFromEdge();
}

// Straßensperren spawnen "vor" dem Spieler
function spawnRoadblockNearPlayer() {
  if (!car) return;
  // Richtung in die das Auto gerade fährt (oder zufällig wenn fast still)
  let angle;
  if (Math.hypot(car.vx, car.vy) > 30) {
    angle = Math.atan2(car.vy, car.vx);
  } else {
    angle = Math.random() * Math.PI * 2;
  }
  // 150-260 Pixel vor dem Auto
  const dist = 150 + Math.random() * 110;
  let x = car.x + Math.cos(angle) * dist;
  let y = car.y + Math.sin(angle) * dist;
  // Innerhalb der Karte halten
  x = Math.max(40, Math.min(W - 40, x));
  y = Math.max(40, Math.min(H - 40, y));
  // Nicht auf eine bestehende Sperre platzieren
  for (const rb of roadblocks) {
    if (Math.hypot(rb.x - x, rb.y - y) < 60) return;
  }
  // Nicht direkt auf einer Bank platzieren
  for (const bank of banks) {
    if (x > bank.x - 10 && x < bank.x + bank.w + 10 &&
        y > bank.y - 10 && y < bank.y + bank.h + 10) return;
  }
  roadblocks.push({
    x, y,
    angle: Math.random() * Math.PI,
    spawnTime: Date.now(),
  });
}

function checkRoadblockCollision() {
  for (const rb of roadblocks) {
    const dx = car.x - rb.x;
    const dy = car.y - rb.y;
    const dist = Math.hypot(dx, dy);
    const minDist = ROADBLOCK_RADIUS + 22; // Sperre + halbe Auto-Breite
    if (dist < minDist && dist > 0.001) {
      const push = minDist - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      car.x += nx * push;
      car.y += ny * push;
      // Geschwindigkeit in Richtung der Sperre auf 0 setzen
      const into = car.vx * (-nx) + car.vy * (-ny);
      if (into > 0) {
        car.vx += nx * into;
        car.vy += ny * into;
      }
    }
  }
}

function updateChase(dt) {
  if (!chaseActive) return;

  if (chaseGracePeriod > 0) {
    chaseGracePeriod -= dt;
    if (chaseGracePeriod <= 0) {
      spawnCopsFromEdge();
    }
    return;
  }

  // Zeit hochzählen
  chaseElapsed += dt;

  // Straßensperren spawnen
  roadblockSpawnTimer -= dt;
  if (roadblockSpawnTimer <= 0) {
    roadblockSpawnTimer = ROADBLOCK_SPAWN_INTERVAL;
    spawnRoadblockNearPlayer();
  }

  // Alle 10 Sekunden ein neues Polizeiauto
  copChaseSpawnTimer -= dt;
  if (copChaseSpawnTimer <= 0) {
    copChaseSpawnTimer = COP_CHASE_SPAWN_INTERVAL;
    spawnOneCopFromEdge();
  }
}

function endChase() {
  chaseActive = false;
  chaseGracePeriod = 0;
  chaseElapsed = 0;
  copChaseSpawnTimer = 0;
  cops = [];
  roadblocks = [];
  updateHUD();
}

// === Polizei ===

function updateCops(dt) {
  for (const cop of cops) {
    if (cop.defeated) {
      // Verliebt — langsam ausrollen
      cop.defeatedTimer += dt;
      cop.vx *= 0.88;
      cop.vy *= 0.88;
      cop.x += cop.vx * dt;
      cop.y += cop.vy * dt;
      continue;
    }

    // Verfolgung
    const dx = car.x - cop.x;
    const dy = car.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 5) {
      cop.vx += (dx / dist) * COP_ACCEL * dt;
      cop.vy += (dy / dist) * COP_ACCEL * dt;
    }

    const fr = Math.exp(-COP_FRICTION * dt);
    cop.vx *= fr;
    cop.vy *= fr;

    const sp = Math.hypot(cop.vx, cop.vy);
    if (sp > COP_MAX_SPEED) {
      cop.vx = (cop.vx / sp) * COP_MAX_SPEED;
      cop.vy = (cop.vy / sp) * COP_MAX_SPEED;
    }

    cop.x += cop.vx * dt;
    cop.y += cop.vy * dt;
    if (sp > 5) cop.angle = Math.atan2(cop.vy, cop.vx);

    const m = 18;
    if (cop.x < m)     { cop.x = m;     cop.vx = -cop.vx * 0.5; }
    if (cop.x > W - m) { cop.x = W - m; cop.vx = -cop.vx * 0.5; }
    if (cop.y < m)     { cop.y = m;     cop.vy = -cop.vy * 0.5; }
    if (cop.y > H - m) { cop.y = H - m; cop.vy = -cop.vy * 0.5; }
  }
}

function checkCopCollision() {
  for (const cop of cops) {
    if (cop.defeated) continue;
    const d = Math.hypot(cop.x - car.x, cop.y - car.y);
    if (d < COP_HIT_RADIUS) {
      caught();
      return;
    }
  }
}

function caught() {
  const penalty = Math.min(money, CAUGHT_PENALTY);
  money -= penalty;
  const survived = Math.floor(chaseElapsed);
  cops = [];
  roadblocks = [];
  chaseActive = false;
  chaseGracePeriod = 0;
  chaseElapsed = 0;
  copChaseSpawnTimer = 0;
  $('caught-penalty').textContent = penalty;
  $('caught-survived').textContent = survived;
  showOverlay('overlay-caught');
  gameState = STATE.CAUGHT;
  flashScreen();
  updateHUD();
}

function flashScreen() {
  const el = $('screen-flash');
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 30);
}

// === Patronen ===
function shootBullet() {
  if (bulletCooldown > 0) return;
  bulletCooldown = HEART_COOLDOWN;
  const angle = car.angle;
  const offset = 26;
  bullets.push({
    x: car.x + Math.cos(angle) * offset,
    y: car.y + Math.sin(angle) * offset,
    vx: Math.cos(angle) * HEART_SPEED + car.vx * 0.4,
    vy: Math.sin(angle) * HEART_SPEED + car.vy * 0.4,
    angle,
    age: 0,
  });
}

function updateBullets(dt) {
  if (bulletCooldown > 0) bulletCooldown -= dt;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.age += dt;
    if (b.age > HEART_LIFETIME ||
        b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
      bullets.splice(i, 1);
    }
  }
}

function checkBulletCollisions() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    let hit = false;
    // Polizisten
    for (const cop of cops) {
      if (cop.defeated) continue;
      const d = Math.hypot(cop.x - b.x, cop.y - b.y);
      if (d < HEART_HIT_RADIUS) {
        cop.defeated = true;
        cop.defeatedTimer = 0;
        hit = true;
        break;
      }
    }
    // Straßensperren
    if (!hit) {
      for (let j = roadblocks.length - 1; j >= 0; j--) {
        const rb = roadblocks[j];
        const d = Math.hypot(rb.x - b.x, rb.y - b.y);
        if (d < ROADBLOCK_RADIUS + HEART_HIT_RADIUS - 6) {
          roadblocks.splice(j, 1);
          hit = true;
          break;
        }
      }
    }
    if (hit) bullets.splice(i, 1);
  }
}

// === Toast-Nachricht ===
function showToast(text, duration, color) {
  toastMessage = text;
  toastTimer = duration || 2;
  toastColor = color || '#a3e635';
}

function drawToast() {
  if (!toastMessage) return;
  const fade = Math.min(1, toastTimer);
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${fade * 0.75})`;
  const boxW = 480;
  const boxH = 100;
  const bx = W / 2 - boxW / 2;
  const by = H / 2 - boxH / 2;
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.strokeStyle = `rgba(255, 215, 0, ${fade})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

  // Konvertiere Hex-Farbe → rgba mit Fade
  const c = toastColor;
  const toRgba = (hex, alpha) => {
    const m = hex.replace('#', '');
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  ctx.fillStyle = toRgba(c, fade);
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(toastMessage, W / 2, H / 2);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// === Rendering ===
function render() {
  // Gras
  ctx.fillStyle = '#5cb85c';
  ctx.fillRect(0, 0, W, H);
  // Gras-Textur
  ctx.fillStyle = '#4a8c3a';
  for (let i = 0; i < 200; i++) {
    const x = (i * 137 + 23) % W;
    const y = (i * 211 + 71) % H;
    ctx.fillRect(x, y, 2, 2);
  }

  // Straßen
  for (const r of ROADS) drawRoad(r);

  // Gebäude
  for (const b of BUILDINGS) drawBuilding(b);

  // Banken
  for (const b of banks) drawBank(b);

  // Bäume nach Gebäuden, vor Fahrzeugen
  for (const t of TREES) drawTree(t);

  // Straßensperren
  for (const rb of roadblocks) drawRoadblock(rb);

  // Patronen
  for (const b of bullets) drawBullet(b);

  // Polizisten
  for (const cop of cops) drawCop(cop);

  // Spieler-Auto
  if (car) drawCar(car);

  // Toast über allem
  drawToast();
}

function drawRoad(r) {
  // Bürgersteig drumherum (etwas heller, Beton-grau)
  ctx.fillStyle = '#a8a8a0';
  if (r.w > r.h) {
    ctx.fillRect(r.x, r.y - 5, r.w, r.h + 10);
  } else {
    ctx.fillRect(r.x - 5, r.y, r.w + 10, r.h);
  }
  // Bürgersteig-Plattenkanten
  ctx.strokeStyle = '#7a7a72';
  ctx.lineWidth = 1;
  if (r.w > r.h) {
    for (let x = r.x; x < r.x + r.w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, r.y - 5); ctx.lineTo(x, r.y);
      ctx.moveTo(x, r.y + r.h); ctx.lineTo(x, r.y + r.h + 5);
      ctx.stroke();
    }
  } else {
    for (let y = r.y; y < r.y + r.h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(r.x - 5, y); ctx.lineTo(r.x, y);
      ctx.moveTo(r.x + r.w, y); ctx.lineTo(r.x + r.w + 5, y);
      ctx.stroke();
    }
  }
  // Asphalt
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // dunkle Bordsteinkante
  ctx.fillStyle = '#1f1f1f';
  if (r.w > r.h) {
    ctx.fillRect(r.x, r.y, r.w, 1.5);
    ctx.fillRect(r.x, r.y + r.h - 1.5, r.w, 1.5);
  } else {
    ctx.fillRect(r.x, r.y, 1.5, r.h);
    ctx.fillRect(r.x + r.w - 1.5, r.y, 1.5, r.h);
  }
  // Mittellinien
  ctx.fillStyle = '#fff200';
  if (r.w > r.h) {
    for (let x = r.x + 10; x < r.x + r.w; x += 32) {
      ctx.fillRect(x, r.y + r.h / 2 - 1.5, 18, 3);
    }
  } else {
    for (let y = r.y + 10; y < r.y + r.h; y += 32) {
      ctx.fillRect(r.x + r.w / 2 - 1.5, y, 3, 18);
    }
  }
}

// Helper: abgerundetes Rechteck (Pfad, ohne fill/stroke aufzurufen)
function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawRoadblock(rb) {
  ctx.save();
  // Schatten
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(rb.x + 3, rb.y + 5, 26, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spawn-Animation: erste 0.4s einblenden
  const age = (Date.now() - rb.spawnTime) / 1000;
  const fade = Math.min(1, age / 0.4);

  ctx.translate(rb.x, rb.y);
  ctx.rotate(rb.angle);
  ctx.globalAlpha = fade;

  // Hauptbalken (gelb mit schwarzen Streifen)
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(-24, -7, 48, 14);

  // Diagonale schwarze Streifen
  ctx.fillStyle = '#1a1a1a';
  for (let i = -24; i < 22; i += 9) {
    ctx.beginPath();
    ctx.moveTo(i, -7);
    ctx.lineTo(i + 5, -7);
    ctx.lineTo(i + 9, 7);
    ctx.lineTo(i + 4, 7);
    ctx.closePath();
    ctx.fill();
  }

  // Rand
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-24, -7, 48, 14);

  // "Beine" am Boden (Standfüße in der Top-Down Sicht)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-22, -11, 5, 4);
  ctx.fillRect( 17, -11, 5, 4);
  ctx.fillRect(-22,   7, 5, 4);
  ctx.fillRect( 17,   7, 5, 4);

  // Reflektor in der Mitte
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  ctx.restore();
}

function drawTree(t) {
  // Schatten
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(t.x + 4, t.y + 4, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Stamm
  ctx.fillStyle = '#5b3a1d';
  ctx.fillRect(t.x - 3, t.y - 2, 6, 8);
  // Unteres Blattwerk (dunkler)
  ctx.fillStyle = '#2d6a2d';
  ctx.beginPath();
  ctx.arc(t.x, t.y - 6, 14, 0, Math.PI * 2);
  ctx.fill();
  // Oberes Blattwerk (heller)
  ctx.fillStyle = '#3a8a3a';
  ctx.beginPath();
  ctx.arc(t.x - 3, t.y - 9, 9, 0, Math.PI * 2);
  ctx.fill();
  // Glanzpunkt
  ctx.fillStyle = '#5cb85c';
  ctx.beginPath();
  ctx.arc(t.x - 5, t.y - 11, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuilding(b) {
  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(b.x + 3, b.y + 3, b.w, b.h);
  // Wand
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  // Fenster (in zwei Reihen, Tür-Bereich aussparen)
  ctx.fillStyle = '#a8d8ea';
  const ws = 7;
  for (let wx = b.x + 7; wx < b.x + b.w - 7; wx += 14) {
    for (let wy = b.y + 8; wy < b.y + b.h - 18; wy += 14) {
      // Fensterrahmen
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(wx - 1, wy - 1, ws + 2, ws + 2);
      // Glas
      ctx.fillStyle = '#a8d8ea';
      ctx.fillRect(wx, wy, ws, ws);
      // Glanz
      ctx.fillStyle = '#dceffa';
      ctx.fillRect(wx, wy, ws / 2, ws / 2);
      ctx.fillStyle = '#a8d8ea';
    }
  }
  // Tür unten Mitte
  const dw = 9;
  const dh = 12;
  const dx = b.x + b.w / 2 - dw / 2;
  const dy = b.y + b.h - dh - 2;
  ctx.fillStyle = '#3d2817';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = '#1a0f08';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1);
  // Türknauf
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(dx + dw - 3, dy + dh / 2 - 1, 1.5, 1.5);
  // Rand des Gebäudes
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  // Dachkante
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(b.x, b.y, b.w, 4);
}

function drawBank(b) {
  ctx.save();
  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(b.x + 4, b.y + 4, b.w, b.h);

  if (b.ready) {
    const t = Date.now() / 300;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 14 + Math.sin(t) * 5;
  }

  // Fassade
  ctx.fillStyle = b.ready ? '#daa520' : '#7a6230';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.shadowBlur = 0;

  // Säulen vorne
  ctx.fillStyle = b.ready ? '#fff8dc' : '#7a7a6a';
  const colW = 6;
  ctx.fillRect(b.x + 8, b.y + 12, colW, b.h - 24);
  ctx.fillRect(b.x + b.w - 14, b.y + 12, colW, b.h - 24);
  ctx.fillRect(b.x + b.w / 2 - 3, b.y + 12, colW, b.h - 24);

  // Dach (Dreieck)
  ctx.fillStyle = b.ready ? '#b8860b' : '#5e4823';
  ctx.beginPath();
  ctx.moveTo(b.x - 2, b.y + 10);
  ctx.lineTo(b.x + b.w / 2, b.y - 4);
  ctx.lineTo(b.x + b.w + 2, b.y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tür
  ctx.fillStyle = '#3d2817';
  ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h - 18, 16, 16);

  // Rand
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);

  // Blaues Banner mit "Jo Banking"
  const bnW = b.w - 8;
  const bnH = 14;
  const bnX = b.x + 4;
  const bnY = b.y + b.h / 2 - bnH / 2 + 6;
  ctx.fillStyle = b.ready ? '#0a3a5e' : '#4a5060';
  ctx.fillRect(bnX, bnY, bnW, bnH);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.strokeRect(bnX + 0.5, bnY + 0.5, bnW - 1, bnH - 1);
  // Banner-Text
  ctx.fillStyle = b.ready ? '#ffd700' : '#999';
  ctx.font = 'bold 9px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Jo Banking', b.x + b.w / 2, bnY + bnH / 2 + 1);

  // $-Symbol oben (im Giebel)
  ctx.fillStyle = b.ready ? '#fff' : '#888';
  ctx.font = 'bold 12px Georgia, serif';
  ctx.fillText('$', b.x + b.w / 2, b.y + 16);

  // "Geschlossen" wenn nicht bereit
  if (!b.ready) {
    ctx.fillStyle = 'rgba(178, 34, 52, 0.85)';
    ctx.fillRect(b.x + 4, b.y + b.h - 12, b.w - 8, 10);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText(`ZU ${Math.ceil(b.cooldown)}s`, b.x + b.w / 2, b.y + b.h - 7);
  }

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawCar(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  // Schatten
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(3, 4, 28, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Räder (4 Stück, ragen seitlich raus)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-17, -16, 10, 5);
  ctx.fillRect( 7, -16, 10, 5);
  ctx.fillRect(-17,  11, 10, 5);
  ctx.fillRect( 7,  11, 10, 5);
  // Felgen
  ctx.fillStyle = '#888';
  ctx.fillRect(-15, -14.5, 6, 2);
  ctx.fillRect( 9, -14.5, 6, 2);
  ctx.fillRect(-15,  12.5, 6, 2);
  ctx.fillRect( 9,  12.5, 6, 2);

  // Karosserie (rot) mit Verlauf — abgerundet
  const grad = ctx.createLinearGradient(0, -12, 0, 12);
  grad.addColorStop(0, '#ff6b5b');
  grad.addColorStop(0.5, '#e74c3c');
  grad.addColorStop(1, '#a02818');
  ctx.fillStyle = grad;
  roundRectPath(-22, -12, 44, 24, 5);
  ctx.fill();

  // Motorhaube (vorne, etwas dunkler) — Trapez für realistischere Front
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(10, -12);
  ctx.lineTo(20, -10);
  ctx.quadraticCurveTo(23, 0, 20, 10);
  ctx.lineTo(10, 12);
  ctx.closePath();
  ctx.fill();
  // Linie zwischen Motorhaube und Innenraum
  ctx.strokeStyle = '#5a1a10';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(10, -12); ctx.lineTo(10, 12);
  ctx.stroke();

  // Windschutzscheibe (vorne) mit Reflexion
  const wsGrad = ctx.createLinearGradient(-3, 0, 9, 0);
  wsGrad.addColorStop(0, '#5a8a9c');
  wsGrad.addColorStop(0.5, '#a8d8ea');
  wsGrad.addColorStop(1, '#7ab8d4');
  ctx.fillStyle = wsGrad;
  ctx.fillRect(-3, -10, 12, 20);

  // Heckscheibe
  ctx.fillStyle = '#5a8a9c';
  ctx.fillRect(-19, -9, 7, 18);

  // Türen-Linie (mittig auf der Seite)
  ctx.strokeStyle = '#5a1a10';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-6, -12); ctx.lineTo(-6, 12);
  ctx.stroke();

  // Seitenspiegel
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(2, -14, 4, 2);
  ctx.fillRect(2, 12, 4, 2);

  // Maschinengewehr-Lauf oben drauf
  ctx.fillStyle = '#333';
  ctx.fillRect(-4, -2.5, 28, 5);
  // Laufmündung
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(22, -3.5, 5, 7);
  // Lauf-Detail (Rillen)
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 0.8;
  for (let gx = 0; gx <= 20; gx += 5) {
    ctx.beginPath();
    ctx.moveTo(-4 + gx, -2.5); ctx.lineTo(-4 + gx, 2.5);
    ctx.stroke();
  }
  // Glanzlicht
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(-2, -2, 22, 1.5);

  // Scheinwerfer (vorne)
  ctx.fillStyle = '#fff8b8';
  ctx.fillRect(20, -10, 3, 4);
  ctx.fillRect(20, 6, 3, 4);

  // Rückleuchten
  ctx.fillStyle = '#cc0000';
  ctx.fillRect(-22, -10, 2, 4);
  ctx.fillRect(-22, 6, 2, 4);

  // Karosserie-Rand
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  roundRectPath(-22, -12, 44, 24, 5);
  ctx.stroke();

  ctx.restore();
}

function drawCop(cop) {
  ctx.save();
  ctx.translate(cop.x, cop.y);
  ctx.rotate(cop.angle);

  // Schatten
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(3, 4, 27, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Räder
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-17, -16, 10, 5);
  ctx.fillRect( 7, -16, 10, 5);
  ctx.fillRect(-17,  11, 10, 5);
  ctx.fillRect( 7,  11, 10, 5);
  ctx.fillStyle = '#888';
  ctx.fillRect(-15, -14.5, 6, 2);
  ctx.fillRect( 9, -14.5, 6, 2);
  ctx.fillRect(-15,  12.5, 6, 2);
  ctx.fillRect( 9,  12.5, 6, 2);

  // Karosserie weiß — abgerundet
  ctx.fillStyle = '#f5f5f5';
  roundRectPath(-22, -12, 44, 24, 5);
  ctx.fill();
  // Schwarze Streifen oben/unten (innerhalb der Rundung)
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-22, -12, 44, 6);
  ctx.fillRect(-22, 6, 44, 6);
  ctx.restore();
  // POLIZEI-Schriftzug auf der Seite
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 4px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POLIZEI', 0, -7);
  ctx.fillText('POLIZEI', 0, 11);
  ctx.textAlign = 'start';

  // Windschutzscheibe
  const wsGrad = ctx.createLinearGradient(-3, 0, 9, 0);
  wsGrad.addColorStop(0, '#4a7080');
  wsGrad.addColorStop(0.5, '#a8d8ea');
  wsGrad.addColorStop(1, '#6a98ac');
  ctx.fillStyle = wsGrad;
  ctx.fillRect(-3, -8, 11, 16);

  // Heckscheibe
  ctx.fillStyle = '#4a7080';
  ctx.fillRect(-18, -7, 6, 14);

  // Sirene oben — blinkend rot/blau
  const blink = Math.floor(Date.now() / 200) % 2;
  ctx.fillStyle = blink ? '#0066ff' : '#ff2020';
  ctx.fillRect(-9, -3, 8, 6);
  ctx.fillStyle = blink ? '#ff2020' : '#0066ff';
  ctx.fillRect(1, -3, 8, 6);
  // Glanz
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-8, -2.5, 6, 1);
  ctx.fillRect(2, -2.5, 6, 1);

  // Scheinwerfer
  ctx.fillStyle = '#fff8b8';
  ctx.fillRect(20, -10, 3, 4);
  ctx.fillRect(20, 6, 3, 4);

  // Rückleuchten
  ctx.fillStyle = '#cc0000';
  ctx.fillRect(-22, -10, 2, 4);
  ctx.fillRect(-22, 6, 2, 4);

  // Rahmen — abgerundet
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  roundRectPath(-22, -12, 44, 24, 5);
  ctx.stroke();

  ctx.restore();

  // Abgeschossen-Effekt (Sterne / Sternchen)
  if (cop.defeated) {
    const t = Date.now() / 180;
    for (let i = 0; i < 4; i++) {
      const phase = ((t * 0.45 + i * 0.3) % 2) / 2;
      const sx = cop.x + (i - 1.5) * 9 + Math.cos(t * 1.3 + i) * 3;
      const sy = cop.y - 20 - phase * 20;
      const alpha = (1 - phase) * 0.95;
      const r = 5 + Math.sin(t * 3 + i) * 1.5;
      // Stern zeichnen
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(t * 2 + i);
      ctx.fillStyle = `rgba(255, 220, 50, ${alpha})`;
      ctx.beginPath();
      for (let p = 0; p < 5; p++) {
        const a = (p * 4 * Math.PI / 5) - Math.PI / 2;
        const a2 = ((p * 4 + 2) * Math.PI / 5) - Math.PI / 2;
        if (p === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a2) * r * 0.42, Math.sin(a2) * r * 0.42);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawBullet(b) {
  const fade = 1 - (b.age / HEART_LIFETIME) * 0.5;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  ctx.globalAlpha = fade;

  // Hülse (Messing)
  const shellGrad = ctx.createLinearGradient(0, -3, 0, 3);
  shellGrad.addColorStop(0, '#e8c84a');
  shellGrad.addColorStop(0.5, '#c8a030');
  shellGrad.addColorStop(1, '#8b6820');
  ctx.fillStyle = shellGrad;
  ctx.fillRect(-8, -2.5, 12, 5);

  // Geschoss-Spitze (Blei/Kupfer)
  const tipGrad = ctx.createLinearGradient(4, -2.5, 4, 2.5);
  tipGrad.addColorStop(0, '#bbb');
  tipGrad.addColorStop(0.5, '#ddd');
  tipGrad.addColorStop(1, '#999');
  ctx.fillStyle = tipGrad;
  ctx.beginPath();
  ctx.moveTo(4, -2.5);
  ctx.lineTo(12, 0);
  ctx.lineTo(4, 2.5);
  ctx.closePath();
  ctx.fill();

  // Rand
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-8, -2.5, 12, 5);

  // Bewegungs-Spur
  ctx.fillStyle = `rgba(255, 200, 50, 0.3)`;
  ctx.beginPath();
  ctx.moveTo(-8, -1.5);
  ctx.lineTo(-22, 0);
  ctx.lineTo(-8, 1.5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// === Game Loop ===
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (gameState === STATE.PLAYING) {
    updateCar(dt);
    checkRoadblockCollision();
    updateBanks(dt);
    checkBankTrigger();
    updateChase(dt);
    updateCops(dt);
    checkCopCollision();
    updateBullets(dt);
    checkBulletCollisions();
    updateHUD();
  }

  // Toast tickt unabhängig vom Zustand weiter
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) {
      toastMessage = null;
      toastTimer = 0;
    }
  }

  render();
  requestAnimationFrame(loop);
}

// === Start ===
$('btn-start').addEventListener('click', startGame);
$('btn-rob-submit').addEventListener('click', attemptRob);
$('btn-rob-cancel').addEventListener('click', closeRobbery);
$('rob-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    attemptRob();
  }
});
$('btn-caught-continue').addEventListener('click', () => {
  hideOverlays();
  gameState = STATE.PLAYING;
});

updateHUD();
showOverlay('overlay-menu');
requestAnimationFrame(loop);
