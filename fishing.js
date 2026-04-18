// === Angelwettkampf 2D — Hano vs Jonas ===

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// === Konstanten ===
const TURN_DURATION = 120; // Sekunden pro Spieler
const NUM_FISH = 18;
const BOAT_CAPACITY = 5;
const BITE_RADIUS = 38;
const HOOK_TIMEOUT = 8;     // Sekunden bis Auto-Retract
const BITE_DURATION = 0.5;  // Sekunden bis Fisch gefangen
const RESPAWN_DELAY = 1.5;  // Sekunden bis Fisch wieder erscheint
const BOAT_ACCEL = 320;
const BOAT_FRICTION = 1.6;
const BOAT_MAX_SPEED = 220;
const FISH_MIN_SPEED = 20;
const FISH_MAX_SPEED = 65;
const MARKET_OPEN_DURATION = 8;   // Sekunden bis der offene Markt wechselt
const COAST_HEIGHT = 18;          // Höhe des Sandstreifens am oberen Rand
const BOAT_TOP_MARGIN = 30;       // Boot bleibt unter dem Sand

// Hai
const SHARK_SPEED = 110;
const SHARK_TURN_SPEED = 2.2;     // Winkel-Änderungsrate rad/s
const SHARK_EAT_RADIUS = 26;      // Wie nah der Hai an einen Fisch muss
const SHARK_BOAT_RADIUS = 30;     // Kollisions-Radius mit dem Boot
const SHARK_EAT_INTERVAL = 5.5;   // Sekunden zwischen Fisch-Mahlzeiten (min)
const SHARK_PATROL_CHANGE = 3.5;  // Sekunden zwischen Richtungsänderungen

// Pirat
const PIRATE_MAX_SPEED = 150;
const PIRATE_ACCEL = 220;
const PIRATE_FRICTION = 1.4;
const PIRATE_HIT_RADIUS = 32;
const PIRATE_COOLDOWN_AFTER_THEFT = 2.5;
const PLAYER_INVULN_AFTER_THEFT = 1.5;

// Drei Länder mit eigenen Märkten — der Pier ist die Trigger-Zone
const COUNTRIES = [
  {
    id: 'usa',
    name: 'USA',
    landX: 30,
    landW: 200,
    pier: { x: 105, y: COAST_HEIGHT, w: 50, h: 80 },
    wasIn: false,
  },
  {
    id: 'ger',
    name: 'Deutschland',
    landX: 380,
    landW: 200,
    pier: { x: 455, y: COAST_HEIGHT, w: 50, h: 80 },
    wasIn: false,
  },
  {
    id: 'kor',
    name: 'Korea',
    landX: 730,
    landW: 200,
    pier: { x: 805, y: COAST_HEIGHT, w: 50, h: 80 },
    wasIn: false,
  },
];

let openMarketCountry = null;     // welcher Markt ist gerade auf
let marketSwitchCountdown = MARKET_OPEN_DURATION;
let currentMarket = null;         // welcher Markt ist gerade im Verkauf-Overlay
let pirate = null;
let shark = null;

// === Spielzustand ===
const STATE = {
  MENU: 'menu',
  INTRO: 'intro',
  PLAYING: 'playing',
  MARKET: 'market',
  PIRATE_QUESTION: 'pirate_question',
  TURN_END: 'turn_end',
  GAME_OVER: 'game_over',
};

let pirateQuestion = null;

let gameState = STATE.MENU;
const players = [
  { name: 'Hano',  money: 0, color: '#ff6b6b' },
  { name: 'Jonas', money: 0, color: '#4dabf7' },
];
let currentPlayer = 0;
let timeLeft = TURN_DURATION;
let stateTimer = 0;

let boat = null;
let fishes = [];
let hook = null;

// === Eingabe ===
const keys = {};

window.addEventListener('keydown', (e) => {
  // Wenn ein Eingabefeld den Fokus hat (Markt), Spieltastatur ignorieren
  if (document.activeElement && document.activeElement.tagName === 'INPUT') {
    return;
  }
  const k = e.key.toLowerCase();
  keys[k] = true;
  if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
    e.preventDefault();
  }
  if (e.repeat) return;
  handleKeyPress(e);
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

function isLeft()  { return keys['arrowleft']  || keys['a']; }
function isRight() { return keys['arrowright'] || keys['d']; }
function isUp()    { return keys['arrowup']    || keys['w']; }
function isDown()  { return keys['arrowdown']  || keys['s']; }

function handleKeyPress(e) {
  if (e.key === ' ' || e.key === 'Enter') {
    if (gameState === STATE.INTRO) {
      startTurn();
    } else if (gameState === STATE.PLAYING) {
      castOrRetract();
    }
  }
}

// === DOM-Helfer ===
const $ = (id) => document.getElementById(id);
const OVERLAYS = ['overlay-menu', 'overlay-intro', 'overlay-turnend', 'overlay-gameover', 'overlay-market', 'overlay-pirate'];

function showOverlay(id) {
  OVERLAYS.forEach((o) => $(o).classList.toggle('hidden', o !== id));
}

function hideOverlays() {
  OVERLAYS.forEach((o) => $(o).classList.add('hidden'));
}

// === Spiel-Setup ===
function resetGame() {
  players[0].money = 0;
  players[1].money = 0;
  currentPlayer = 0;
  updateHUD();
}

function setupTurn() {
  boat = {
    x: W / 2,
    y: H / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    fishOnBoard: [],
    wakes: [],
    invulnTimer: 0,
  };
  pirate = {
    x: W * 0.85,
    y: H * 0.8,
    vx: 0,
    vy: 0,
    angle: Math.PI,
    targetX: W / 2,
    targetY: H / 2,
    retargetIn: 0,
    cooldown: 0,
    flagWave: 0,
  };
  for (const c of COUNTRIES) c.wasIn = false;
  // Erster offener Markt zufällig auswählen
  openMarketCountry = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
  marketSwitchCountdown = MARKET_OPEN_DURATION;
  updateMarketStatus();
  hook = {
    active: false,
    x: 0,
    y: 0,
    state: 'idle', // 'idle' | 'waiting' | 'biting'
    timer: 0,
    fishCaught: null,
  };
  fishes = [];
  for (let i = 0; i < NUM_FISH; i++) {
    fishes.push(spawnFish());
  }
  // Hai startet an einer der Ecken
  const corners = [
    { x: 60, y: H - 60 },
    { x: W - 60, y: H - 60 },
    { x: W - 60, y: COAST_HEIGHT + 60 },
    { x: 60, y: COAST_HEIGHT + 60 },
  ];
  const sc = corners[Math.floor(Math.random() * corners.length)];
  shark = {
    x: sc.x,
    y: sc.y,
    angle: Math.random() * Math.PI * 2,
    eatCooldown: SHARK_EAT_INTERVAL,
    patrolTimer: SHARK_PATROL_CHANGE,
    targetFishIdx: -1,
    finWave: 0,
  };
  timeLeft = TURN_DURATION;
}

// Fischarten — feste Preise: kleiner Fisch billig, großer Fisch teuer
const FISH_KINDS = [
  { color: '#ffa94d', size: 10, weight: 35, price: 1 }, // orange klein
  { color: '#fcd34d', size: 12, weight: 28, price: 2 }, // gelb
  { color: '#a3e635', size: 14, weight: 20, price: 3 }, // grün
  { color: '#f472b6', size: 16, weight: 12, price: 4 }, // pink
  { color: '#67e8f9', size: 18, weight: 5,  price: 5 }, // türkis groß
];
const FISH_WEIGHT_TOTAL = FISH_KINDS.reduce((s, k) => s + k.weight, 0);

function pickFishKind() {
  let r = Math.random() * FISH_WEIGHT_TOTAL;
  for (const k of FISH_KINDS) {
    r -= k.weight;
    if (r <= 0) return k;
  }
  return FISH_KINDS[0];
}

function isInAnyPier(x, y) {
  for (const c of COUNTRIES) {
    const p = c.pier;
    if (x > p.x - 15 && x < p.x + p.w + 15 && y < p.y + p.h + 15) return true;
  }
  return false;
}

function spawnFish() {
  const kind = pickFishKind();
  const angle = Math.random() * Math.PI * 2;
  const speed = FISH_MIN_SPEED + Math.random() * (FISH_MAX_SPEED - FISH_MIN_SPEED);
  // Nicht in Pier-Bereichen oder im Sandstreifen spawnen
  let x, y, tries = 0;
  do {
    x = 40 + Math.random() * (W - 80);
    y = COAST_HEIGHT + 40 + Math.random() * (H - COAST_HEIGHT - 80);
    tries++;
  } while (tries < 12 && isInAnyPier(x, y));
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: kind.size,
    color: kind.color,
    price: kind.price,
    wanderTimer: 1 + Math.random() * 3,
    respawnIn: 0,
  };
}

// === Markt-Rotation ===
function switchOpenMarket() {
  // Wähle einen Markt, der nicht der aktuelle ist
  const others = COUNTRIES.filter(c => c !== openMarketCountry);
  openMarketCountry = others[Math.floor(Math.random() * others.length)];
  marketSwitchCountdown = MARKET_OPEN_DURATION;
  updateMarketStatus();
}

function updateMarketStatus() {
  if (!openMarketCountry) return;
  $('open-market-name').textContent = openMarketCountry.name;
  const flag = $('open-market-flag');
  flag.className = 'flag-mini flag-' + openMarketCountry.id;
}

// === Spielfluss ===
function startGame() {
  resetGame();
  setupTurn();
  showIntro();
}

function showIntro() {
  gameState = STATE.INTRO;
  const p = players[currentPlayer];
  $('intro-name').textContent = p.name;
  $('intro-name').style.color = p.color;
  updateHUD();
  showOverlay('overlay-intro');
}

function startTurn() {
  hideOverlays();
  gameState = STATE.PLAYING;
}

function endTurn(reason) {
  gameState = STATE.TURN_END;
  stateTimer = 2.8;
  const p = players[currentPlayer];
  $('turnend-name').textContent = p.name;
  $('turnend-name').style.color = p.color;
  $('turnend-score').textContent = p.money + '€';
  const reasonEl = $('turnend-reason');
  if (reason) {
    reasonEl.textContent = reason;
    reasonEl.style.display = 'block';
  } else {
    reasonEl.style.display = 'none';
  }
  showOverlay('overlay-turnend');
}

function nextTurnOrEnd() {
  if (currentPlayer === 0) {
    currentPlayer = 1;
    setupTurn();
    showIntro();
  } else {
    showGameOver();
  }
}

function showGameOver() {
  gameState = STATE.GAME_OVER;
  const [a, b] = players;
  if (a.money > b.money) {
    $('winner-text').textContent = `${a.name} gewinnt!`;
    $('winner-text').style.color = a.color;
  } else if (b.money > a.money) {
    $('winner-text').textContent = `${b.name} gewinnt!`;
    $('winner-text').style.color = b.color;
  } else {
    $('winner-text').textContent = 'Unentschieden!';
    $('winner-text').style.color = '#ffd700';
  }
  $('final-scores').textContent = `${a.name}: ${a.money}€   —   ${b.name}: ${b.money}€`;
  showOverlay('overlay-gameover');
}

// === Boot ===
function updateBoat(dt) {
  let ax = 0, ay = 0;
  if (isLeft())  ax -= 1;
  if (isRight()) ax += 1;
  if (isUp())    ay -= 1;
  if (isDown())  ay += 1;

  const mag = Math.hypot(ax, ay);
  if (mag > 0) {
    ax /= mag;
    ay /= mag;
  }

  boat.vx += ax * BOAT_ACCEL * dt;
  boat.vy += ay * BOAT_ACCEL * dt;

  // Reibung
  const fr = Math.exp(-BOAT_FRICTION * dt);
  boat.vx *= fr;
  boat.vy *= fr;

  // Höchstgeschwindigkeit
  const sp = Math.hypot(boat.vx, boat.vy);
  if (sp > BOAT_MAX_SPEED) {
    boat.vx = (boat.vx / sp) * BOAT_MAX_SPEED;
    boat.vy = (boat.vy / sp) * BOAT_MAX_SPEED;
  }

  boat.x += boat.vx * dt;
  boat.y += boat.vy * dt;

  // Spielfeldgrenzen — oben gilt der Coast-Margin (Boot bleibt in Wasser)
  const margin = 26;
  if (boat.x < margin)            { boat.x = margin;            boat.vx = 0; }
  if (boat.x > W - margin)        { boat.x = W - margin;        boat.vx = 0; }
  if (boat.y < BOAT_TOP_MARGIN)   { boat.y = BOAT_TOP_MARGIN;   boat.vy = 0; }
  if (boat.y > H - margin)        { boat.y = H - margin;        boat.vy = 0; }

  // Ausrichtung folgt Bewegungsrichtung
  if (sp > 5) {
    boat.angle = Math.atan2(boat.vy, boat.vx);
    // Wake-Partikel hinter dem Boot erzeugen
    if (Math.random() < 0.6) {
      boat.wakes.push({
        x: boat.x - Math.cos(boat.angle) * 18,
        y: boat.y - Math.sin(boat.angle) * 18,
        age: 0,
        maxAge: 0.9,
      });
    }
  }

  // Wakes altern lassen
  for (let i = boat.wakes.length - 1; i >= 0; i--) {
    boat.wakes[i].age += dt;
    if (boat.wakes[i].age >= boat.wakes[i].maxAge) boat.wakes.splice(i, 1);
  }

  // Markt-Trigger: nur der gerade geöffnete Markt zählt
  for (const c of COUNTRIES) {
    const p = c.pier;
    const inside = boat.x > p.x - 10 && boat.x < p.x + p.w + 10 &&
                   boat.y < p.y + p.h + 5;
    if (inside && !c.wasIn && boat.fishOnBoard.length > 0 && c === openMarketCountry) {
      openMarket(c);
    }
    c.wasIn = inside;
  }

  // Unverwundbarkeits-Timer abbauen
  if (boat.invulnTimer > 0) boat.invulnTimer -= dt;
}

// === Fische ===
function updateFishes(dt) {
  for (const f of fishes) {
    if (f.respawnIn > 0) {
      f.respawnIn -= dt;
      if (f.respawnIn <= 0) {
        Object.assign(f, spawnFish());
      }
      continue;
    }

    f.wanderTimer -= dt;
    if (f.wanderTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const speed = FISH_MIN_SPEED + Math.random() * (FISH_MAX_SPEED - FISH_MIN_SPEED);
      f.vx = Math.cos(angle) * speed;
      f.vy = Math.sin(angle) * speed;
      f.wanderTimer = 1 + Math.random() * 3;
    }

    f.x += f.vx * dt;
    f.y += f.vy * dt;

    // Vom Rand abprallen — oben gilt der Coast-Margin
    const m = 22;
    const topLimit = COAST_HEIGHT + 14;
    if (f.x < m)        { f.x = m;        f.vx = Math.abs(f.vx); }
    if (f.x > W - m)    { f.x = W - m;    f.vx = -Math.abs(f.vx); }
    if (f.y < topLimit) { f.y = topLimit; f.vy = Math.abs(f.vy); }
    if (f.y > H - m)    { f.y = H - m;    f.vy = -Math.abs(f.vy); }

    // Auch von Pier-Bereichen abprallen
    for (const c of COUNTRIES) {
      const p = c.pier;
      if (f.x > p.x - 10 && f.x < p.x + p.w + 10 && f.y < p.y + p.h + 8) {
        // den Fisch nach unten/seitlich wegschieben
        f.y = p.y + p.h + 10;
        f.vy = Math.abs(f.vy);
      }
    }
  }
}

// === Pirat ===
function updatePirate(dt) {
  if (!pirate) return;

  // Cooldown nach erfolgreichem Diebstahl
  if (pirate.cooldown > 0) pirate.cooldown -= dt;

  // Neues Ziel von Zeit zu Zeit
  pirate.retargetIn -= dt;
  if (pirate.retargetIn <= 0) {
    pirate.retargetIn = 1.8 + Math.random() * 1.5;
    if (pirate.cooldown > 0) {
      // Im Cooldown vom Spieler wegfahren
      const dx = pirate.x - boat.x;
      const dy = pirate.y - boat.y;
      const len = Math.hypot(dx, dy) || 1;
      pirate.targetX = pirate.x + (dx / len) * 200;
      pirate.targetY = pirate.y + (dy / len) * 200;
    } else if (Math.random() < 0.7) {
      // Spieler verfolgen mit kleinem Versatz
      pirate.targetX = boat.x + (Math.random() - 0.5) * 80;
      pirate.targetY = boat.y + (Math.random() - 0.5) * 80;
    } else {
      // Zufälliger Patrouillen-Punkt
      pirate.targetX = 80 + Math.random() * (W - 160);
      pirate.targetY = COAST_HEIGHT + 100 + Math.random() * (H - COAST_HEIGHT - 160);
    }
  }

  // Beschleunigung Richtung Ziel
  const dx = pirate.targetX - pirate.x;
  const dy = pirate.targetY - pirate.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 5) {
    const ax = dx / dist;
    const ay = dy / dist;
    pirate.vx += ax * PIRATE_ACCEL * dt;
    pirate.vy += ay * PIRATE_ACCEL * dt;
  }

  // Reibung
  const fr = Math.exp(-PIRATE_FRICTION * dt);
  pirate.vx *= fr;
  pirate.vy *= fr;

  // Höchstgeschwindigkeit (im Cooldown noch langsamer)
  const maxSp = pirate.cooldown > 0 ? PIRATE_MAX_SPEED * 0.55 : PIRATE_MAX_SPEED;
  const sp = Math.hypot(pirate.vx, pirate.vy);
  if (sp > maxSp) {
    pirate.vx = (pirate.vx / sp) * maxSp;
    pirate.vy = (pirate.vy / sp) * maxSp;
  }

  pirate.x += pirate.vx * dt;
  pirate.y += pirate.vy * dt;

  // Spielfeldgrenzen
  const m = 26;
  if (pirate.x < m)              { pirate.x = m;              pirate.vx = -pirate.vx * 0.5; }
  if (pirate.x > W - m)          { pirate.x = W - m;          pirate.vx = -pirate.vx * 0.5; }
  if (pirate.y < BOAT_TOP_MARGIN) { pirate.y = BOAT_TOP_MARGIN; pirate.vy = -pirate.vy * 0.5; }
  if (pirate.y > H - m)          { pirate.y = H - m;          pirate.vy = -pirate.vy * 0.5; }

  if (sp > 5) pirate.angle = Math.atan2(pirate.vy, pirate.vx);
  pirate.flagWave += dt;
}

function checkPirateCollision() {
  if (!pirate || !boat) return;
  if (pirate.cooldown > 0) return;
  if (boat.invulnTimer > 0) return;
  const d = Math.hypot(pirate.x - boat.x, pirate.y - boat.y);
  if (d < PIRATE_HIT_RADIUS && boat.fishOnBoard.length > 0) {
    openPirateQuestion();
  }
}

// === Hai ===
function updateShark(dt) {
  if (!shark) return;
  shark.finWave += dt;
  shark.eatCooldown -= dt;
  shark.patrolTimer -= dt;

  // Ziel-Winkel bestimmen
  let targetAngle = shark.angle;

  // Wenn Fress-Cooldown abgelaufen: nächsten Fisch suchen
  if (shark.eatCooldown <= 0 && shark.targetFishIdx < 0) {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < fishes.length; i++) {
      const f = fishes[i];
      if (f.respawnIn > 0) continue;
      const d = Math.hypot(f.x - shark.x, f.y - shark.y);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    shark.targetFishIdx = best;
  }

  if (shark.targetFishIdx >= 0 && shark.targetFishIdx < fishes.length) {
    const tf = fishes[shark.targetFishIdx];
    if (tf.respawnIn > 0) {
      // Fisch verschwunden – neuen suchen
      shark.targetFishIdx = -1;
    } else {
      const dx = tf.x - shark.x;
      const dy = tf.y - shark.y;
      targetAngle = Math.atan2(dy, dx);
      const dist = Math.hypot(dx, dy);
      if (dist < SHARK_EAT_RADIUS) {
        // Fisch fressen — kein Respawn (Infinity)
        tf.respawnIn = Infinity;
        shark.targetFishIdx = -1;
        shark.eatCooldown = SHARK_EAT_INTERVAL + Math.random() * 3;
      }
    }
  } else {
    // Patrouille
    if (shark.patrolTimer <= 0) {
      // Neue Zielrichtung — leicht nach innen gelenkt damit Hai auf Spielfeld bleibt
      const margin = 80;
      const cx = W / 2, cy = H / 2;
      const tx = margin + Math.random() * (W - margin * 2);
      const ty = COAST_HEIGHT + margin + Math.random() * (H - COAST_HEIGHT - margin * 2);
      targetAngle = Math.atan2(ty - shark.y, tx - shark.x);
      shark.patrolTimer = SHARK_PATROL_CHANGE + Math.random() * 2;
    } else {
      targetAngle = shark.angle; // weiter geradeaus
    }
  }

  // Smooth turn
  let diff = targetAngle - shark.angle;
  // Normalize to [-π, π]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const maxTurn = SHARK_TURN_SPEED * dt;
  shark.angle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurn);

  // Bewegen
  shark.x += Math.cos(shark.angle) * SHARK_SPEED * dt;
  shark.y += Math.sin(shark.angle) * SHARK_SPEED * dt;

  // Grenzen — abprallen
  const m = 30;
  const topL = COAST_HEIGHT + m;
  if (shark.x < m)       { shark.x = m;       shark.angle = Math.PI - shark.angle; }
  if (shark.x > W - m)   { shark.x = W - m;   shark.angle = Math.PI - shark.angle; }
  if (shark.y < topL)    { shark.y = topL;    shark.angle = -shark.angle; }
  if (shark.y > H - m)   { shark.y = H - m;   shark.angle = -shark.angle; }
}

function checkSharkCollision() {
  if (!shark || !boat) return;
  const d = Math.hypot(shark.x - boat.x, shark.y - boat.y);
  if (d < SHARK_BOAT_RADIUS) {
    sharkCaughtPlayer();
  }
}

function sharkCaughtPlayer() {
  // Flash + sofortiges Turn-Ende (kein Straf-Geld, aber der Zug endet sofort)
  flashScreen();
  shark = null;
  endTurn('🦈 Vom Hai erwischt! Zug ist vorbei.');
}

function flashScreen() {
  const el = $('screen-flash');
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 30);
}

// === Pirat-Szenen (Bilder mit zugehörigem Satz) ===
const sceneCanvas = document.getElementById('pirate-scene');
const sceneCtx = sceneCanvas.getContext('2d');

function clearScene() {
  sceneCtx.clearRect(0, 0, sceneCanvas.width, sceneCanvas.height);
}

function drawSceneTennis(c, w, h, t) {
  // Himmel
  c.fillStyle = '#a8d8ea';
  c.fillRect(0, 0, w, h);
  // Tennisplatz
  c.fillStyle = '#c97f4d';
  c.fillRect(0, h - 70, w, 70);
  c.fillStyle = '#fff';
  c.fillRect(0, h - 70, w, 4);

  const cx = 110;
  const groundY = h - 70;

  // Beine
  c.strokeStyle = '#000';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx - 10, groundY);
  c.lineTo(cx - 4, groundY - 32);
  c.moveTo(cx + 10, groundY);
  c.lineTo(cx + 4, groundY - 32);
  c.stroke();

  // Hose
  c.fillStyle = '#0a558c';
  c.fillRect(cx - 14, groundY - 38, 28, 14);

  // T-Shirt
  c.fillStyle = '#e63946';
  c.fillRect(cx - 16, groundY - 65, 32, 30);

  // Linker Arm
  c.strokeStyle = '#f5cba7';
  c.lineWidth = 7;
  c.beginPath();
  c.moveTo(cx - 16, groundY - 60);
  c.lineTo(cx - 26, groundY - 38);
  c.stroke();

  // Rechter Arm mit Schlägerschwung
  const swing = Math.sin(t * 3) * 0.4;
  const armAngle = -Math.PI / 2 + swing - 0.3;
  const armLen = 32;
  const shoulderX = cx + 16;
  const shoulderY = groundY - 60;
  const handX = shoulderX + Math.cos(armAngle) * armLen;
  const handY = shoulderY + Math.sin(armAngle) * armLen;
  c.beginPath();
  c.moveTo(shoulderX, shoulderY);
  c.lineTo(handX, handY);
  c.stroke();

  // Schläger
  c.save();
  c.translate(handX, handY);
  c.rotate(armAngle + Math.PI / 2);
  c.strokeStyle = '#5b3a1d';
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(0, -2);
  c.lineTo(0, 18);
  c.stroke();
  c.strokeStyle = '#000';
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(0, 32, 13, 18, 0, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.fill();
  c.strokeStyle = '#fff';
  c.lineWidth = 0.8;
  for (let i = -10; i <= 10; i += 4) {
    c.beginPath();
    c.moveTo(i, 16);
    c.lineTo(i, 48);
    c.stroke();
  }
  for (let i = 18; i <= 46; i += 4) {
    c.beginPath();
    c.moveTo(-12, i);
    c.lineTo(12, i);
    c.stroke();
  }
  c.restore();

  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(cx, groundY - 82, 15, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();
  // Haare
  c.fillStyle = '#3d2817';
  c.beginPath();
  c.arc(cx, groundY - 88, 16, Math.PI * 1.05, Math.PI * 1.95);
  c.fill();
  // Augen
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(cx - 4, groundY - 82, 1.8, 0, Math.PI * 2);
  c.arc(cx + 4, groundY - 82, 1.8, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(cx, groundY - 78, 4, 0.1, Math.PI - 0.1);
  c.stroke();

  // Bouncender Tennisball
  const bouncePhase = (t * 0.8) % 1;
  const bounceY = -Math.abs(Math.sin(bouncePhase * Math.PI * 2)) * 60;
  const ballX = 230;
  const ballY = groundY - 80 + bounceY;
  c.fillStyle = '#d6e63f';
  c.beginPath();
  c.arc(ballX, ballY, 9, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.2;
  c.stroke();
  c.beginPath();
  c.arc(ballX, ballY, 9, -1, 1);
  c.stroke();
}

function drawSceneCatSleep(c, w, h, t) {
  // Wand
  c.fillStyle = '#fde2a7';
  c.fillRect(0, 0, w, h);
  // Boden
  c.fillStyle = '#b87333';
  c.fillRect(0, h - 50, w, 50);
  // Kissen
  c.fillStyle = '#f06292';
  c.beginPath();
  c.ellipse(w / 2, h - 50, 110, 25, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();

  const cx = w / 2;
  const cy = h - 70;
  const breathe = Math.sin(t * 1.5) * 1.5;

  // Schwanz
  c.strokeStyle = '#888';
  c.lineWidth = 14;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx + 65, cy + 5);
  c.bezierCurveTo(cx + 90, cy - 10, cx + 95, cy + 25, cx + 75, cy + 30);
  c.stroke();

  // Körper
  c.fillStyle = '#999';
  c.beginPath();
  c.ellipse(cx, cy + breathe, 70, 28, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();

  // Kopf
  c.fillStyle = '#999';
  c.beginPath();
  c.arc(cx - 60, cy - 5, 25, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Ohren
  c.beginPath();
  c.moveTo(cx - 75, cy - 28);
  c.lineTo(cx - 65, cy - 10);
  c.lineTo(cx - 80, cy - 5);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(cx - 50, cy - 30);
  c.lineTo(cx - 45, cy - 8);
  c.lineTo(cx - 58, cy - 12);
  c.closePath();
  c.fill();
  c.stroke();

  // Schnauze
  c.fillStyle = '#fdd';
  c.beginPath();
  c.arc(cx - 65, cy + 5, 7, 0, Math.PI * 2);
  c.fill();

  // Geschlossene Augen
  c.strokeStyle = '#000';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(cx - 75, cy - 5);
  c.quadraticCurveTo(cx - 70, cy, cx - 65, cy - 5);
  c.moveTo(cx - 60, cy - 5);
  c.quadraticCurveTo(cx - 55, cy, cx - 50, cy - 5);
  c.stroke();

  // Schnurrhaare
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(cx - 78, cy + 8); c.lineTo(cx - 92, cy + 6);
  c.moveTo(cx - 78, cy + 11); c.lineTo(cx - 92, cy + 14);
  c.moveTo(cx - 52, cy + 8); c.lineTo(cx - 38, cy + 6);
  c.moveTo(cx - 52, cy + 11); c.lineTo(cx - 38, cy + 14);
  c.stroke();

  // Z's steigend
  c.fillStyle = '#000';
  c.font = 'bold 22px sans-serif';
  for (let i = 0; i < 3; i++) {
    const phase = ((t * 0.6) + i * 0.33) % 1;
    const zx = cx + 40 - i * 8;
    const zy = cy - 30 - phase * 60;
    c.globalAlpha = 1 - phase;
    c.fillText('Z', zx, zy);
  }
  c.globalAlpha = 1;
}

function drawSceneDogRun(c, w, h, t) {
  // Himmel
  c.fillStyle = '#a8d8ea';
  c.fillRect(0, 0, w, h);
  // Wolken
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(60, 35, 12, 0, Math.PI * 2);
  c.arc(78, 33, 16, 0, Math.PI * 2);
  c.arc(94, 38, 10, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(220, 50, 11, 0, Math.PI * 2);
  c.arc(236, 48, 14, 0, Math.PI * 2);
  c.arc(250, 52, 9, 0, Math.PI * 2);
  c.fill();
  // Gras
  c.fillStyle = '#7cba3a';
  c.fillRect(0, h - 50, w, 50);
  c.strokeStyle = '#5a8a25';
  c.lineWidth = 1;
  for (let x = 0; x < w; x += 8) {
    c.beginPath();
    c.moveTo(x, h - 50);
    c.lineTo(x + 2, h - 56);
    c.stroke();
  }

  const cx = w / 2 + Math.sin(t * 4) * 2;
  const cy = h - 60;

  // Körper
  c.fillStyle = '#c89060';
  c.beginPath();
  c.ellipse(cx, cy, 38, 18, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();

  // Kopf
  c.beginPath();
  c.ellipse(cx + 35, cy - 8, 18, 14, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Schnauze
  c.beginPath();
  c.ellipse(cx + 50, cy - 4, 8, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Ohr
  c.fillStyle = '#9c6a40';
  c.beginPath();
  c.moveTo(cx + 28, cy - 18);
  c.quadraticCurveTo(cx + 22, cy + 5, cx + 32, cy);
  c.fill();
  c.stroke();

  // Auge
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(cx + 38, cy - 8, 1.8, 0, Math.PI * 2);
  c.fill();
  // Nase
  c.beginPath();
  c.arc(cx + 56, cy - 4, 2.2, 0, Math.PI * 2);
  c.fill();

  // Schwanz wedelnd
  const tailWag = Math.sin(t * 6) * 0.5;
  c.strokeStyle = '#c89060';
  c.lineWidth = 6;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx - 36, cy - 5);
  c.lineTo(cx - 56, cy - 18 + tailWag * 8);
  c.stroke();

  // Beine — Lauf-Animation
  c.strokeStyle = '#a06840';
  c.lineWidth = 5;
  const front1 = Math.sin(t * 8) * 8;
  const front2 = Math.sin(t * 8 + Math.PI) * 8;
  c.beginPath();
  c.moveTo(cx + 18, cy + 14);
  c.lineTo(cx + 18 + front1, cy + 28);
  c.moveTo(cx + 26, cy + 14);
  c.lineTo(cx + 26 + front2, cy + 28);
  c.stroke();
  const back1 = Math.sin(t * 8 + Math.PI) * 8;
  const back2 = Math.sin(t * 8) * 8;
  c.beginPath();
  c.moveTo(cx - 18, cy + 14);
  c.lineTo(cx - 18 + back1, cy + 28);
  c.moveTo(cx - 26, cy + 14);
  c.lineTo(cx - 26 + back2, cy + 28);
  c.stroke();
}

function drawSceneSun(c, w, h, t) {
  // Himmel
  const grad = c.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#7ec7e6');
  grad.addColorStop(1, '#cdebf7');
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);

  // Wolken
  c.fillStyle = '#fff';
  c.globalAlpha = 0.85;
  c.beginPath();
  c.arc(50, 165, 14, 0, Math.PI * 2);
  c.arc(70, 163, 18, 0, Math.PI * 2);
  c.arc(88, 167, 12, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(245, 180, 12, 0, Math.PI * 2);
  c.arc(263, 178, 16, 0, Math.PI * 2);
  c.arc(280, 182, 10, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;

  const cx = w / 2;
  const cy = h / 2 - 10;
  const r = 38;

  // Strahlen rotieren
  c.save();
  c.translate(cx, cy);
  c.rotate(t * 0.3);
  c.strokeStyle = '#ffb800';
  c.lineWidth = 5;
  c.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const x1 = Math.cos(angle) * (r + 8);
    const y1 = Math.sin(angle) * (r + 8);
    const x2 = Math.cos(angle) * (r + 22);
    const y2 = Math.sin(angle) * (r + 22);
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  }
  c.restore();

  // Sonne
  c.fillStyle = '#ffd700';
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#c89500';
  c.lineWidth = 2;
  c.stroke();

  // Gesicht
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(cx - 13, cy - 5, 3.5, 0, Math.PI * 2);
  c.arc(cx + 13, cy - 5, 3.5, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(cx, cy + 3, 16, 0.1, Math.PI - 0.1);
  c.stroke();
  c.fillStyle = '#ff9999';
  c.globalAlpha = 0.6;
  c.beginPath();
  c.arc(cx - 22, cy + 5, 5, 0, Math.PI * 2);
  c.arc(cx + 22, cy + 5, 5, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
}

function drawSceneFishSwim(c, w, h, t) {
  // Wasser
  const grad = c.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#5cc5e8');
  grad.addColorStop(1, '#0e6595');
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);

  // Wellen oben
  c.strokeStyle = 'rgba(255,255,255,0.4)';
  c.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    for (let x = 0; x < w; x += 5) {
      const y = 12 + i * 8 + Math.sin((x + t * 30) / 18) * 2;
      if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }

  // Boden + Pflanzen
  c.fillStyle = '#d4a85a';
  c.fillRect(0, h - 30, w, 30);
  c.strokeStyle = '#4a8c3a';
  c.lineWidth = 4;
  c.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const x = 25 + i * 50;
    const sway = Math.sin(t * 1.5 + i) * 3;
    c.beginPath();
    c.moveTo(x, h - 30);
    c.quadraticCurveTo(x + sway, h - 55, x + sway * 1.5, h - 75);
    c.stroke();
  }

  // Fisch
  const fx = w / 2 + Math.sin(t * 0.8) * 30;
  const fy = h / 2 + Math.cos(t * 1.1) * 10;

  c.save();
  c.translate(fx, fy);

  // Schwanz hinten zuerst (damit Körper drüber liegt)
  const tailAngle = Math.sin(t * 5) * 0.4;
  c.save();
  c.translate(-26, 0);
  c.rotate(tailAngle);
  c.fillStyle = '#ff8a3d';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(-18, -14);
  c.lineTo(-18, 14);
  c.closePath();
  c.fill();
  c.strokeStyle = '#5b1d00';
  c.lineWidth = 1.5;
  c.stroke();
  c.restore();

  // Körper
  const grad2 = c.createLinearGradient(0, -16, 0, 16);
  grad2.addColorStop(0, '#ff8a3d');
  grad2.addColorStop(1, '#c45a10');
  c.fillStyle = grad2;
  c.beginPath();
  c.ellipse(0, 0, 28, 16, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#5b1d00';
  c.lineWidth = 1.5;
  c.stroke();

  // Rückenflosse
  c.fillStyle = '#ff8a3d';
  c.beginPath();
  c.moveTo(-5, -16);
  c.lineTo(5, -25);
  c.lineTo(8, -16);
  c.closePath();
  c.fill();
  c.stroke();

  // Auge
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(14, -3, 4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 0.8;
  c.stroke();
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(15, -3, 2, 0, Math.PI * 2);
  c.fill();

  // Mund
  c.strokeStyle = '#5b1d00';
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(20, 4, 3, Math.PI, 0);
  c.stroke();

  c.restore();

  // Aufsteigende Blasen
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.strokeStyle = 'rgba(255,255,255,0.7)';
  c.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const phase = ((t * 0.5) + i * 0.2) % 1;
    const bx = fx + 26 + i * 4 + Math.sin(phase * 6 + i) * 3;
    const by = fy - 10 - phase * (h / 2);
    const br = 2 + i * 0.5;
    c.beginPath();
    c.arc(bx, by, br, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

function drawSceneBirdFly(c, w, h, t) {
  // Himmel-Verlauf
  const grad = c.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#7eb8de');
  grad.addColorStop(1, '#d5ecf6');
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);

  // Wolken
  c.fillStyle = '#fff';
  c.globalAlpha = 0.9;
  c.beginPath();
  c.arc(60, 50, 14, 0, Math.PI * 2);
  c.arc(80, 48, 18, 0, Math.PI * 2);
  c.arc(98, 53, 12, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(220, 70, 12, 0, Math.PI * 2);
  c.arc(238, 68, 16, 0, Math.PI * 2);
  c.arc(254, 73, 10, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(160, 175, 12, 0, Math.PI * 2);
  c.arc(180, 173, 16, 0, Math.PI * 2);
  c.arc(196, 177, 11, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;

  // Vogel
  const bx = w / 2 + Math.sin(t * 0.6) * 40;
  const by = h / 2 + Math.sin(t * 1.2) * 8;

  c.save();
  c.translate(bx, by);

  // Körper
  c.fillStyle = '#4a90e2';
  c.beginPath();
  c.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();

  // Bauch
  c.fillStyle = '#fff';
  c.beginPath();
  c.ellipse(2, 4, 14, 8, 0, 0, Math.PI * 2);
  c.fill();

  // Kopf
  c.fillStyle = '#4a90e2';
  c.beginPath();
  c.arc(18, -5, 12, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();

  // Auge
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(22, -7, 3, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 0.6;
  c.stroke();
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(23, -7, 1.5, 0, Math.PI * 2);
  c.fill();

  // Schnabel
  c.fillStyle = '#ff9500';
  c.beginPath();
  c.moveTo(28, -3);
  c.lineTo(40, -1);
  c.lineTo(28, 3);
  c.closePath();
  c.fill();
  c.strokeStyle = '#a85500';
  c.lineWidth = 1;
  c.stroke();

  // Schwanz
  c.fillStyle = '#4a90e2';
  c.beginPath();
  c.moveTo(-22, 0);
  c.lineTo(-32, -7);
  c.lineTo(-32, 7);
  c.closePath();
  c.fill();
  c.strokeStyle = '#000';
  c.stroke();

  // Flügel — Flap-Animation
  const flap = Math.sin(t * 8) * 0.6;
  c.save();
  c.rotate(flap * 0.3);
  c.fillStyle = '#3a7dc6';
  c.beginPath();
  c.ellipse(-2, -8 - Math.abs(flap) * 4, 18, 10, -0.3, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();
  c.restore();

  c.restore();
}

function drawSceneGirlRead(c, w, h, t) {
  // Wand
  c.fillStyle = '#f5e9d3';
  c.fillRect(0, 0, w, h);
  // Boden
  c.fillStyle = '#8b6f47';
  c.fillRect(0, h - 60, w, 60);

  const cx = w / 2;
  const groundY = h - 60;

  // Beine (sitzend)
  c.strokeStyle = '#000';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx - 28, groundY);
  c.lineTo(cx - 5, groundY - 8);
  c.lineTo(cx + 28, groundY);
  c.stroke();

  // Rock
  c.fillStyle = '#9b59b6';
  c.beginPath();
  c.moveTo(cx - 32, groundY - 5);
  c.lineTo(cx + 32, groundY - 5);
  c.lineTo(cx + 22, groundY - 38);
  c.lineTo(cx - 22, groundY - 38);
  c.closePath();
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();

  // Oberkörper
  c.fillStyle = '#e91e63';
  c.fillRect(cx - 20, groundY - 70, 40, 35);
  c.strokeRect(cx - 20, groundY - 70, 40, 35);

  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(cx, groundY - 88, 14, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Lange Haare
  c.fillStyle = '#8b4513';
  c.beginPath();
  c.arc(cx, groundY - 91, 16, Math.PI, 2 * Math.PI);
  c.fill();
  c.fillRect(cx - 16, groundY - 91, 4, 22);
  c.fillRect(cx + 12, groundY - 91, 4, 22);

  // Augen (gelegentliches Blinzeln)
  const blinking = (Math.sin(t * 1.2) > 0.93);
  c.fillStyle = '#000';
  if (!blinking) {
    c.beginPath();
    c.arc(cx - 4, groundY - 86, 1.5, 0, Math.PI * 2);
    c.arc(cx + 4, groundY - 86, 1.5, 0, Math.PI * 2);
    c.fill();
  } else {
    c.strokeStyle = '#000';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(cx - 6, groundY - 86);
    c.lineTo(cx - 2, groundY - 86);
    c.moveTo(cx + 2, groundY - 86);
    c.lineTo(cx + 6, groundY - 86);
    c.stroke();
  }
  // Lächeln
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(cx, groundY - 82, 3, 0.2, Math.PI - 0.2);
  c.stroke();

  // Buch (offen)
  const open = Math.sin(t * 1.5) * 1.5;
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(cx - 32, groundY - 35);
  c.lineTo(cx, groundY - 38 - open);
  c.lineTo(cx + 32, groundY - 35);
  c.lineTo(cx + 32, groundY - 12);
  c.lineTo(cx, groundY - 14);
  c.lineTo(cx - 32, groundY - 12);
  c.closePath();
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();
  c.beginPath();
  c.moveTo(cx, groundY - 38 - open);
  c.lineTo(cx, groundY - 14);
  c.stroke();
  // Textlinien
  c.lineWidth = 0.6;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(cx - 26, groundY - 30 + i * 5);
    c.lineTo(cx - 5, groundY - 31 + i * 5);
    c.moveTo(cx + 5, groundY - 31 + i * 5);
    c.lineTo(cx + 26, groundY - 30 + i * 5);
    c.stroke();
  }
}

function drawSceneBike(c, w, h, t) {
  // Himmel
  c.fillStyle = '#a8d8ea';
  c.fillRect(0, 0, w, h);
  // Wolke
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(50, 35, 12, 0, Math.PI * 2);
  c.arc(68, 33, 16, 0, Math.PI * 2);
  c.arc(84, 38, 10, 0, Math.PI * 2);
  c.fill();
  // Straße
  c.fillStyle = '#666';
  c.fillRect(0, h - 50, w, 50);
  c.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) {
    const x = (i * 50 - (t * 60) % 50) % w;
    if (x >= 0 && x < w) c.fillRect(x, h - 26, 25, 4);
  }

  const cx = w / 2;
  const groundY = h - 50;
  const wheelR = 22;
  const wheelY = groundY - wheelR - 2;

  // Räder
  const rotation = t * 5;
  for (const wx of [cx - 28, cx + 28]) {
    c.fillStyle = '#222';
    c.beginPath();
    c.arc(wx, wheelY, wheelR, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#bbb';
    c.beginPath();
    c.arc(wx, wheelY, wheelR - 4, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#666';
    c.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const angle = rotation + i * Math.PI / 3;
      c.beginPath();
      c.moveTo(wx, wheelY);
      c.lineTo(wx + Math.cos(angle) * (wheelR - 4), wheelY + Math.sin(angle) * (wheelR - 4));
      c.stroke();
    }
    c.fillStyle = '#444';
    c.beginPath();
    c.arc(wx, wheelY, 3, 0, Math.PI * 2);
    c.fill();
  }

  // Rahmen
  c.strokeStyle = '#e74c3c';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx + 28, wheelY);
  c.lineTo(cx, wheelY - 25);
  c.lineTo(cx - 5, wheelY);
  c.lineTo(cx - 28, wheelY);
  c.moveTo(cx - 5, wheelY);
  c.lineTo(cx + 8, wheelY - 30);
  c.stroke();

  // Lenker
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(cx + 28, wheelY);
  c.lineTo(cx + 22, wheelY - 35);
  c.moveTo(cx + 16, wheelY - 35);
  c.lineTo(cx + 28, wheelY - 35);
  c.stroke();

  // Sattel
  c.fillStyle = '#000';
  c.beginPath();
  c.ellipse(cx + 8, wheelY - 32, 8, 3, 0, 0, Math.PI * 2);
  c.fill();

  // Pedalierende Beine
  const pedal = t * 5;
  c.strokeStyle = '#000';
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(cx + 8, wheelY - 30);
  c.lineTo(cx - 5 + Math.cos(pedal) * 9, wheelY + Math.sin(pedal) * 9);
  c.moveTo(cx + 8, wheelY - 30);
  c.lineTo(cx - 5 + Math.cos(pedal + Math.PI) * 9, wheelY + Math.sin(pedal + Math.PI) * 9);
  c.stroke();

  // Körper
  c.fillStyle = '#3498db';
  c.beginPath();
  c.moveTo(cx, wheelY - 32);
  c.lineTo(cx + 22, wheelY - 38);
  c.lineTo(cx + 18, wheelY - 62);
  c.lineTo(cx - 6, wheelY - 62);
  c.closePath();
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();

  // Arm zum Lenker
  c.strokeStyle = '#f5cba7';
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(cx + 8, wheelY - 60);
  c.lineTo(cx + 22, wheelY - 35);
  c.stroke();

  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(cx + 8, wheelY - 73, 11, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();

  // Helm
  c.fillStyle = '#27ae60';
  c.beginPath();
  c.arc(cx + 8, wheelY - 75, 12, Math.PI, 2 * Math.PI);
  c.fill();
  c.stroke();

  // Auge
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(cx + 12, wheelY - 73, 1.5, 0, Math.PI * 2);
  c.fill();
  // Lächeln
  c.beginPath();
  c.arc(cx + 11, wheelY - 70, 3, 0, Math.PI);
  c.stroke();
}

function drawSceneFrog(c, w, h, t) {
  // Himmel
  c.fillStyle = '#a8d8ea';
  c.fillRect(0, 0, w, h);
  // Teich
  c.fillStyle = '#3aa1d8';
  c.fillRect(0, h - 35, w, 35);
  c.fillStyle = '#5dbce5';
  c.fillRect(0, h - 35, w, 4);
  // Seerosenblätter
  c.fillStyle = '#5cb85c';
  c.beginPath();
  c.ellipse(60, h - 30, 22, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(260, h - 30, 24, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(160, h - 30, 20, 6, 0, 0, Math.PI * 2);
  c.fill();

  // Frosch in einem Sprung-Bogen
  const jumpPhase = (t * 0.7) % 1;
  const fx = 40 + jumpPhase * 240;
  const fy = h - 40 - Math.sin(jumpPhase * Math.PI) * 90;

  c.save();
  c.translate(fx, fy);
  // Kleine Drehung beim Springen
  c.rotate(Math.sin(jumpPhase * Math.PI) * 0.2);

  // Hinterbeine
  c.strokeStyle = '#2d6a2d';
  c.lineWidth = 4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-12, 5);
  c.lineTo(-26, 0);
  c.lineTo(-32, 8);
  c.moveTo(12, 5);
  c.lineTo(26, 0);
  c.lineTo(32, 8);
  c.stroke();
  // Vorderbeine
  c.beginPath();
  c.moveTo(-8, -3);
  c.lineTo(-16, -6);
  c.moveTo(8, -3);
  c.lineTo(16, -6);
  c.stroke();

  // Körper
  c.fillStyle = '#5cb85c';
  c.beginPath();
  c.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#2d6a2d';
  c.lineWidth = 1.5;
  c.stroke();

  // Bauch
  c.fillStyle = '#9ad498';
  c.beginPath();
  c.ellipse(0, 5, 12, 5, 0, 0, Math.PI * 2);
  c.fill();

  // Augen-Höcker
  c.fillStyle = '#5cb85c';
  c.beginPath();
  c.arc(-7, -10, 6, 0, Math.PI * 2);
  c.arc(7, -10, 6, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(-7, -10, 4, 0, Math.PI * 2);
  c.arc(7, -10, 4, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(-7, -10, 2, 0, Math.PI * 2);
  c.arc(7, -10, 2, 0, Math.PI * 2);
  c.fill();

  // Mund
  c.strokeStyle = '#2d6a2d';
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(0, 2, 6, 0.1, Math.PI - 0.1);
  c.stroke();

  c.restore();
}

function drawSceneCar(c, w, h, t) {
  // Himmel
  c.fillStyle = '#a8d8ea';
  c.fillRect(0, 0, w, h);
  // Berge
  c.fillStyle = '#8a9b85';
  c.beginPath();
  c.moveTo(0, h - 70);
  c.lineTo(60, h - 110);
  c.lineTo(120, h - 80);
  c.lineTo(200, h - 120);
  c.lineTo(260, h - 90);
  c.lineTo(w, h - 100);
  c.lineTo(w, h - 50);
  c.lineTo(0, h - 50);
  c.closePath();
  c.fill();

  // Straße
  c.fillStyle = '#444';
  c.fillRect(0, h - 50, w, 50);
  c.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) {
    const x = ((i * 50) - (t * 80) % 50) % w;
    if (x >= 0) c.fillRect(x, h - 26, 25, 4);
  }

  const cx = w / 2 + Math.sin(t * 2) * 2;
  const baseY = h - 55;

  // Karosserie
  c.fillStyle = '#e74c3c';
  c.beginPath();
  c.moveTo(cx - 60, baseY);
  c.lineTo(cx + 60, baseY);
  c.lineTo(cx + 55, baseY - 25);
  c.lineTo(cx + 30, baseY - 25);
  c.lineTo(cx + 18, baseY - 45);
  c.lineTo(cx - 25, baseY - 45);
  c.lineTo(cx - 35, baseY - 25);
  c.lineTo(cx - 55, baseY - 25);
  c.closePath();
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();

  // Fenster
  c.fillStyle = '#bce7f6';
  c.beginPath();
  c.moveTo(cx - 22, baseY - 26);
  c.lineTo(cx - 14, baseY - 42);
  c.lineTo(cx + 16, baseY - 42);
  c.lineTo(cx + 26, baseY - 26);
  c.closePath();
  c.fill();
  c.stroke();

  // Scheinwerfer
  c.fillStyle = '#ffeb3b';
  c.beginPath();
  c.arc(cx + 55, baseY - 12, 4, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 1;
  c.stroke();

  // Räder
  const wheelRot = t * 8;
  for (const wx of [cx - 35, cx + 35]) {
    c.fillStyle = '#222';
    c.beginPath();
    c.arc(wx, baseY, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#888';
    c.beginPath();
    c.arc(wx, baseY, 9, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#444';
    c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = wheelRot + i * Math.PI / 2;
      c.beginPath();
      c.moveTo(wx - Math.cos(angle) * 8, baseY - Math.sin(angle) * 8);
      c.lineTo(wx + Math.cos(angle) * 8, baseY + Math.sin(angle) * 8);
      c.stroke();
    }
  }

  // Auspuffwolken
  c.fillStyle = '#ccc';
  for (let i = 0; i < 3; i++) {
    const phase = ((t * 1.5) + i * 0.3) % 1;
    const px = cx - 65 - phase * 25;
    const py = baseY - 12 - Math.sin(phase * 2) * 4;
    const pr = 4 + phase * 5;
    c.globalAlpha = (1 - phase) * 0.7;
    c.beginPath();
    c.arc(px, py, pr, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

function drawSceneSoccer(c, w, h, t) {
  // Himmel
  c.fillStyle = '#a8d8ea';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(60, 35, 12, 0, Math.PI * 2);
  c.arc(78, 33, 16, 0, Math.PI * 2);
  c.arc(94, 38, 10, 0, Math.PI * 2);
  c.fill();
  // Wiese
  c.fillStyle = '#7cba3a';
  c.fillRect(0, h - 60, w, 60);
  c.fillStyle = '#fff';
  c.fillRect(0, h - 60, w, 3);

  const cx = 110;
  const groundY = h - 60;
  const kick = Math.sin(t * 3) * 0.6;

  // Standbein
  c.strokeStyle = '#000';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx - 8, groundY);
  c.lineTo(cx - 4, groundY - 35);
  c.stroke();

  // Tretendes Bein
  const kickAngle = -0.3 + kick;
  const kickEndX = cx + 8 + Math.cos(kickAngle) * 35;
  const kickEndY = groundY - 35 + Math.sin(kickAngle) * 35;
  c.beginPath();
  c.moveTo(cx + 4, groundY - 35);
  c.lineTo(kickEndX, kickEndY);
  c.stroke();

  // Hose
  c.fillStyle = '#000';
  c.fillRect(cx - 14, groundY - 42, 28, 14);

  // Trikot
  c.fillStyle = '#27ae60';
  c.fillRect(cx - 16, groundY - 70, 32, 32);

  // Arme
  c.strokeStyle = '#f5cba7';
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(cx - 16, groundY - 65);
  c.lineTo(cx - 28, groundY - 50 + kick * 8);
  c.moveTo(cx + 16, groundY - 65);
  c.lineTo(cx + 28, groundY - 50 - kick * 8);
  c.stroke();

  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(cx, groundY - 87, 14, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();
  // Haare
  c.fillStyle = '#3d2817';
  c.beginPath();
  c.arc(cx, groundY - 92, 15, Math.PI * 1.05, Math.PI * 1.95);
  c.fill();
  // Augen
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(cx - 4, groundY - 86, 1.5, 0, Math.PI * 2);
  c.arc(cx + 4, groundY - 86, 1.5, 0, Math.PI * 2);
  c.fill();
  // Lächeln
  c.beginPath();
  c.arc(cx, groundY - 82, 4, 0.1, Math.PI - 0.1);
  c.stroke();

  // Fußball
  const ballX = kickEndX + 8;
  const ballY = kickEndY + 6;
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(ballX, ballY, 10, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(ballX, ballY, 3, 0, Math.PI * 2);
  c.fill();
  c.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    c.beginPath();
    c.moveTo(ballX + Math.cos(angle) * 3, ballY + Math.sin(angle) * 3);
    c.lineTo(ballX + Math.cos(angle) * 9, ballY + Math.sin(angle) * 9);
    c.stroke();
  }
}

function drawSceneButterfly(c, w, h, t) {
  // Himmel-Verlauf
  const grad = c.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ffd6e0');
  grad.addColorStop(1, '#ffe9b3');
  c.fillStyle = grad;
  c.fillRect(0, 0, w, h);

  // Wiese mit Blumen
  c.fillStyle = '#7cba3a';
  c.fillRect(0, h - 50, w, 50);
  const flowerColors = ['#e74c3c', '#f39c12', '#9b59b6', '#3498db', '#e91e63'];
  for (let i = 0; i < 5; i++) {
    const fx = 30 + i * 65;
    const fy = h - 50;
    c.strokeStyle = '#4a8c3a';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(fx, fy);
    c.lineTo(fx, fy - 16);
    c.stroke();
    c.fillStyle = flowerColors[i];
    for (let p = 0; p < 5; p++) {
      const angle = p * Math.PI * 2 / 5;
      c.beginPath();
      c.arc(fx + Math.cos(angle) * 4, fy - 16 + Math.sin(angle) * 4, 4, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#fff200';
    c.beginPath();
    c.arc(fx, fy - 16, 2.5, 0, Math.PI * 2);
    c.fill();
  }

  // Schmetterling
  const bx = w / 2 + Math.sin(t * 0.8) * 60;
  const by = h / 2 - 10 + Math.cos(t * 1.1) * 30;

  c.save();
  c.translate(bx, by);

  const flap = Math.sin(t * 12);
  const wingScale = 0.55 + Math.abs(flap) * 0.45;

  // Linker Flügel
  c.save();
  c.scale(wingScale, 1);
  c.fillStyle = '#e91e63';
  c.beginPath();
  c.ellipse(-15, -5, 14, 16, 0.3, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = '#9b59b6';
  c.beginPath();
  c.ellipse(-13, 8, 10, 12, 0.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(-15, -5, 3, 0, Math.PI * 2);
  c.fill();
  c.restore();

  // Rechter Flügel
  c.save();
  c.scale(-wingScale, 1);
  c.fillStyle = '#e91e63';
  c.beginPath();
  c.ellipse(-15, -5, 14, 16, 0.3, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = '#9b59b6';
  c.beginPath();
  c.ellipse(-13, 8, 10, 12, 0.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(-15, -5, 3, 0, Math.PI * 2);
  c.fill();
  c.restore();

  // Körper
  c.fillStyle = '#000';
  c.beginPath();
  c.ellipse(0, 0, 3, 14, 0, 0, Math.PI * 2);
  c.fill();

  // Fühler
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-2, -12);
  c.quadraticCurveTo(-5, -18, -7, -20);
  c.moveTo(2, -12);
  c.quadraticCurveTo(5, -18, 7, -20);
  c.stroke();
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(-7, -20, 1.2, 0, Math.PI * 2);
  c.arc(7, -20, 1.2, 0, Math.PI * 2);
  c.fill();

  c.restore();
}

const PIRATE_SCENES = [
  {
    draw: drawSceneTennis,
    match: [
      ['junge', 'kind'],
      ['spielt'],
      ['tennis'],
    ],
    example: 'Der Junge spielt Tennis',
    fillBlank: { sentence: 'Der Junge ___ Tennis.', answers: ['spielt'] },
    typo: { wrong: 'Der Junge spilt Tennis.', correct: 'Der Junge spielt Tennis.' },
    question: 'Was macht der Junge?',
  },
  {
    draw: drawSceneCatSleep,
    match: [
      ['katze', 'kätzchen'],
      ['schläft', 'schlummert', 'döst', 'ruht', 'pennt'],
    ],
    example: 'Die Katze schläft',
    fillBlank: { sentence: 'Die Katze ___.', answers: ['schläft', 'schlummert', 'döst', 'ruht', 'pennt'] },
    typo: { wrong: 'Die Katze schläfd.', correct: 'Die Katze schläft.' },
    question: 'Was macht die Katze?',
  },
  {
    draw: drawSceneDogRun,
    match: [
      ['hund', 'hündchen'],
      ['läuft', 'rennt', 'spaziert', 'geht', 'joggt', 'sprintet', 'eilt', 'flitzt'],
    ],
    example: 'Der Hund läuft',
    fillBlank: { sentence: 'Der Hund ___ schnell.', answers: ['läuft', 'rennt', 'spaziert', 'geht', 'joggt', 'sprintet', 'eilt'] },
    typo: { wrong: 'Der Hond läuft.', correct: 'Der Hund läuft.' },
    question: 'Was macht der Hund?',
  },
  {
    draw: drawSceneSun,
    match: [
      ['sonne'],
      ['scheint', 'lacht', 'strahlt', 'leuchtet'],
    ],
    example: 'Die Sonne scheint',
    fillBlank: { sentence: 'Die Sonne ___ hell.', answers: ['scheint', 'lacht', 'strahlt', 'leuchtet'] },
    typo: { wrong: 'Die Sone scheint.', correct: 'Die Sonne scheint.' },
    question: 'Was macht die Sonne?',
  },
  {
    draw: drawSceneFishSwim,
    match: [
      ['fisch'],
      ['schwimmt', 'taucht'],
    ],
    example: 'Der Fisch schwimmt',
    fillBlank: { sentence: 'Der Fisch ___ im Wasser.', answers: ['schwimmt', 'taucht'] },
    typo: { wrong: 'Der Fish schwimmt.', correct: 'Der Fisch schwimmt.' },
    question: 'Was macht der Fisch?',
  },
  {
    draw: drawSceneBirdFly,
    match: [
      ['vogel'],
      ['fliegt', 'flattert', 'segelt'],
    ],
    example: 'Der Vogel fliegt',
    fillBlank: { sentence: 'Der Vogel ___ am Himmel.', answers: ['fliegt', 'flattert', 'segelt'] },
    typo: { wrong: 'Der Vogal fliegt.', correct: 'Der Vogel fliegt.' },
    question: 'Was macht der Vogel?',
  },
  {
    draw: drawSceneGirlRead,
    match: [
      ['mädchen', 'kind'],
      ['liest'],
    ],
    example: 'Das Mädchen liest',
    fillBlank: { sentence: 'Das Mädchen ___ ein Buch.', answers: ['liest'] },
    typo: { wrong: 'Das Madchen liest.', correct: 'Das Mädchen liest.' },
    question: 'Was macht das Mädchen?',
  },
  {
    draw: drawSceneBike,
    match: [
      ['junge', 'kind'],
      ['fährt', 'radelt', 'fahrt'],
      ['fahrrad', 'rad'],
    ],
    example: 'Der Junge fährt Fahrrad',
    fillBlank: { sentence: 'Der Junge fährt ___.', answers: ['fahrrad', 'rad'] },
    typo: { wrong: 'Der Junge fert Fahrrad.', correct: 'Der Junge fährt Fahrrad.' },
    question: 'Was macht der Junge?',
  },
  {
    draw: drawSceneFrog,
    match: [
      ['frosch', 'fröschchen'],
      ['springt', 'hüpft'],
    ],
    example: 'Der Frosch springt',
    fillBlank: { sentence: 'Der Frosch ___ hoch.', answers: ['springt', 'hüpft'] },
    typo: { wrong: 'Der Frosh springt.', correct: 'Der Frosch springt.' },
    question: 'Was macht der Frosch?',
  },
  {
    draw: drawSceneCar,
    match: [
      ['auto', 'wagen'],
      ['fährt', 'rollt', 'rast', 'düst'],
    ],
    example: 'Das Auto fährt',
    fillBlank: { sentence: 'Das Auto ___ auf der Straße.', answers: ['fährt', 'rollt', 'rast', 'düst'] },
    typo: { wrong: 'Das Auto fert.', correct: 'Das Auto fährt.' },
    question: 'Was macht das Auto?',
  },
  {
    draw: drawSceneSoccer,
    match: [
      ['junge', 'kind'],
      ['spielt'],
      ['fußball'],
    ],
    example: 'Der Junge spielt Fußball',
    fillBlank: { sentence: 'Der Junge spielt ___.', answers: ['fußball'] },
    typo: { wrong: 'Der Junge spielt Fusball.', correct: 'Der Junge spielt Fußball.' },
    question: 'Was macht der Junge?',
  },
  {
    draw: drawSceneButterfly,
    match: [
      ['schmetterling'],
      ['fliegt', 'flattert'],
    ],
    example: 'Der Schmetterling fliegt',
    fillBlank: { sentence: 'Der Schmetterling ___.', answers: ['fliegt', 'flattert'] },
    typo: { wrong: 'Der Schmeterling fliegt.', correct: 'Der Schmetterling fliegt.' },
    question: 'Was macht der Schmetterling?',
  },
];

const PIRATE_MODES = ['describe', 'fill', 'order', 'typo', 'question'];

function pickPirateMode() {
  return PIRATE_MODES[Math.floor(Math.random() * PIRATE_MODES.length)];
}

function normalizeWord(s) {
  return s.toLowerCase().trim()
    .replace(/[.,!?;:„"„""''()]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function tokenize(s) {
  return normalizeWord(s).split(/\s+/).filter(w => w.length > 0);
}

// Ein Satz ist gültig, wenn aus jeder Wort-Gruppe der Szene
// mindestens ein Wort im Satz vorkommt (Subjekt + Verb + ggf. Objekt).
// Reihenfolge und Zusatzwörter sind egal.
function checkSentenceMatch(input, scene) {
  const words = tokenize(input);
  if (words.length === 0) return false;
  return scene.match.every(group =>
    group.some(target => words.includes(normalizeWord(target)))
  );
}

function renderPirateScene() {
  if (!pirateQuestion || !pirateQuestion.scene) return;
  clearScene();
  const t = (Date.now() - pirateQuestion.startTime) / 1000;
  pirateQuestion.scene.draw(sceneCtx, sceneCanvas.width, sceneCanvas.height, t);
}

function openPirateQuestion() {
  gameState = STATE.PIRATE_QUESTION;

  // Falls die Angel gerade ausgeworfen ist, einholen
  if (hook && hook.active) {
    hook.state = 'idle';
    hook.active = false;
    hook.fishCaught = null;
  }

  const scene = PIRATE_SCENES[Math.floor(Math.random() * PIRATE_SCENES.length)];
  const mode = pickPirateMode();

  pirateQuestion = {
    scene,
    mode,
    startTime: Date.now(),
    attempts: 0,
    maxAttempts: 3,
    scrambledWords: [],
    selectedIdx: [],
  };

  setupPirateUI();
  showOverlay('overlay-pirate');
  renderPirateScene();
  if (mode !== 'order') {
    setTimeout(() => $('pirate-input').focus(), 50);
  }
}

function setupPirateUI() {
  const { scene, mode } = pirateQuestion;
  const taskEl = $('pirate-task');
  const inputField = $('pirate-input');
  const instruction = $('pirate-instruction');

  taskEl.innerHTML = '';
  taskEl.classList.add('hidden');
  inputField.value = '';
  inputField.style.display = '';
  $('pirate-feedback-box').innerHTML = '';
  $('pirate-attempts').innerHTML = '&nbsp;';

  if (mode === 'describe') {
    instruction.textContent = '„Schreibe einen Satz, der zum Bild passt!"';
    inputField.placeholder = 'Schreibe einen Satz…';
  } else if (mode === 'fill') {
    instruction.textContent = '„Welches Wort fehlt im Satz?"';
    inputField.placeholder = 'Nur das fehlende Wort…';
    taskEl.classList.remove('hidden');
    const html = scene.fillBlank.sentence.replace('___', '<span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;</span>');
    taskEl.innerHTML = html;
  } else if (mode === 'order') {
    instruction.textContent = '„Bring die Wörter in die richtige Reihenfolge!"';
    inputField.style.display = 'none';
    setupOrderMode();
  } else if (mode === 'typo') {
    instruction.textContent = '„Finde den Fehler und schreibe den Satz richtig!"';
    inputField.placeholder = 'Schreibe den richtigen Satz…';
    taskEl.classList.remove('hidden');
    taskEl.innerHTML = `<span class="typo-sentence">${scene.typo.wrong}</span>`;
  } else if (mode === 'question') {
    instruction.textContent = '„Beantworte meine Frage!"';
    inputField.placeholder = 'Deine Antwort…';
    taskEl.classList.remove('hidden');
    taskEl.textContent = scene.question;
  }
}

function setupOrderMode() {
  const { scene } = pirateQuestion;
  const words = scene.example.split(/\s+/);
  // Fisher-Yates shuffle
  const indexed = words.map(w => ({ word: w, placed: false }));
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  // Falls Zufall = original, einmal mehr mischen
  if (indexed.map(x => x.word).join(' ') === scene.example && indexed.length > 1) {
    [indexed[0], indexed[1]] = [indexed[1], indexed[0]];
  }
  pirateQuestion.scrambledWords = indexed;
  pirateQuestion.selectedIdx = [];
  renderOrderUI();
}

function renderOrderUI() {
  const taskEl = $('pirate-task');
  taskEl.classList.remove('hidden');
  taskEl.innerHTML = '';

  // Antwort-Bereich
  const answerArea = document.createElement('div');
  answerArea.className = 'word-bank-answer';
  pirateQuestion.selectedIdx.forEach((scrambledIdx, position) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'word-chip';
    chip.textContent = pirateQuestion.scrambledWords[scrambledIdx].word;
    chip.onclick = () => {
      pirateQuestion.selectedIdx.splice(position, 1);
      pirateQuestion.scrambledWords[scrambledIdx].placed = false;
      renderOrderUI();
    };
    answerArea.appendChild(chip);
  });
  taskEl.appendChild(answerArea);

  // Wort-Bank
  const bankArea = document.createElement('div');
  bankArea.className = 'word-bank';
  pirateQuestion.scrambledWords.forEach((item, idx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'word-chip';
    chip.textContent = item.word;
    chip.disabled = item.placed;
    chip.onclick = () => {
      if (item.placed) return;
      pirateQuestion.selectedIdx.push(idx);
      item.placed = true;
      renderOrderUI();
    };
    bankArea.appendChild(chip);
  });
  taskEl.appendChild(bankArea);
}

// === Validierung pro Modus ===
function validateAnswer() {
  const { scene, mode } = pirateQuestion;

  if (mode === 'describe') {
    const text = $('pirate-input').value.trim();
    return checkSentenceMatch(text, scene);
  }

  if (mode === 'fill') {
    const text = normalizeWord($('pirate-input').value.trim());
    return scene.fillBlank.answers.some(a => normalizeWord(a) === text);
  }

  if (mode === 'order') {
    if (pirateQuestion.selectedIdx.length !== pirateQuestion.scrambledWords.length) return false;
    const ordered = pirateQuestion.selectedIdx
      .map(i => pirateQuestion.scrambledWords[i].word).join(' ');
    return normalizeWord(ordered) === normalizeWord(scene.example);
  }

  if (mode === 'typo') {
    const text = $('pirate-input').value.trim();
    return normalizeWord(text) === normalizeWord(scene.typo.correct);
  }

  if (mode === 'question') {
    // Nur Verb (+ optionales Objekt) prüfen — Subjekt darf weggelassen werden
    const text = $('pirate-input').value.trim();
    const words = tokenize(text);
    if (words.length === 0) return false;
    const verbAndObjGroups = scene.match.slice(1);
    return verbAndObjGroups.every(group =>
      group.some(target => words.includes(normalizeWord(target)))
    );
  }

  return false;
}

function getCorrectAnswer() {
  const { scene, mode } = pirateQuestion;
  if (mode === 'fill') return scene.fillBlank.answers[0];
  if (mode === 'typo') return scene.typo.correct;
  return scene.example;
}

// === Antwort + Mehrversuche-Logik ===
function attemptPirateAnswer() {
  if (!pirateQuestion) return;

  // Eingabe prüfen
  if (pirateQuestion.mode === 'order') {
    if (pirateQuestion.selectedIdx.length !== pirateQuestion.scrambledWords.length) {
      showSimpleFeedback('Du musst alle Wörter benutzen!', 'error');
      return;
    }
  } else {
    const text = $('pirate-input').value.trim();
    if (!text) {
      showSimpleFeedback('Schreibe eine Antwort!', 'error');
      $('pirate-input').focus();
      return;
    }
  }

  pirateQuestion.attempts++;

  if (validateAnswer()) {
    const tryWord = pirateQuestion.attempts === 1 ? 'beim ersten Versuch' :
                    pirateQuestion.attempts === 2 ? 'im zweiten Versuch' : 'im letzten Versuch';
    showSimpleFeedback(`Richtig ${tryWord}! "Argh, du darfst sie behalten…"`, 'success');
    setTimeout(() => closePirateQuestion(true), 1700);
    return;
  }

  // Falsch
  if (pirateQuestion.attempts >= pirateQuestion.maxAttempts) {
    showSimpleFeedback(`Falsch! Richtig wäre: „${getCorrectAnswer()}". Hahaha! Geklaut!`, 'error');
    boat.fishOnBoard = [];
    flashScreen();
    updateHUD();
    setTimeout(() => closePirateQuestion(false), 3000);
  } else {
    showHint();
    updateAttemptsCounter();
    if (pirateQuestion.mode === 'order') {
      // Reset für neuen Versuch
      pirateQuestion.selectedIdx = [];
      pirateQuestion.scrambledWords.forEach(item => { item.placed = false; });
      renderOrderUI();
    } else {
      const inp = $('pirate-input');
      inp.focus();
      inp.select();
    }
  }
}

function showSimpleFeedback(text, kind) {
  const box = $('pirate-feedback-box');
  box.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'feedback-line ' + kind;
  p.textContent = text;
  box.appendChild(p);
}

function showHint() {
  const { scene, mode, attempts } = pirateQuestion;
  const box = $('pirate-feedback-box');
  box.innerHTML = '';

  const heading = document.createElement('p');
  heading.className = 'feedback-line error';
  heading.textContent = `Versuch ${attempts}: noch nicht ganz richtig!`;
  box.appendChild(heading);

  if (mode === 'describe' || mode === 'question') {
    const text = $('pirate-input').value.trim();
    const words = tokenize(text);
    const groups = mode === 'question' ? scene.match.slice(1) : scene.match;
    const labels = mode === 'question'
      ? ['Verb (was passiert?)', 'Objekt (was genau?)']
      : ['Subjekt (wer/was?)', 'Verb (was passiert?)', 'Objekt (was genau?)'];

    const checks = document.createElement('div');
    checks.className = 'feedback-checks';
    groups.forEach((group, idx) => {
      const check = document.createElement('div');
      const found = group.some(t => words.includes(normalizeWord(t)));
      check.className = 'feedback-check ' + (found ? 'ok' : 'miss');
      check.textContent = (found ? '✓ ' : '✗ ') + labels[idx];
      checks.appendChild(check);
    });
    box.appendChild(checks);

    if (attempts === 2) {
      const missing = groups.find(g => !g.some(t => words.includes(normalizeWord(t))));
      if (missing) {
        const hint = document.createElement('p');
        hint.className = 'feedback-line hint';
        hint.textContent = `Tipp: das fehlende Wort beginnt mit „${missing[0][0].toUpperCase()}…"`;
        box.appendChild(hint);
      }
    }
  } else if (mode === 'fill') {
    if (attempts === 2) {
      const hint = document.createElement('p');
      hint.className = 'feedback-line hint';
      hint.textContent = `Tipp: das Wort beginnt mit „${scene.fillBlank.answers[0][0].toUpperCase()}…"`;
      box.appendChild(hint);
    }
  } else if (mode === 'typo') {
    if (attempts === 2) {
      const wrongWords = scene.typo.wrong.split(/\s+/);
      const correctWords = scene.typo.correct.split(/\s+/);
      const diffIdx = wrongWords.findIndex((w, i) =>
        normalizeWord(w) !== normalizeWord(correctWords[i] || ''));
      if (diffIdx >= 0) {
        const hint = document.createElement('p');
        hint.className = 'feedback-line hint';
        hint.textContent = `Tipp: schau dir das Wort „${wrongWords[diffIdx]}" genau an!`;
        box.appendChild(hint);
      }
    }
  } else if (mode === 'order') {
    if (attempts === 2) {
      const firstWord = scene.example.split(/\s+/)[0];
      const hint = document.createElement('p');
      hint.className = 'feedback-line hint';
      hint.textContent = `Tipp: der Satz beginnt mit „${firstWord}".`;
      box.appendChild(hint);
    }
  }
}

function updateAttemptsCounter() {
  const remaining = pirateQuestion.maxAttempts - pirateQuestion.attempts;
  const word = remaining === 1 ? 'Versuch' : 'Versuche';
  $('pirate-attempts').textContent = `Du hast noch ${remaining} ${word}.`;
}

function closePirateQuestion(_kept) {
  $('pirate-input').blur();
  pirateQuestion = null;
  if (pirate) {
    pirate.cooldown = PIRATE_COOLDOWN_AFTER_THEFT;
    pirate.retargetIn = 0;
  }
  if (boat) boat.invulnTimer = PLAYER_INVULN_AFTER_THEFT;
  hideOverlays();
  gameState = STATE.PLAYING;
}

// === Angel/Haken ===
function castOrRetract() {
  if (hook.state === 'idle') {
    // Boot voll? Dann nicht angeln
    if (boat.fishOnBoard.length >= BOAT_CAPACITY) {
      flashBootCount();
      return;
    }
    // Auswerfen — Haken wird an aktueller Bootsposition platziert
    hook.x = boat.x;
    hook.y = boat.y;
    hook.state = 'waiting';
    hook.timer = HOOK_TIMEOUT;
    hook.active = true;
    hook.fishCaught = null;
  } else {
    // Einholen
    hook.state = 'idle';
    hook.active = false;
    hook.fishCaught = null;
  }
}

function updateHook(dt) {
  if (!hook.active) return;

  if (hook.state === 'waiting') {
    hook.timer -= dt;
    if (hook.timer <= 0) {
      hook.state = 'idle';
      hook.active = false;
      return;
    }
    // Suche Fisch im Beißradius
    for (const f of fishes) {
      if (f.respawnIn > 0) continue;
      const d = Math.hypot(f.x - hook.x, f.y - hook.y);
      if (d < BITE_RADIUS) {
        hook.state = 'biting';
        hook.fishCaught = f;
        hook.timer = BITE_DURATION;
        break;
      }
    }
  } else if (hook.state === 'biting') {
    hook.timer -= dt;
    // Fisch zappelt am Haken
    if (hook.fishCaught) {
      const f = hook.fishCaught;
      f.x = hook.x + Math.sin(Date.now() / 50) * 4;
      f.y = hook.y + Math.cos(Date.now() / 50) * 4;
      f.vx = 0;
      f.vy = 0;
    }
    if (hook.timer <= 0) {
      // Gefangen! Fisch wandert mit seinem festen Preis ins Boot
      if (hook.fishCaught) {
        boat.fishOnBoard.push({
          color: hook.fishCaught.color,
          price: hook.fishCaught.price,
        });
        hook.fishCaught.respawnIn = RESPAWN_DELAY;
      }
      updateHUD();
      hook.state = 'idle';
      hook.active = false;
      hook.fishCaught = null;
    }
  }
}

// === Rendering ===
function render() {
  // Wasser-Hintergrund mit Tiefenverlauf
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#3aa1d8');
  grad.addColorStop(0.5, '#1e6a9c');
  grad.addColorStop(1, '#0a3a5e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Wellen (zwei Schichten)
  drawWaves();

  // Boots-Wake unter den Fischen, damit es nicht alles überdeckt
  if (boat && boat.wakes) drawWakes(boat.wakes);

  // Küste oben + drei Märkte mit Flaggen
  drawCoastline();
  for (const c of COUNTRIES) drawCountryMarket(c);

  // Welt zeichnen wenn vorhanden
  if (boat && fishes.length > 0) {
    for (const f of fishes) {
      if (f.respawnIn > 0) continue;
      drawFish(f);
    }
    if (hook && hook.active) {
      drawHook(hook, boat);
    }
    if (pirate) drawPirate(pirate);
    if (shark) drawShark(shark);
    drawBoat(boat);
  }
}

function drawCoastline() {
  // Sandstreifen am oberen Rand
  const sandGrad = ctx.createLinearGradient(0, 0, 0, COAST_HEIGHT);
  sandGrad.addColorStop(0, '#e8d18a');
  sandGrad.addColorStop(1, '#d4a85a');
  ctx.fillStyle = sandGrad;
  ctx.fillRect(0, 0, W, COAST_HEIGHT);

  // Brandungslinie (heller Strich)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const t = Date.now() / 600;
  for (let x = 0; x <= W; x += 8) {
    const y = COAST_HEIGHT + 1 + Math.sin((x + t * 20) / 30) * 1.5;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawCountryMarket(c) {
  const isOpen = c === openMarketCountry;
  const p = c.pier;

  ctx.save();
  if (!isOpen) ctx.globalAlpha = 0.45;

  // Glow um den offenen Markt
  if (isOpen) {
    const t = Date.now() / 300;
    const glow = 12 + Math.sin(t) * 4;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = glow;
  }

  // Pier — Holzplanken
  ctx.fillStyle = isOpen ? '#9c7a4d' : '#7a6240';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = '#5e4123';
  ctx.lineWidth = 1;
  for (let py = p.y + 8; py < p.y + p.h; py += 10) {
    ctx.beginPath();
    ctx.moveTo(p.x, py);
    ctx.lineTo(p.x + p.w, py);
    ctx.stroke();
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = isOpen ? '#ffd700' : '#5e4123';
  ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);

  // Pfosten am Pier-Ende
  ctx.fillStyle = '#5e4123';
  ctx.fillRect(p.x - 2, p.y + p.h - 6, 4, 8);
  ctx.fillRect(p.x + p.w - 2, p.y + p.h - 6, 4, 8);

  // Gebäude auf dem Land
  const bx = c.landX + 30;
  const bw = c.landW - 60;
  const by = 0;
  const bh = COAST_HEIGHT - 2;

  ctx.fillStyle = isOpen ? '#f5e9d3' : '#a89c82';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#7a5a30';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

  // Schild
  const sw = bw - 10;
  const sh = 12;
  const sx = bx + 5;
  const sy = bh - sh - 2;
  ctx.fillStyle = '#2c1810';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.fillStyle = isOpen ? '#ffd700' : '#888';
  ctx.font = 'bold 11px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.name.toUpperCase(), bx + bw / 2, sy + sh / 2 + 1);

  // Flagge oben am Gebäude
  drawFlag(c, bx + bw / 2 - 14, 1, 28, 18);

  // Pier-Status: OFFEN oder ZU
  if (isOpen) {
    ctx.fillStyle = 'rgba(255, 215, 0, 0.95)';
    ctx.font = 'bold 11px -apple-system, system-ui, sans-serif';
    ctx.fillText('OFFEN', p.x + p.w / 2, p.y + 10);
  } else {
    // Rotes "ZU"-Schild
    ctx.fillStyle = 'rgba(178, 34, 52, 0.95)';
    ctx.fillRect(p.x + 8, p.y + 4, p.w - 16, 14);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 11px -apple-system, system-ui, sans-serif';
    ctx.fillText('ZU', p.x + p.w / 2, p.y + 12);
  }

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawPirate(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  // Schatten
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 28, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rumpf — dunkles Holz
  ctx.fillStyle = '#2a1810';
  ctx.beginPath();
  ctx.moveTo(26, 0);
  ctx.lineTo(14, -15);
  ctx.lineTo(-22, -13);
  ctx.lineTo(-22, 13);
  ctx.lineTo(14, 15);
  ctx.closePath();
  ctx.fill();

  // Roter Streifen
  ctx.fillStyle = '#8b1a1a';
  ctx.fillRect(-22, -3, 48, 6);

  // Deck
  ctx.fillStyle = '#3d2818';
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(10, -11);
  ctx.lineTo(-18, -9);
  ctx.lineTo(-18, 9);
  ctx.lineTo(10, 11);
  ctx.closePath();
  ctx.fill();

  // Mast
  ctx.fillStyle = '#1a0f08';
  ctx.fillRect(-2, -16, 4, 32);

  // Schwarze Piratenflagge
  const wave = Math.sin(p.flagWave * 4) * 1.5;
  ctx.fillStyle = '#000';
  ctx.fillRect(2, -16 + wave, 14, 10);
  // Totenkopf (vereinfacht: 2 Augen + Mund)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -12 + wave, 1.5, 0, Math.PI * 2);
  ctx.arc(11, -12 + wave, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(7, -9 + wave, 5, 1);

  // Pirat (Figur mit rotem Bandana)
  ctx.fillStyle = '#d4a574';
  ctx.beginPath();
  ctx.arc(-4, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#cc0000';
  ctx.beginPath();
  ctx.arc(-4, -2, 4, Math.PI, 0);
  ctx.fill();

  ctx.restore();
}

function drawShark(s) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.angle);

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(3, 5, 32, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Körper — dunkler Blaugrau-Hai
  const bodyGrad = ctx.createLinearGradient(-32, -10, -32, 10);
  bodyGrad.addColorStop(0, '#4a5c6a');
  bodyGrad.addColorStop(0.5, '#2e3f4f');
  bodyGrad.addColorStop(1, '#c8cfd4');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  // Hauptkörper — schlanke Torpedo-Form
  ctx.moveTo(34, 0);          // Schnauze
  ctx.bezierCurveTo(20, -12, -14, -10, -32, -4);  // Rückenlinie
  ctx.lineTo(-38, 0);         // Schwanzansatz
  ctx.lineTo(-32, 4);         // Bauchseite unten
  ctx.bezierCurveTo(-14, 10, 20, 12, 34, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Schwanzflosse
  const tailWag = Math.sin(s.finWave * 4) * 6;
  ctx.fillStyle = '#3a4f5e';
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(-46, -12 + tailWag);
  ctx.lineTo(-44, -2);
  ctx.lineTo(-46, 10 + tailWag);
  ctx.closePath();
  ctx.fill();

  // Rückenflosse — markantes Dreieck
  ctx.fillStyle = '#2a3f4e';
  ctx.beginPath();
  ctx.moveTo(2, -10);         // Basisvorne
  ctx.lineTo(-10, -10);       // Basishinte
  ctx.lineTo(-4, -26);        // Spitze (ragt aus dem Wasser)
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Brustflosse links
  ctx.fillStyle = '#3a4f5e';
  ctx.beginPath();
  ctx.moveTo(8, 4);
  ctx.lineTo(-4, 8);
  ctx.lineTo(-2, 16);
  ctx.closePath();
  ctx.fill();

  // Auge
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(24, -3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(24.5, -3, 2, 0, Math.PI * 2);
  ctx.fill();

  // Maul — gezackt
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.lineTo(28, 4);
  ctx.stroke();

  ctx.restore();
}

function drawFlag(c, x, y, w, h) {
  ctx.save();
  // Flaggen-Rahmen
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.5;

  if (c.id === 'usa') {
    // 7 rote + 6 weiße Streifen, blaues Feld oben links
    const stripeH = h / 13;
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#b22234' : '#ffffff';
      ctx.fillRect(x, y + i * stripeH, w, stripeH + 0.5);
    }
    ctx.fillStyle = '#3c3b6e';
    ctx.fillRect(x, y, w * 0.42, stripeH * 7);
    // ein paar Sternchen andeuten
    ctx.fillStyle = '#fff';
    for (let sy = 0; sy < 3; sy++) {
      for (let sx = 0; sx < 4; sx++) {
        ctx.fillRect(x + 1.5 + sx * 2.5, y + 1.5 + sy * 2.5, 1, 1);
      }
    }
  } else if (c.id === 'ger') {
    // 3 horizontale Streifen schwarz/rot/gold
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h / 3);
    ctx.fillStyle = '#dd0000';
    ctx.fillRect(x, y + h / 3, w, h / 3);
    ctx.fillStyle = '#ffce00';
    ctx.fillRect(x, y + 2 * h / 3, w, h / 3);
  } else if (c.id === 'kor') {
    // Weißer Hintergrund mit Taegeuk-Kreis (vereinfacht)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) * 0.32;
    // obere Hälfte rot
    ctx.fillStyle = '#cd2e3a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0, false);
    ctx.fill();
    // untere Hälfte blau
    ctx.fillStyle = '#0047a0';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI, false);
    ctx.fill();
    // schwarze Trigramme an den Ecken (vereinfacht als 4 Striche)
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 1.5, y + 1.5, 4, 1);
    ctx.fillRect(x + w - 5.5, y + 1.5, 4, 1);
    ctx.fillRect(x + 1.5, y + h - 2.5, 4, 1);
    ctx.fillRect(x + w - 5.5, y + h - 2.5, 4, 1);
  }

  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

function drawWakes(wakes) {
  for (const w of wakes) {
    const t = w.age / w.maxAge;
    const r = 4 + t * 14;
    const alpha = (1 - t) * 0.35;
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawWaves() {
  const t = Date.now() / 1000;
  // Schicht 1 — größere, langsamere Wellen
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) {
    const baseY = (i * 90 + (t * 10) % 90) % H;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) {
      const y = baseY + Math.sin((x + t * 25) / 80) * 5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Schicht 2 — kleinere, schnellere Wellen
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 12; i++) {
    const baseY = (i * 55 + (t * 18) % 55) % H;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const y = baseY + Math.sin((x + t * 40) / 40) * 2.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Hilfsfunktionen für Farb-Verläufe
function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
function lightenColor(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255, r + 255 * amount)}, ${Math.min(255, g + 255 * amount)}, ${Math.min(255, b + 255 * amount)})`;
}
function darkenColor(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0, r - 255 * amount)}, ${Math.max(0, g - 255 * amount)}, ${Math.max(0, b - 255 * amount)})`;
}

function drawFish(f) {
  ctx.save();
  ctx.translate(f.x, f.y);
  const angle = Math.atan2(f.vy, f.vx) || 0;
  ctx.rotate(angle);

  // Schatten
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, f.size, f.size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Körper mit Verlauf für 3D-Effekt
  const bodyGrad = ctx.createLinearGradient(0, -f.size * 0.6, 0, f.size * 0.6);
  bodyGrad.addColorStop(0, lightenColor(f.color, 0.35));
  bodyGrad.addColorStop(0.5, f.color);
  bodyGrad.addColorStop(1, darkenColor(f.color, 0.25));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, f.size, f.size * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Konturlinie
  ctx.strokeStyle = darkenColor(f.color, 0.4);
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Schwanzflosse
  ctx.beginPath();
  ctx.moveTo(-f.size, 0);
  ctx.lineTo(-f.size - 9, -f.size * 0.6);
  ctx.lineTo(-f.size - 9, f.size * 0.6);
  ctx.closePath();
  ctx.fill();

  // Auge
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(f.size * 0.5, -f.size * 0.2, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ctx.arc(f.size * 0.55, -f.size * 0.2, 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBoat(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);

  // Schatten unter Boot
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 26, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rumpf
  ctx.fillStyle = '#8b4513';
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(12, -14);
  ctx.lineTo(-20, -12);
  ctx.lineTo(-20, 12);
  ctx.lineTo(12, 14);
  ctx.closePath();
  ctx.fill();

  // Deck
  ctx.fillStyle = '#a0522d';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(9, -10);
  ctx.lineTo(-16, -8);
  ctx.lineTo(-16, 8);
  ctx.lineTo(9, 10);
  ctx.closePath();
  ctx.fill();

  // Sitzbank
  ctx.fillStyle = '#6b3410';
  ctx.fillRect(-8, -7, 3, 14);
  ctx.fillRect(5, -7, 3, 14);

  // Fischer-Figur
  const playerColor = players[currentPlayer].color;
  ctx.fillStyle = playerColor;
  ctx.beginPath();
  ctx.arc(-2, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Hut
  ctx.fillStyle = '#3d2817';
  ctx.beginPath();
  ctx.arc(-2, -2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawHook(h, b) {
  // Beißradius andeuten beim Warten
  if (h.state === 'waiting') {
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(h.x, h.y, BITE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Schnur vom Boot zum Haken
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(h.x, h.y);
  ctx.stroke();

  // Haken
  ctx.fillStyle = h.state === 'biting' ? '#ff4444' : '#ffd700';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Köder-Punkt in der Mitte
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(h.x, h.y, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// === HUD ===
function updateHUD() {
  const p = players[currentPlayer];
  $('current-player').textContent = p.name;
  $('current-player').style.color = p.color;
  const m = Math.floor(timeLeft / 60);
  const s = Math.floor(timeLeft % 60).toString().padStart(2, '0');
  $('timer').textContent = `${m}:${s}`;
  $('money-hano').textContent = players[0].money;
  $('money-jonas').textContent = players[1].money;

  const onBoard = boat ? boat.fishOnBoard.length : 0;
  const bc = $('boot-count');
  bc.textContent = `Boot: ${onBoard}/${BOAT_CAPACITY}`;
  bc.classList.toggle('full', onBoard >= BOAT_CAPACITY);
}

function flashBootCount() {
  const bc = $('boot-count');
  bc.classList.add('full');
}

// === Markt ===
function openMarket(country) {
  gameState = STATE.MARKET;
  currentMarket = country;

  // Falls die Angel gerade ausgeworfen ist, einholen
  if (hook && hook.active) {
    hook.state = 'idle';
    hook.active = false;
    hook.fishCaught = null;
  }

  // Titel mit Flagge
  $('market-title').innerHTML =
    `<span class="flag-mini flag-${country.id}"></span>Markt ${country.name}`;

  const list = $('market-fish-list');
  list.innerHTML = '';

  boat.fishOnBoard.forEach((f, i) => {
    if (i > 0) {
      const plus = document.createElement('span');
      plus.className = 'plus';
      plus.textContent = '+';
      list.appendChild(plus);
    }
    const item = document.createElement('div');
    item.className = 'market-fish-item';
    item.style.borderColor = f.color;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = f.color;
    item.appendChild(dot);
    const lbl = document.createElement('span');
    lbl.textContent = f.price + '€';
    item.appendChild(lbl);
    list.appendChild(item);
  });

  const input = $('market-input');
  input.value = '';
  const feedback = $('market-feedback');
  feedback.textContent = '\u00a0';
  feedback.className = '';

  showOverlay('overlay-market');
  setTimeout(() => input.focus(), 50);
}

function attemptSell() {
  if (!boat || boat.fishOnBoard.length === 0 || !currentMarket) return;
  const input = $('market-input');
  const feedback = $('market-feedback');
  const answer = parseInt(input.value, 10);
  if (isNaN(answer)) {
    feedback.textContent = 'Bitte eine Zahl eingeben!';
    feedback.className = 'error';
    input.focus();
    return;
  }
  const correct = boat.fishOnBoard.reduce((s, f) => s + f.price, 0);
  if (answer === correct) {
    players[currentPlayer].money += correct;
    boat.fishOnBoard = [];
    feedback.textContent = `Richtig! +${correct}€`;
    feedback.className = 'success';
    updateHUD();
    setTimeout(closeMarket, 1100);
  } else {
    feedback.textContent = 'Falsch — versuch es nochmal!';
    feedback.className = 'error';
    input.value = '';
    input.focus();
  }
}

function closeMarket() {
  $('market-input').blur();
  hideOverlays();
  currentMarket = null;
  gameState = STATE.PLAYING;
}

// === Game Loop ===
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (gameState === STATE.PLAYING) {
    updateBoat(dt);
    updateFishes(dt);
    updateHook(dt);
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endTurn();
    }
    // Markt-Rotation
    marketSwitchCountdown -= dt;
    if (marketSwitchCountdown <= 0) {
      switchOpenMarket();
    }
    $('market-timer').textContent = Math.ceil(marketSwitchCountdown);
    // Pirat
    updatePirate(dt);
    checkPirateCollision();
    // Hai
    updateShark(dt);
    checkSharkCollision();
    updateHUD();
  } else if (gameState === STATE.MARKET) {
    // Während des Markts ist alles eingefroren — Spieler rechnet in Ruhe
  } else if (gameState === STATE.PIRATE_QUESTION) {
    // Spiel-Welt eingefroren, aber die Szene im Overlay weiter animieren
    renderPirateScene();
  } else if (gameState === STATE.TURN_END) {
    // Fische schwimmen weiter, damit es lebendig bleibt
    updateFishes(dt);
    stateTimer -= dt;
    if (stateTimer <= 0) {
      nextTurnOrEnd();
    }
  } else if (gameState === STATE.INTRO) {
    // Vorschau-Animation
    updateFishes(dt);
  }

  render();
  requestAnimationFrame(loop);
}

// === Start ===
$('btn-start').addEventListener('click', startGame);
$('btn-restart').addEventListener('click', startGame);
$('btn-sell').addEventListener('click', attemptSell);
$('market-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    attemptSell();
  }
});
$('btn-pirate-answer').addEventListener('click', attemptPirateAnswer);
$('pirate-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    attemptPirateAnswer();
  }
});

// Initialer Markt-Status fürs Menü
openMarketCountry = COUNTRIES[0];
updateMarketStatus();
$('market-timer').textContent = MARKET_OPEN_DURATION;
updateHUD();
showOverlay('overlay-menu');
requestAnimationFrame(loop);
