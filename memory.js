// === Memory ===
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const COLS = 6;
const ROWS = 5;
const PAD = 16;
const GAP = 10;
const CARD_W = (W - 2 * PAD - (COLS - 1) * GAP) / COLS;
const CARD_H = (H - 2 * PAD - (ROWS - 1) * GAP) / ROWS;

const MOTIFS = [
  'clown', 'bunny', 'runner', 'crybaby',
  'girlPorsche', 'boyLambo', 'catBalcony', 'diamondPlane', 'monkeyBugatti',
  'artistCat', 'sunflower', 'cherryVictory', 'owlBeer', 'eagleSnore', 'giraffeCake',
  'flyingCarpet', 'drunkSingingCat', 'multitaskOctopus', 'giantDwarves'
];
const PAIRS_PER_GAME = (COLS * ROWS) / 2;
const MISMATCH_DELAY = 950;

const state = {
  mode: null,            // 'vs' | 'solo'
  cards: [],
  flipped: [],           // indices currently face up but not yet matched
  lockInput: false,
  currentPlayer: 'p1',   // 'p1' | 'p2'
  scores: { p1: 0, p2: 0 },
  names: { p1: 'Hano', p2: 'Jonas' },
  startTime: 0,
  endTime: 0,
  finished: false,
  flipAnims: new Map()   // index -> { startTime }
};

// === DOM ===
const overlayMenu = document.getElementById('overlay-menu');
const overlayGameover = document.getElementById('overlay-gameover');
const btnModeVs = document.getElementById('btn-mode-vs');
const btnModeSolo = document.getElementById('btn-mode-solo');
const btnRestart = document.getElementById('btn-restart');
const hudMode = document.getElementById('hud-mode');
const hudTurn = document.getElementById('hud-turn');
const hudScores = document.getElementById('hud-scores');
const hudTimer = document.getElementById('hud-timer');
const currentPlayerEl = document.getElementById('current-player');
const scoreP1El = document.getElementById('score-p1');
const scoreP2El = document.getElementById('score-p2');
const labelP1El = document.getElementById('label-p1');
const labelP2El = document.getElementById('label-p2');
const timerEl = document.getElementById('timer-display');
const gameoverTitle = document.getElementById('gameover-title');
const gameoverResult = document.getElementById('gameover-result');
const gameoverDetail = document.getElementById('gameover-detail');
const scoreBoxP1 = document.querySelector('.score-box.p1');
const scoreBoxP2 = document.querySelector('.score-box.p2');
const nameInput1 = document.getElementById('name-1');
const nameInput2 = document.getElementById('name-2');

// === Init / Modus ===
btnModeVs.addEventListener('click', () => startGame('vs'));
btnModeSolo.addEventListener('click', () => startGame('solo'));
btnRestart.addEventListener('click', () => {
  overlayGameover.classList.add('hidden');
  overlayMenu.classList.remove('hidden');
});

function startGame(mode) {
  state.mode = mode;
  state.names.p1 = (nameInput1.value.trim() || 'Spieler 1').slice(0, 14);
  state.names.p2 = (nameInput2.value.trim() || 'Spieler 2').slice(0, 14);
  state.cards = buildDeck();
  state.flipped = [];
  state.lockInput = false;
  state.currentPlayer = 'p1';
  state.scores = { p1: 0, p2: 0 };
  state.startTime = performance.now();
  state.endTime = 0;
  state.finished = false;
  state.flipAnims.clear();

  overlayMenu.classList.add('hidden');
  overlayGameover.classList.add('hidden');

  // Labels in HUD setzen
  labelP1El.textContent = state.names.p1;
  labelP2El.textContent = state.names.p2;

  // HUD
  if (mode === 'vs') {
    hudMode.textContent = `${state.names.p1} vs ${state.names.p2}`;
    hudTurn.classList.remove('hidden');
    hudScores.classList.remove('hidden');
    hudTimer.classList.add('hidden');
  } else {
    hudMode.textContent = 'Solo';
    hudTurn.classList.add('hidden');
    hudScores.classList.add('hidden');
    hudTimer.classList.remove('hidden');
  }
  updateHud();
}

function buildDeck() {
  // Pool zufällig mischen und PAIRS_PER_GAME Motive ziehen
  const pool = [...MOTIFS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, PAIRS_PER_GAME);
  const ids = [...chosen, ...chosen];
  // Fisher-Yates auf Karten
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const cards = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      cards.push({
        motifId: ids[idx],
        x: PAD + c * (CARD_W + GAP),
        y: PAD + r * (CARD_H + GAP),
        w: CARD_W,
        h: CARD_H,
        faceUp: false,
        matched: false
      });
    }
  }
  return cards;
}

// === Input ===
canvas.addEventListener('click', (e) => {
  if (state.lockInput || state.finished || state.cards.length === 0) return;
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (W / rect.width);
  const sy = (e.clientY - rect.top) * (H / rect.height);
  for (let i = 0; i < state.cards.length; i++) {
    const c = state.cards[i];
    if (c.matched || c.faceUp) continue;
    if (sx >= c.x && sx <= c.x + c.w && sy >= c.y && sy <= c.y + c.h) {
      flipCard(i);
      break;
    }
  }
});

function flipCard(i) {
  const card = state.cards[i];
  card.faceUp = true;
  state.flipped.push(i);
  state.flipAnims.set(i, { startTime: performance.now() });

  if (state.flipped.length === 2) {
    state.lockInput = true;
    const [a, b] = state.flipped;
    const cardA = state.cards[a];
    const cardB = state.cards[b];
    if (cardA.motifId === cardB.motifId) {
      // Match
      setTimeout(() => {
        cardA.matched = true;
        cardB.matched = true;
        state.flipped = [];
        state.lockInput = false;
        if (state.mode === 'vs') {
          state.scores[state.currentPlayer]++;
        }
        updateHud();
        checkGameOver();
      }, 450);
    } else {
      // Kein Match
      setTimeout(() => {
        cardA.faceUp = false;
        cardB.faceUp = false;
        state.flipped = [];
        state.lockInput = false;
        if (state.mode === 'vs') {
          state.currentPlayer = state.currentPlayer === 'p1' ? 'p2' : 'p1';
          updateHud();
        }
      }, MISMATCH_DELAY);
    }
  }
}

function checkGameOver() {
  if (state.cards.every(c => c.matched)) {
    state.finished = true;
    state.endTime = performance.now();
    showGameOver();
  }
}

function showGameOver() {
  if (state.mode === 'vs') {
    const a = state.scores.p1;
    const b = state.scores.p2;
    let resultText;
    if (a > b) resultText = `${state.names.p1} gewinnt!`;
    else if (b > a) resultText = `${state.names.p2} gewinnt!`;
    else resultText = 'Unentschieden!';
    gameoverTitle.textContent = 'Fertig!';
    gameoverResult.textContent = resultText;
    gameoverDetail.innerHTML = `${state.names.p1}: <b>${a}</b> &nbsp;·&nbsp; ${state.names.p2}: <b>${b}</b>`;
  } else {
    const secs = (state.endTime - state.startTime) / 1000;
    gameoverTitle.textContent = 'Geschafft!';
    gameoverResult.textContent = 'Alle Paare gefunden';
    gameoverDetail.innerHTML = `Deine Zeit: <b>${formatTime(secs)}</b>`;
  }
  overlayGameover.classList.remove('hidden');
}

function updateHud() {
  if (state.mode === 'vs') {
    currentPlayerEl.textContent = state.names[state.currentPlayer];
    scoreP1El.textContent = state.scores.p1;
    scoreP2El.textContent = state.scores.p2;
    scoreBoxP1.classList.toggle('active', state.currentPlayer === 'p1');
    scoreBoxP2.classList.toggle('active', state.currentPlayer === 'p2');
  }
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// === Render-Loop ===
function loop(now) {
  ctx.clearRect(0, 0, W, H);
  // Hintergrund
  ctx.fillStyle = '#1f3a55';
  ctx.fillRect(0, 0, W, H);

  const t = now / 1000;

  // Solo-Timer aktualisieren
  if (state.mode === 'solo' && !state.finished && state.startTime > 0) {
    const secs = (now - state.startTime) / 1000;
    timerEl.textContent = formatTime(secs);
  }

  for (let i = 0; i < state.cards.length; i++) {
    drawCard(state.cards[i], i, t, now);
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// === Karten zeichnen ===
function drawCard(card, idx, t, now) {
  // Flip-Animation: schrumpft auf 0 und wieder hoch
  const anim = state.flipAnims.get(idx);
  let scaleX = 1;
  let showFront = card.faceUp || card.matched;
  if (anim) {
    const elapsed = now - anim.startTime;
    const dur = 220;
    if (elapsed < dur) {
      const progress = elapsed / dur;
      // 1 -> 0 -> 1
      scaleX = Math.abs(1 - progress * 2);
      // Erst nach Hälfte Vorderseite zeigen
      showFront = (progress >= 0.5) ? (card.faceUp || card.matched) : !(card.faceUp || card.matched);
    } else {
      state.flipAnims.delete(idx);
    }
  }

  ctx.save();
  const cx = card.x + card.w / 2;
  ctx.translate(cx, 0);
  ctx.scale(scaleX, 1);
  ctx.translate(-cx, 0);

  if (showFront) {
    drawCardFront(card, t);
  } else {
    drawCardBack(card, t);
  }

  ctx.restore();
}

function drawCardFront(card, t) {
  // Heller Hintergrund mit Goldrahmen
  roundRect(ctx, card.x, card.y, card.w, card.h, 12);
  ctx.fillStyle = '#fdf7e3';
  ctx.fill();
  ctx.lineWidth = card.matched ? 5 : 3;
  ctx.strokeStyle = card.matched ? '#a3e635' : '#ffd700';
  ctx.stroke();

  // Motiv in Sub-Bereich (mit Rand)
  const m = 14;
  const mx = card.x + m;
  const my = card.y + m;
  const mw = card.w - 2 * m;
  const mh = card.h - 2 * m;

  ctx.save();
  ctx.beginPath();
  roundRect(ctx, mx, my, mw, mh, 6);
  ctx.clip();

  switch (card.motifId) {
    case 'clown':         drawMotifClown(ctx, mx, my, mw, mh, t); break;
    case 'bunny':         drawMotifBunny(ctx, mx, my, mw, mh, t); break;
    case 'runner':        drawMotifRunner(ctx, mx, my, mw, mh, t); break;
    case 'crybaby':       drawMotifCryingBoy(ctx, mx, my, mw, mh, t); break;
    case 'girlPorsche':   drawMotifGirlPorsche(ctx, mx, my, mw, mh, t); break;
    case 'boyLambo':      drawMotifBoyLambo(ctx, mx, my, mw, mh, t); break;
    case 'catBalcony':    drawMotifCatBalcony(ctx, mx, my, mw, mh, t); break;
    case 'diamondPlane':  drawMotifDiamondPlane(ctx, mx, my, mw, mh, t); break;
    case 'monkeyBugatti': drawMotifMonkeyBugatti(ctx, mx, my, mw, mh, t); break;
    case 'artistCat':     drawMotifArtistCat(ctx, mx, my, mw, mh, t); break;
    case 'sunflower':     drawMotifSunflower(ctx, mx, my, mw, mh, t); break;
    case 'cherryVictory': drawMotifCherryVictory(ctx, mx, my, mw, mh, t); break;
    case 'owlBeer':       drawMotifOwlBeer(ctx, mx, my, mw, mh, t); break;
    case 'eagleSnore':    drawMotifEagleSnore(ctx, mx, my, mw, mh, t); break;
    case 'giraffeCake':     drawMotifGiraffeCake(ctx, mx, my, mw, mh, t); break;
    case 'flyingCarpet':    drawMotifFlyingCarpet(ctx, mx, my, mw, mh, t); break;
    case 'drunkSingingCat': drawMotifDrunkSingingCat(ctx, mx, my, mw, mh, t); break;
    case 'multitaskOctopus':drawMotifMultitaskOctopus(ctx, mx, my, mw, mh, t); break;
    case 'giantDwarves':    drawMotifGiantDwarves(ctx, mx, my, mw, mh, t); break;
  }
  ctx.restore();
}

function drawCardBack(card, t) {
  // Dunkler Hintergrund mit Goldrahmen
  roundRect(ctx, card.x, card.y, card.w, card.h, 12);
  const grad = ctx.createLinearGradient(card.x, card.y, card.x, card.y + card.h);
  grad.addColorStop(0, '#3a1530');
  grad.addColorStop(1, '#2a0a1a');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffd700';
  ctx.stroke();

  // Großes zentrales Herz
  const cx = card.x + card.w / 2;
  const cy = card.y + card.h / 2;
  const pulse = 1 + Math.sin(t * 3) * 0.04;
  drawHeart(ctx, cx, cy, 36 * pulse, '#e63946');

  // 4 kleinere Herzen in den Ecken
  const off = Math.min(card.w, card.h) * 0.28;
  drawHeart(ctx, cx - off, cy - off * 0.85, 12, '#ff8ad1');
  drawHeart(ctx, cx + off, cy - off * 0.85, 12, '#ff8ad1');
  drawHeart(ctx, cx - off, cy + off * 0.85, 12, '#ff8ad1');
  drawHeart(ctx, cx + off, cy + off * 0.85, 12, '#ff8ad1');
}

// === Hilfsfunktionen ===
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

function drawHeart(c, cx, cy, size, fill) {
  c.save();
  c.translate(cx, cy);
  c.beginPath();
  // Herzform aus zwei Kreisen + Spitze unten
  const s = size / 30;
  c.moveTo(0, -8 * s);
  c.bezierCurveTo(-2 * s, -14 * s, -14 * s, -14 * s, -14 * s, -4 * s);
  c.bezierCurveTo(-14 * s, 4 * s, -2 * s, 10 * s, 0, 16 * s);
  c.bezierCurveTo(2 * s, 10 * s, 14 * s, 4 * s, 14 * s, -4 * s);
  c.bezierCurveTo(14 * s, -14 * s, 2 * s, -14 * s, 0, -8 * s);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = 1.4;
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.stroke();
  // Glanzpunkt
  c.beginPath();
  c.ellipse(-5 * s, -5 * s, 3 * s, 2 * s, -0.4, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.fill();
  c.restore();
}

// === Motive ===
function drawMotifClown(c, x, y, w, h, t) {
  // Hintergrund
  c.fillStyle = '#fef3c7';
  c.fillRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2 + 6;
  const r = Math.min(w, h) * 0.32;

  // Hutkrempe
  c.fillStyle = '#7a3aa0';
  c.beginPath();
  c.ellipse(cx, cy - r * 0.85, r * 1.15, r * 0.18, 0, 0, Math.PI * 2);
  c.fill();
  // Spitzhut
  c.beginPath();
  c.moveTo(cx - r * 0.7, cy - r * 0.85);
  c.lineTo(cx + r * 0.7, cy - r * 0.85);
  c.lineTo(cx + 4, cy - r * 2.1);
  c.lineTo(cx - 4, cy - r * 2.1);
  c.closePath();
  c.fillStyle = '#3a86ff';
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.stroke();
  // Hutkugel
  c.fillStyle = '#ffd700';
  c.beginPath();
  c.arc(cx, cy - r * 2.15, 6, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Gesicht (weiß)
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 2;
  c.stroke();

  // Bunte Haarbüschel seitlich
  c.fillStyle = '#ff5e7a';
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(cx - r - 4, cy - r * 0.4 + i * (r * 0.4), 8, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(cx + r + 4, cy - r * 0.4 + i * (r * 0.4), 8, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#fcd34d';
  c.beginPath();
  c.arc(cx - r - 9, cy + r * 0.1, 6, 0, Math.PI * 2);
  c.arc(cx + r + 9, cy + r * 0.1, 6, 0, Math.PI * 2);
  c.fill();

  // Augen mit blauem Stern-Make-up
  c.fillStyle = '#3a86ff';
  c.beginPath();
  c.moveTo(cx - r * 0.42, cy - r * 0.35);
  c.lineTo(cx - r * 0.42 - 6, cy - r * 0.55);
  c.lineTo(cx - r * 0.42, cy - r * 0.7);
  c.lineTo(cx - r * 0.42 + 6, cy - r * 0.55);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(cx + r * 0.42, cy - r * 0.35);
  c.lineTo(cx + r * 0.42 - 6, cy - r * 0.55);
  c.lineTo(cx + r * 0.42, cy - r * 0.7);
  c.lineTo(cx + r * 0.42 + 6, cy - r * 0.55);
  c.closePath();
  c.fill();
  // Augen Pupillen
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(cx - r * 0.42, cy - r * 0.25, 3, 0, Math.PI * 2);
  c.arc(cx + r * 0.42, cy - r * 0.25, 3, 0, Math.PI * 2);
  c.fill();

  // Wangenkreise
  c.fillStyle = '#ff8ad1';
  c.beginPath();
  c.arc(cx - r * 0.55, cy + r * 0.15, 6, 0, Math.PI * 2);
  c.arc(cx + r * 0.55, cy + r * 0.15, 6, 0, Math.PI * 2);
  c.fill();

  // Rote Knubbelnase
  c.fillStyle = '#e63946';
  c.beginPath();
  c.arc(cx, cy + r * 0.05, 8, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.stroke();
  // Glanz auf Nase
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(cx - 2, cy + r * 0.05 - 2, 2, 0, Math.PI * 2);
  c.fill();

  // Mund mit rausgestreckter Zunge
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(cx, cy + r * 0.45, r * 0.32, 0, Math.PI);
  c.fill();
  // Zunge — schräg nach unten/links
  c.save();
  c.translate(cx, cy + r * 0.45);
  c.rotate(0.35);
  c.fillStyle = '#ff5e7a';
  c.beginPath();
  c.moveTo(-6, 4);
  c.quadraticCurveTo(-4, 22, 4, 24);
  c.quadraticCurveTo(12, 22, 10, 4);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.stroke();
  // Zungenrille
  c.beginPath();
  c.moveTo(2, 6);
  c.lineTo(2, 22);
  c.stroke();
  c.restore();
}

function drawMotifBunny(c, x, y, w, h, t) {
  // Hintergrund
  c.fillStyle = '#e0f2fe';
  c.fillRect(x, y, w, h);

  const cx = x + w / 2;
  const cy = y + h / 2 + 8;
  const r = Math.min(w, h) * 0.22;

  // Körper (oval)
  c.fillStyle = '#ff8ad1';
  c.beginPath();
  c.ellipse(cx, cy + r * 1.4, r * 1.1, r * 1.3, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 2;
  c.stroke();

  // Lange Ohren
  c.fillStyle = '#ff8ad1';
  // Linkes Ohr
  c.save();
  c.translate(cx - r * 0.45, cy - r * 0.85);
  c.rotate(-0.18);
  c.beginPath();
  c.ellipse(0, -r * 0.95, r * 0.22, r * 0.95, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Innenseite
  c.fillStyle = '#ffc1e3';
  c.beginPath();
  c.ellipse(0, -r * 0.95, r * 0.11, r * 0.7, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // Rechtes Ohr
  c.fillStyle = '#ff8ad1';
  c.save();
  c.translate(cx + r * 0.45, cy - r * 0.85);
  c.rotate(0.18);
  c.beginPath();
  c.ellipse(0, -r * 0.95, r * 0.22, r * 0.95, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#ffc1e3';
  c.beginPath();
  c.ellipse(0, -r * 0.95, r * 0.11, r * 0.7, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();

  // Kopf
  c.fillStyle = '#ff8ad1';
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 2;
  c.stroke();

  // Augen
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(cx - r * 0.35, cy - r * 0.1, 3, 0, Math.PI * 2);
  c.arc(cx + r * 0.35, cy - r * 0.1, 3, 0, Math.PI * 2);
  c.fill();
  // Glanz
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(cx - r * 0.35 + 1, cy - r * 0.1 - 1, 1, 0, Math.PI * 2);
  c.arc(cx + r * 0.35 + 1, cy - r * 0.1 - 1, 1, 0, Math.PI * 2);
  c.fill();

  // Nase (kleines Dreieck)
  c.fillStyle = '#e63946';
  c.beginPath();
  c.moveTo(cx, cy + r * 0.15);
  c.lineTo(cx - 4, cy + r * 0.05);
  c.lineTo(cx + 4, cy + r * 0.05);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1;
  c.stroke();

  // Mund (Y-Form)
  c.beginPath();
  c.moveTo(cx, cy + r * 0.15);
  c.lineTo(cx, cy + r * 0.28);
  c.moveTo(cx, cy + r * 0.28);
  c.lineTo(cx - 4, cy + r * 0.36);
  c.moveTo(cx, cy + r * 0.28);
  c.lineTo(cx + 4, cy + r * 0.36);
  c.lineWidth = 1.4;
  c.stroke();

  // Pfoten / Arme — die ein Herz halten (vor dem Körper)
  const armY = cy + r * 0.7;
  c.fillStyle = '#ff8ad1';
  c.beginPath();
  c.ellipse(cx - r * 0.55, armY, r * 0.22, r * 0.38, 0.3, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 2;
  c.stroke();
  c.beginPath();
  c.ellipse(cx + r * 0.55, armY, r * 0.22, r * 0.38, -0.3, 0, Math.PI * 2);
  c.fillStyle = '#ff8ad1';
  c.fill();
  c.stroke();

  // Großes Herz in den Pfoten
  drawHeart(c, cx, armY + 4, 30, '#e63946');
}

function drawMotifRunner(c, x, y, w, h, t) {
  // Hintergrund: Stadion-Gefühl
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#fcd34d');
  sky.addColorStop(1, '#f59e0b');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  // Bahn unten
  c.fillStyle = '#c2410c';
  c.fillRect(x, y + h - h * 0.18, w, h * 0.18);
  // Bahnlinien
  c.strokeStyle = '#fff';
  c.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    const ly = y + h - h * 0.18 + (h * 0.18 / 4) * i;
    c.beginPath();
    c.moveTo(x, ly);
    c.lineTo(x + w, ly);
    c.stroke();
  }

  // Zielband oben — gerissen, hängt links und rechts
  c.strokeStyle = '#fff';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(x + 6, y + h * 0.32);
  c.quadraticCurveTo(x + w * 0.25, y + h * 0.42, x + w * 0.35, y + h * 0.45);
  c.stroke();
  c.beginPath();
  c.moveTo(x + w - 6, y + h * 0.32);
  c.quadraticCurveTo(x + w * 0.75, y + h * 0.42, x + w * 0.65, y + h * 0.45);
  c.stroke();

  const cx = x + w / 2;
  const groundY = y + h - h * 0.18;
  const headR = Math.min(w, h) * 0.085;

  // Beine (rennend / im Sprung)
  c.strokeStyle = '#1a1a2e';
  c.lineCap = 'round';
  c.lineWidth = 6;
  // Standbein (leicht gebeugt)
  c.beginPath();
  c.moveTo(cx - 4, groundY - 30);
  c.lineTo(cx - 14, groundY - 14);
  c.lineTo(cx - 8, groundY);
  c.stroke();
  // Hinterbein (nach hinten gestreckt)
  c.beginPath();
  c.moveTo(cx + 2, groundY - 30);
  c.lineTo(cx + 24, groundY - 18);
  c.lineTo(cx + 32, groundY - 4);
  c.stroke();
  // Schuhe
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(cx - 12, groundY);
  c.lineTo(cx - 4, groundY);
  c.stroke();
  c.beginPath();
  c.moveTo(cx + 30, groundY - 4);
  c.lineTo(cx + 38, groundY - 4);
  c.stroke();

  // Körper / Trikot
  c.fillStyle = '#3a86ff';
  c.beginPath();
  c.moveTo(cx - 14, groundY - 30);
  c.lineTo(cx + 12, groundY - 30);
  c.lineTo(cx + 14, groundY - 70);
  c.lineTo(cx - 16, groundY - 70);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 2;
  c.stroke();
  // Startnummer
  c.fillStyle = '#fff';
  c.fillRect(cx - 9, groundY - 60, 18, 14);
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1;
  c.strokeRect(cx - 9, groundY - 60, 18, 14);
  c.fillStyle = '#1a1a2e';
  c.font = 'bold 11px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('1', cx, groundY - 53);

  // Hals
  c.strokeStyle = '#f5cba7';
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(cx, groundY - 70);
  c.lineTo(cx, groundY - 78);
  c.stroke();

  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(cx, groundY - 78 - headR, headR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.stroke();
  // Haare
  c.fillStyle = '#3a1f10';
  c.beginPath();
  c.arc(cx, groundY - 78 - headR, headR, Math.PI + 0.2, 2 * Math.PI - 0.2);
  c.fill();

  // Augen — geschlossen vor Freude / Lächeln
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(cx - headR * 0.4, groundY - 78 - headR + 1, 3, Math.PI * 0.15, Math.PI * 0.85);
  c.stroke();
  c.beginPath();
  c.arc(cx + headR * 0.4, groundY - 78 - headR + 1, 3, Math.PI * 0.15, Math.PI * 0.85);
  c.stroke();
  // Großes Lächeln
  c.beginPath();
  c.arc(cx, groundY - 78 - headR + 3, headR * 0.55, 0.1, Math.PI - 0.1);
  c.lineWidth = 2;
  c.stroke();

  // Arme hochgerissen — einer hält den Staffelstab
  c.strokeStyle = '#f5cba7';
  c.lineWidth = 6;
  c.lineCap = 'round';
  // Linker Arm hoch
  c.beginPath();
  c.moveTo(cx - 14, groundY - 65);
  c.lineTo(cx - 28, groundY - 95);
  c.lineTo(cx - 22, groundY - 120);
  c.stroke();
  // Rechter Arm hoch
  c.beginPath();
  c.moveTo(cx + 12, groundY - 65);
  c.lineTo(cx + 28, groundY - 95);
  c.lineTo(cx + 22, groundY - 120);
  c.stroke();

  // Staffelstab in rechter Hand (rot/weiß)
  c.save();
  c.translate(cx + 22, groundY - 120);
  c.rotate(-0.4);
  c.fillStyle = '#e63946';
  c.fillRect(-4, -28, 8, 32);
  c.fillStyle = '#fff';
  c.fillRect(-4, -18, 8, 8);
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.4;
  c.strokeRect(-4, -28, 8, 32);
  c.restore();

  // Schweißtröpfchen
  c.fillStyle = '#67e8f9';
  c.beginPath();
  c.arc(cx + headR + 4, groundY - 78 - headR - 2, 2, 0, Math.PI * 2);
  c.arc(cx + headR + 8, groundY - 78 - headR + 4, 1.5, 0, Math.PI * 2);
  c.fill();
}

function drawMotifCryingBoy(c, x, y, w, h, t) {
  // Hintergrund
  c.fillStyle = '#fde2e4';
  c.fillRect(x, y, w, h);
  // Boden
  c.fillStyle = '#9ca3af';
  c.fillRect(x, y + h - h * 0.12, w, h * 0.12);

  const cx = x + w / 2;
  const groundY = y + h - h * 0.12;
  const headR = Math.min(w, h) * 0.22;
  const headCy = y + h * 0.42;

  // Beine
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx - 12, groundY - 30);
  c.lineTo(cx - 12, groundY);
  c.moveTo(cx + 12, groundY - 30);
  c.lineTo(cx + 12, groundY);
  c.stroke();
  // Schuhe
  c.fillStyle = '#1a1a2e';
  c.fillRect(cx - 18, groundY - 4, 14, 6);
  c.fillRect(cx + 4, groundY - 4, 14, 6);

  // T-Shirt
  c.fillStyle = '#ffd166';
  c.beginPath();
  c.moveTo(cx - 22, headCy + headR + 4);
  c.lineTo(cx + 22, headCy + headR + 4);
  c.lineTo(cx + 26, groundY - 28);
  c.lineTo(cx - 26, groundY - 28);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.8;
  c.stroke();

  // Arme — eine Hand reibt am Auge
  c.strokeStyle = '#f5cba7';
  c.lineWidth = 6;
  c.lineCap = 'round';
  // Linker Arm hoch zum Auge
  c.beginPath();
  c.moveTo(cx - 22, headCy + headR + 8);
  c.lineTo(cx - headR * 0.6, headCy + 4);
  c.stroke();
  // Faust am Auge
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(cx - headR * 0.6, headCy + 4, 7, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.4;
  c.stroke();
  // Rechter Arm hängt
  c.strokeStyle = '#f5cba7';
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(cx + 22, headCy + headR + 8);
  c.lineTo(cx + 26, groundY - 32);
  c.stroke();

  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(cx, headCy, headR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 2;
  c.stroke();
  // Haare (Kappe oben)
  c.fillStyle = '#5a3015';
  c.beginPath();
  c.arc(cx, headCy, headR, Math.PI + 0.3, 2 * Math.PI - 0.3);
  c.fill();
  // Pony
  c.beginPath();
  c.moveTo(cx - headR * 0.85, headCy - headR * 0.2);
  c.quadraticCurveTo(cx, headCy - headR * 0.3, cx + headR * 0.85, headCy - headR * 0.2);
  c.lineTo(cx + headR * 0.6, headCy - headR * 0.05);
  c.quadraticCurveTo(cx, headCy - headR * 0.15, cx - headR * 0.6, headCy - headR * 0.05);
  c.closePath();
  c.fill();

  // Augen (zugekniffen)
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 2;
  // Rechtes Auge — V-Form (zugekniffen)
  c.beginPath();
  c.moveTo(cx + headR * 0.25, headCy + 2);
  c.lineTo(cx + headR * 0.45, headCy - 2);
  c.lineTo(cx + headR * 0.65, headCy + 2);
  c.stroke();
  // Linkes Auge — durch Faust verdeckt, also nur kleine Andeutung darüber
  c.beginPath();
  c.moveTo(cx - headR * 0.7, headCy - 6);
  c.lineTo(cx - headR * 0.45, headCy - 8);
  c.stroke();

  // Augenbrauen (traurig nach unten gewinkelt)
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(cx + headR * 0.2, headCy - 8);
  c.lineTo(cx + headR * 0.7, headCy - 4);
  c.stroke();
  c.beginPath();
  c.moveTo(cx - headR * 0.7, headCy - 14);
  c.lineTo(cx - headR * 0.2, headCy - 18);
  c.stroke();

  // Mund (offen, weinend)
  c.fillStyle = '#3a0a14';
  c.beginPath();
  c.ellipse(cx, headCy + headR * 0.45, headR * 0.22, headR * 0.18, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.stroke();
  // Mundwinkel runtergezogen — kleine Linien
  c.beginPath();
  c.moveTo(cx - headR * 0.22, headCy + headR * 0.45);
  c.lineTo(cx - headR * 0.32, headCy + headR * 0.55);
  c.moveTo(cx + headR * 0.22, headCy + headR * 0.45);
  c.lineTo(cx + headR * 0.32, headCy + headR * 0.55);
  c.stroke();

  // Tränen — fließen in Strömen aus rechtem Auge, einzelne Tropfen unter der Faust
  c.fillStyle = '#5fb8e6';
  c.strokeStyle = '#2b7fb8';
  c.lineWidth = 1;
  // Rechter Strom
  c.beginPath();
  c.moveTo(cx + headR * 0.4, headCy + 4);
  c.quadraticCurveTo(cx + headR * 0.55, headCy + headR * 0.5, cx + headR * 0.45, headCy + headR * 0.95);
  c.lineTo(cx + headR * 0.32, headCy + headR * 0.95);
  c.quadraticCurveTo(cx + headR * 0.4, headCy + headR * 0.5, cx + headR * 0.28, headCy + 4);
  c.closePath();
  c.fill();
  c.stroke();
  // Tropfen unten (animiert leicht)
  const drop = (Math.sin(t * 2) + 1) / 2;
  c.beginPath();
  c.ellipse(cx + headR * 0.4, headCy + headR * 1.05 + drop * 6, 4, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Linker Strom (kleiner, läuft an Faust vorbei)
  c.beginPath();
  c.moveTo(cx - headR * 0.5, headCy + 8);
  c.quadraticCurveTo(cx - headR * 0.6, headCy + headR * 0.6, cx - headR * 0.5, headCy + headR * 1.0);
  c.lineTo(cx - headR * 0.42, headCy + headR * 1.0);
  c.quadraticCurveTo(cx - headR * 0.52, headCy + headR * 0.6, cx - headR * 0.42, headCy + 8);
  c.closePath();
  c.fill();
  c.stroke();
  // Linker Tropfen
  c.beginPath();
  c.ellipse(cx - headR * 0.45, headCy + headR * 1.1 + (1 - drop) * 6, 3.5, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
}

// === Hilfsfunktion: kleine sportliche Auto-Karosserie ===
function drawSportsCar(c, cx, baseY, length, color, opts) {
  opts = opts || {};
  const accent = opts.accent || '#1a1a2e';
  const wheelColor = opts.wheelColor || '#1a1a2e';
  const rimColor = opts.rimColor || '#cccccc';
  const flat = opts.flat || false; // Lambo: kantiger
  const half = length / 2;
  const bodyH = length * 0.18;
  const cabinH = length * 0.16;
  const wheelR = length * 0.085;

  // Karosserie unten
  c.fillStyle = color;
  c.beginPath();
  if (flat) {
    // Eckiger / Lambo-Stil
    c.moveTo(cx - half, baseY - 4);
    c.lineTo(cx - half + 6, baseY - bodyH);
    c.lineTo(cx + half - 6, baseY - bodyH);
    c.lineTo(cx + half, baseY - 4);
    c.closePath();
  } else {
    // Geschwungen / Porsche-Stil
    c.moveTo(cx - half, baseY - 4);
    c.quadraticCurveTo(cx - half + 4, baseY - bodyH * 1.1, cx - half * 0.4, baseY - bodyH);
    c.lineTo(cx + half * 0.4, baseY - bodyH);
    c.quadraticCurveTo(cx + half - 4, baseY - bodyH * 1.1, cx + half, baseY - 4);
    c.closePath();
  }
  c.fill();
  c.strokeStyle = accent;
  c.lineWidth = 1.4;
  c.stroke();

  // Kabine / Dach
  c.fillStyle = color;
  c.beginPath();
  if (flat) {
    c.moveTo(cx - half * 0.55, baseY - bodyH);
    c.lineTo(cx - half * 0.25, baseY - bodyH - cabinH);
    c.lineTo(cx + half * 0.4, baseY - bodyH - cabinH);
    c.lineTo(cx + half * 0.6, baseY - bodyH);
    c.closePath();
  } else {
    c.moveTo(cx - half * 0.6, baseY - bodyH);
    c.quadraticCurveTo(cx - half * 0.3, baseY - bodyH - cabinH * 1.1, cx, baseY - bodyH - cabinH);
    c.quadraticCurveTo(cx + half * 0.3, baseY - bodyH - cabinH * 1.1, cx + half * 0.55, baseY - bodyH);
    c.closePath();
  }
  c.fill();
  c.stroke();

  // Fenster
  c.fillStyle = '#a8e0ff';
  c.beginPath();
  if (flat) {
    c.moveTo(cx - half * 0.5, baseY - bodyH - 2);
    c.lineTo(cx - half * 0.22, baseY - bodyH - cabinH + 4);
    c.lineTo(cx + half * 0.35, baseY - bodyH - cabinH + 4);
    c.lineTo(cx + half * 0.55, baseY - bodyH - 2);
    c.closePath();
  } else {
    c.moveTo(cx - half * 0.55, baseY - bodyH - 2);
    c.quadraticCurveTo(cx - half * 0.28, baseY - bodyH - cabinH * 0.95, cx, baseY - bodyH - cabinH + 4);
    c.quadraticCurveTo(cx + half * 0.28, baseY - bodyH - cabinH * 0.95, cx + half * 0.5, baseY - bodyH - 2);
    c.closePath();
  }
  c.fill();
  c.strokeStyle = accent;
  c.lineWidth = 1;
  c.stroke();

  // Räder
  c.fillStyle = wheelColor;
  c.beginPath();
  c.arc(cx - half * 0.65, baseY - 2, wheelR, 0, Math.PI * 2);
  c.arc(cx + half * 0.65, baseY - 2, wheelR, 0, Math.PI * 2);
  c.fill();
  // Felgen
  c.fillStyle = rimColor;
  c.beginPath();
  c.arc(cx - half * 0.65, baseY - 2, wheelR * 0.5, 0, Math.PI * 2);
  c.arc(cx + half * 0.65, baseY - 2, wheelR * 0.5, 0, Math.PI * 2);
  c.fill();

  // Scheinwerfer (vorn = rechts)
  c.fillStyle = '#fff8c0';
  c.beginPath();
  c.arc(cx + half - 4, baseY - bodyH * 0.55, length * 0.04, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = accent;
  c.lineWidth = 0.8;
  c.stroke();

  return { wheelR, bodyH };
}

// === Motiv: Kleines Mädchen mit pinken Klamotten vor pinkem Porsche ===
function drawMotifGirlPorsche(c, x, y, w, h, t) {
  // Hintergrund (rosa Abendhimmel)
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#ffd6ec');
  sky.addColorStop(1, '#ffa5d8');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  // Boden
  c.fillStyle = '#5a3045';
  c.fillRect(x, y + h - h * 0.12, w, h * 0.12);

  // Sonne
  c.fillStyle = '#ffeb99';
  c.beginPath();
  c.arc(x + w * 0.18, y + h * 0.22, w * 0.07, 0, Math.PI * 2);
  c.fill();

  // Porsche im Hintergrund (rechts)
  const carCx = x + w * 0.62;
  const carBaseY = y + h - h * 0.12;
  const carLen = w * 0.55;
  drawSportsCar(c, carCx, carBaseY, carLen, '#ff5fb0', {
    accent: '#5a1240',
    wheelColor: '#1a1a1a',
    rimColor: '#ffe0f0',
    flat: false
  });
  // Porsche-Logo (kleines goldenes Schild)
  c.fillStyle = '#ffd700';
  c.fillRect(carCx - 4, carBaseY - carLen * 0.18 - 8, 8, 6);

  // Mädchen vorne links
  const gx = x + w * 0.22;
  const gGround = carBaseY;
  const headR = w * 0.06;

  // Beine
  c.strokeStyle = '#f5cba7';
  c.lineWidth = Math.max(3, w * 0.022);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(gx - 4, gGround - h * 0.18);
  c.lineTo(gx - 4, gGround - 2);
  c.moveTo(gx + 4, gGround - h * 0.18);
  c.lineTo(gx + 4, gGround - 2);
  c.stroke();
  // Pinke Schuhe
  c.fillStyle = '#ff1f8e';
  c.fillRect(gx - 9, gGround - 4, 10, 4);
  c.fillRect(gx - 1, gGround - 4, 10, 4);

  // Pinkes Kleid
  c.fillStyle = '#ff5fb0';
  c.beginPath();
  c.moveTo(gx - 14, gGround - h * 0.18);
  c.lineTo(gx + 14, gGround - h * 0.18);
  c.lineTo(gx + 10, gGround - h * 0.32);
  c.lineTo(gx - 10, gGround - h * 0.32);
  c.closePath();
  c.fill();
  c.strokeStyle = '#5a1240';
  c.lineWidth = 1.2;
  c.stroke();
  // Glitzerpunkte am Kleid
  c.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.arc(gx - 8 + i * 5, gGround - h * 0.24, 1.2, 0, Math.PI * 2);
    c.fill();
  }

  // Arme
  c.strokeStyle = '#f5cba7';
  c.lineWidth = Math.max(3, w * 0.02);
  c.beginPath();
  c.moveTo(gx - 12, gGround - h * 0.3);
  c.lineTo(gx - 16, gGround - h * 0.2);
  c.moveTo(gx + 12, gGround - h * 0.3);
  c.lineTo(gx + 16, gGround - h * 0.2);
  c.stroke();

  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(gx, gGround - h * 0.32 - headR, headR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.stroke();
  // Pinke Haare
  c.fillStyle = '#ff85c8';
  c.beginPath();
  c.arc(gx, gGround - h * 0.32 - headR, headR + 1, Math.PI + 0.2, 2 * Math.PI - 0.2);
  c.fill();
  // Zwei Zöpfe
  c.beginPath();
  c.ellipse(gx - headR - 1, gGround - h * 0.32 - headR + 4, 4, 8, 0, 0, Math.PI * 2);
  c.ellipse(gx + headR + 1, gGround - h * 0.32 - headR + 4, 4, 8, 0, 0, Math.PI * 2);
  c.fill();
  // Pinke Schleife oben
  c.fillStyle = '#ff1f8e';
  c.beginPath();
  c.moveTo(gx - 4, gGround - h * 0.32 - headR * 2 + 2);
  c.lineTo(gx - 8, gGround - h * 0.32 - headR * 2 - 2);
  c.lineTo(gx - 8, gGround - h * 0.32 - headR * 2 + 4);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(gx + 4, gGround - h * 0.32 - headR * 2 + 2);
  c.lineTo(gx + 8, gGround - h * 0.32 - headR * 2 - 2);
  c.lineTo(gx + 8, gGround - h * 0.32 - headR * 2 + 4);
  c.closePath();
  c.fill();
  c.fillStyle = '#ff1f8e';
  c.beginPath();
  c.arc(gx, gGround - h * 0.32 - headR * 2 + 1, 2, 0, Math.PI * 2);
  c.fill();

  // Augen + Lächeln
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(gx - headR * 0.35, gGround - h * 0.32 - headR + 1, 1.6, 0, Math.PI * 2);
  c.arc(gx + headR * 0.35, gGround - h * 0.32 - headR + 1, 1.6, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(gx, gGround - h * 0.32 - headR + 4, 3, 0.2, Math.PI - 0.2);
  c.stroke();
}

// === Motiv: Junge mit lockigen Haaren vor rotem Lamborghini ===
function drawMotifBoyLambo(c, x, y, w, h, t) {
  // Hintergrund (Sonnenuntergang)
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#1d2e5a');
  sky.addColorStop(0.5, '#ff7a3a');
  sky.addColorStop(1, '#ffd166');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  // Bodenstreifen (Beton)
  c.fillStyle = '#2a2a30';
  c.fillRect(x, y + h - h * 0.12, w, h * 0.12);
  // Mittellinie
  c.fillStyle = '#ffd700';
  for (let i = 0; i < 4; i++) {
    c.fillRect(x + 4 + i * (w / 4), y + h - h * 0.06, w * 0.08, 2);
  }

  // Lambo (rechts, kantig)
  const carCx = x + w * 0.6;
  const carBaseY = y + h - h * 0.12;
  const carLen = w * 0.6;
  drawSportsCar(c, carCx, carBaseY, carLen, '#e30613', {
    accent: '#3a0008',
    wheelColor: '#0a0a0a',
    rimColor: '#ffd700',
    flat: true
  });
  // Lufteinlass
  c.fillStyle = '#1a0006';
  c.fillRect(carCx + carLen * 0.15, carBaseY - carLen * 0.1, carLen * 0.18, 4);

  // Junge vorne links
  const bx = x + w * 0.2;
  const bGround = carBaseY;
  const headR = w * 0.065;

  // Beine (Jeans)
  c.fillStyle = '#1a3a7a';
  c.fillRect(bx - 8, bGround - h * 0.2, 7, h * 0.2);
  c.fillRect(bx + 1, bGround - h * 0.2, 7, h * 0.2);
  // Sneaker
  c.fillStyle = '#fff';
  c.fillRect(bx - 10, bGround - 4, 11, 4);
  c.fillRect(bx - 1, bGround - 4, 11, 4);

  // T-Shirt
  c.fillStyle = '#ff1f1f';
  c.beginPath();
  c.moveTo(bx - 14, bGround - h * 0.2);
  c.lineTo(bx + 14, bGround - h * 0.2);
  c.lineTo(bx + 16, bGround - h * 0.36);
  c.lineTo(bx - 16, bGround - h * 0.36);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.stroke();

  // Arme (cool an Hüfte)
  c.strokeStyle = '#f5cba7';
  c.lineWidth = Math.max(3, w * 0.022);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(bx - 14, bGround - h * 0.34);
  c.lineTo(bx - 20, bGround - h * 0.24);
  c.lineTo(bx - 14, bGround - h * 0.18);
  c.moveTo(bx + 14, bGround - h * 0.34);
  c.lineTo(bx + 20, bGround - h * 0.24);
  c.lineTo(bx + 14, bGround - h * 0.18);
  c.stroke();

  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(bx, bGround - h * 0.36 - headR, headR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.4;
  c.stroke();

  // Locken — viele kleine Kreise oben auf dem Kopf
  c.fillStyle = '#3a1f10';
  const locks = 11;
  for (let i = 0; i < locks; i++) {
    const ang = Math.PI + 0.2 + (Math.PI - 0.4) * (i / (locks - 1));
    const lx = bx + Math.cos(ang) * (headR + 1);
    const ly = bGround - h * 0.36 - headR + Math.sin(ang) * (headR + 1);
    c.beginPath();
    c.arc(lx, ly, 4, 0, Math.PI * 2);
    c.fill();
  }
  // Ein paar Locken vorn
  c.beginPath();
  c.arc(bx - headR * 0.5, bGround - h * 0.36 - headR - 2, 4, 0, Math.PI * 2);
  c.arc(bx + headR * 0.2, bGround - h * 0.36 - headR - 4, 4, 0, Math.PI * 2);
  c.arc(bx + headR * 0.6, bGround - h * 0.36 - headR - 2, 4, 0, Math.PI * 2);
  c.fill();

  // Sonnenbrille
  c.fillStyle = '#1a1a2e';
  c.fillRect(bx - headR * 0.85, bGround - h * 0.36 - headR + 1, headR * 0.7, 4);
  c.fillRect(bx + headR * 0.15, bGround - h * 0.36 - headR + 1, headR * 0.7, 4);
  c.beginPath();
  c.moveTo(bx - headR * 0.15, bGround - h * 0.36 - headR + 3);
  c.lineTo(bx + headR * 0.15, bGround - h * 0.36 - headR + 3);
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.stroke();

  // Cooler Mund (kleiner Strich)
  c.beginPath();
  c.moveTo(bx - 3, bGround - h * 0.36 - headR + 7);
  c.lineTo(bx + 3, bGround - h * 0.36 - headR + 7);
  c.stroke();
}

// === Motiv: Katze im Katzenbett auf dem Balkon ===
function drawMotifCatBalcony(c, x, y, w, h, t) {
  // Himmel
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#a8d8ea');
  sky.addColorStop(1, '#fef3c7');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  // Wolke
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(x + w * 0.78, y + h * 0.18, w * 0.05, 0, Math.PI * 2);
  c.arc(x + w * 0.84, y + h * 0.16, w * 0.06, 0, Math.PI * 2);
  c.arc(x + w * 0.9, y + h * 0.19, w * 0.045, 0, Math.PI * 2);
  c.fill();

  // Pflanze auf einer Seite
  const potX = x + w * 0.85;
  const potY = y + h * 0.62;
  c.fillStyle = '#a0522d';
  c.fillRect(potX - 8, potY, 16, 14);
  // Blätter
  c.fillStyle = '#3a8b3a';
  c.beginPath();
  c.arc(potX - 4, potY - 4, 6, 0, Math.PI * 2);
  c.arc(potX + 4, potY - 6, 6, 0, Math.PI * 2);
  c.arc(potX, potY - 10, 6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ff5fb0';
  c.beginPath();
  c.arc(potX - 2, potY - 12, 2.5, 0, Math.PI * 2);
  c.arc(potX + 4, potY - 8, 2.5, 0, Math.PI * 2);
  c.fill();

  // Balkonboden
  c.fillStyle = '#8b6f47';
  c.fillRect(x, y + h * 0.78, w, h * 0.22);
  // Holzdielen
  c.strokeStyle = '#5a4530';
  c.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    c.beginPath();
    c.moveTo(x, y + h * 0.78 + i * (h * 0.22 / 5));
    c.lineTo(x + w, y + h * 0.78 + i * (h * 0.22 / 5));
    c.stroke();
  }

  // Geländer
  c.strokeStyle = '#222';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, y + h * 0.5);
  c.lineTo(x + w, y + h * 0.5);
  c.moveTo(x, y + h * 0.78);
  c.lineTo(x + w, y + h * 0.78);
  c.stroke();
  // Vertikale Stäbe
  c.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const bx2 = x + (w * (i + 0.5)) / 8;
    c.beginPath();
    c.moveTo(bx2, y + h * 0.5);
    c.lineTo(bx2, y + h * 0.78);
    c.stroke();
  }

  // Katzenbett (oval, weich)
  const bedCx = x + w * 0.42;
  const bedCy = y + h * 0.86;
  const bedW = w * 0.42;
  const bedH = h * 0.16;
  c.fillStyle = '#9b6dff';
  c.beginPath();
  c.ellipse(bedCx, bedCy, bedW / 2, bedH / 2, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#5a3aaa';
  c.lineWidth = 1.4;
  c.stroke();
  // Kissen
  c.fillStyle = '#d6c0ff';
  c.beginPath();
  c.ellipse(bedCx, bedCy - 2, bedW * 0.42, bedH * 0.32, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Schlafende Katze (zusammengerollt)
  c.fillStyle = '#f5a623';
  c.beginPath();
  c.ellipse(bedCx, bedCy - 4, bedW * 0.38, bedH * 0.4, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#6b4112';
  c.lineWidth = 1.2;
  c.stroke();
  // Streifen
  c.lineWidth = 1.2;
  c.strokeStyle = '#6b4112';
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(bedCx - bedW * 0.15 + i * 8, bedCy - 8);
    c.lineTo(bedCx - bedW * 0.18 + i * 8, bedCy - 2);
    c.stroke();
  }
  // Kopf der Katze (links, eingerollt)
  const headCx = bedCx - bedW * 0.25;
  const headCy = bedCy - 2;
  const headR = bedH * 0.32;
  c.fillStyle = '#f5a623';
  c.beginPath();
  c.arc(headCx, headCy, headR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#6b4112';
  c.lineWidth = 1.2;
  c.stroke();
  // Ohren
  c.fillStyle = '#f5a623';
  c.beginPath();
  c.moveTo(headCx - headR * 0.7, headCy - headR * 0.5);
  c.lineTo(headCx - headR * 0.4, headCy - headR * 1.2);
  c.lineTo(headCx - headR * 0.1, headCy - headR * 0.6);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(headCx + headR * 0.1, headCy - headR * 0.6);
  c.lineTo(headCx + headR * 0.4, headCy - headR * 1.2);
  c.lineTo(headCx + headR * 0.7, headCy - headR * 0.5);
  c.closePath();
  c.fill();
  c.stroke();
  // Innenohren
  c.fillStyle = '#ffc1e3';
  c.beginPath();
  c.moveTo(headCx - headR * 0.5, headCy - headR * 0.7);
  c.lineTo(headCx - headR * 0.4, headCy - headR * 1.0);
  c.lineTo(headCx - headR * 0.25, headCy - headR * 0.7);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(headCx + headR * 0.25, headCy - headR * 0.7);
  c.lineTo(headCx + headR * 0.4, headCy - headR * 1.0);
  c.lineTo(headCx + headR * 0.5, headCy - headR * 0.7);
  c.closePath();
  c.fill();
  // Geschlossene Augen (Schlaf)
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(headCx - headR * 0.35, headCy - 1, 2, Math.PI * 0.1, Math.PI * 0.9);
  c.stroke();
  c.beginPath();
  c.arc(headCx + headR * 0.35, headCy - 1, 2, Math.PI * 0.1, Math.PI * 0.9);
  c.stroke();
  // Nase (Dreieck)
  c.fillStyle = '#ff8ad1';
  c.beginPath();
  c.moveTo(headCx, headCy + 2);
  c.lineTo(headCx - 2, headCy);
  c.lineTo(headCx + 2, headCy);
  c.closePath();
  c.fill();
  // ZZZ über Kopf (animiert)
  const zAlpha = 0.5 + 0.5 * Math.sin(t * 2);
  c.globalAlpha = zAlpha;
  c.fillStyle = '#1a1a2e';
  c.font = `bold ${Math.floor(w * 0.05)}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('z', headCx + headR + 6, headCy - headR - 4);
  c.fillText('Z', headCx + headR + 14, headCy - headR - 12);
  c.globalAlpha = 1;
}

// === Motiv: Flugzeug aus Diamanten ===
function drawMotifDiamondPlane(c, x, y, w, h, t) {
  // Himmel
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#67e8f9');
  sky.addColorStop(1, '#a5f3fc');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  // Wölkchen
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(x + w * 0.15, y + h * 0.7, w * 0.06, 0, Math.PI * 2);
  c.arc(x + w * 0.22, y + h * 0.68, w * 0.07, 0, Math.PI * 2);
  c.arc(x + w * 0.84, y + h * 0.78, w * 0.05, 0, Math.PI * 2);
  c.arc(x + w * 0.9, y + h * 0.76, w * 0.06, 0, Math.PI * 2);
  c.fill();

  // Sonne
  c.fillStyle = '#fff8c0';
  c.beginPath();
  c.arc(x + w * 0.85, y + h * 0.22, w * 0.06, 0, Math.PI * 2);
  c.fill();

  // Flugzeug — leicht rauf/runter wackelnd
  const planeCx = x + w / 2;
  const planeCy = y + h * 0.5 + Math.sin(t * 2) * 3;
  const planeLen = w * 0.78;

  // Rumpf — Diamantfacetten als Polygonkette
  const bodyTop = planeCy - h * 0.07;
  const bodyBot = planeCy + h * 0.07;
  c.save();
  c.translate(planeCx, planeCy);

  // Tragflächen (Diamanten)
  // Obere Fläche
  c.beginPath();
  c.moveTo(-planeLen * 0.12, -h * 0.05);
  c.lineTo(0, -h * 0.28);
  c.lineTo(planeLen * 0.05, -h * 0.28);
  c.lineTo(planeLen * 0.12, -h * 0.05);
  c.closePath();
  drawDiamondFill(c, '#bce8ff', '#5fb8e6');
  // Untere Fläche
  c.beginPath();
  c.moveTo(-planeLen * 0.18, h * 0.05);
  c.lineTo(-planeLen * 0.1, h * 0.22);
  c.lineTo(planeLen * 0.18, h * 0.22);
  c.lineTo(planeLen * 0.22, h * 0.05);
  c.closePath();
  drawDiamondFill(c, '#bce8ff', '#5fb8e6');

  // Heckflosse
  c.beginPath();
  c.moveTo(-planeLen * 0.42, -h * 0.04);
  c.lineTo(-planeLen * 0.5, -h * 0.18);
  c.lineTo(-planeLen * 0.36, -h * 0.04);
  c.closePath();
  drawDiamondFill(c, '#d6f0ff', '#5fb8e6');

  // Rumpf (langer Diamant)
  c.beginPath();
  c.moveTo(-planeLen * 0.48, 0);
  c.lineTo(-planeLen * 0.42, -h * 0.06);
  c.lineTo(planeLen * 0.36, -h * 0.06);
  c.lineTo(planeLen * 0.48, 0);
  c.lineTo(planeLen * 0.36, h * 0.06);
  c.lineTo(-planeLen * 0.42, h * 0.06);
  c.closePath();
  drawDiamondFill(c, '#e6f7ff', '#5fb8e6');

  // Facetten-Linien innen
  c.strokeStyle = '#5fb8e6';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-planeLen * 0.42, -h * 0.06);
  c.lineTo(-planeLen * 0.42, h * 0.06);
  c.moveTo(-planeLen * 0.2, -h * 0.06);
  c.lineTo(-planeLen * 0.2, h * 0.06);
  c.moveTo(0, -h * 0.06);
  c.lineTo(0, h * 0.06);
  c.moveTo(planeLen * 0.18, -h * 0.06);
  c.lineTo(planeLen * 0.18, h * 0.06);
  c.moveTo(planeLen * 0.36, -h * 0.06);
  c.lineTo(planeLen * 0.36, h * 0.06);
  c.stroke();

  // Cockpit-Fenster (kleine dunkle Diamanten)
  c.fillStyle = '#1d2e5a';
  c.beginPath();
  c.moveTo(planeLen * 0.22, -h * 0.02);
  c.lineTo(planeLen * 0.27, -h * 0.04);
  c.lineTo(planeLen * 0.32, -h * 0.02);
  c.lineTo(planeLen * 0.27, 0);
  c.closePath();
  c.fill();

  // Funkeln-Sterne überall
  drawSparkle(c, -planeLen * 0.2, -h * 0.02, 3);
  drawSparkle(c, 0, h * 0.02, 3);
  drawSparkle(c, planeLen * 0.1, -h * 0.03, 3);
  drawSparkle(c, -planeLen * 0.05, -h * 0.2, 4);
  drawSparkle(c, planeLen * 0.04, h * 0.18, 4);

  c.restore();

  // Glitzersterne im Hintergrund
  drawSparkle(c, x + w * 0.1, y + h * 0.3, 3);
  drawSparkle(c, x + w * 0.92, y + h * 0.45, 3);
  drawSparkle(c, x + w * 0.5, y + h * 0.12, 4);
}

function drawDiamondFill(c, fill, stroke) {
  c.save();
  // Verlauf
  const grad = c.createLinearGradient(-50, -30, 50, 30);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.5, fill);
  grad.addColorStop(1, '#9bd6f7');
  c.fillStyle = grad;
  c.fill();
  c.strokeStyle = stroke;
  c.lineWidth = 1.4;
  c.stroke();
  c.restore();
}

function drawSparkle(c, sx, sy, size) {
  c.save();
  c.translate(sx, sy);
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(0, -size);
  c.lineTo(size * 0.3, -size * 0.3);
  c.lineTo(size, 0);
  c.lineTo(size * 0.3, size * 0.3);
  c.lineTo(0, size);
  c.lineTo(-size * 0.3, size * 0.3);
  c.lineTo(-size, 0);
  c.lineTo(-size * 0.3, -size * 0.3);
  c.closePath();
  c.fill();
  c.restore();
}

// === Motiv: Affe der einen goldenen Bugatti fährt ===
function drawMotifMonkeyBugatti(c, x, y, w, h, t) {
  // Hintergrund (Wüste / Straße in der Ferne)
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#5fa9e0');
  sky.addColorStop(1, '#fcd34d');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  // Berge in der Ferne
  c.fillStyle = '#a06a40';
  c.beginPath();
  c.moveTo(x, y + h * 0.62);
  c.lineTo(x + w * 0.2, y + h * 0.48);
  c.lineTo(x + w * 0.35, y + h * 0.58);
  c.lineTo(x + w * 0.55, y + h * 0.42);
  c.lineTo(x + w * 0.75, y + h * 0.55);
  c.lineTo(x + w, y + h * 0.5);
  c.lineTo(x + w, y + h * 0.7);
  c.lineTo(x, y + h * 0.7);
  c.closePath();
  c.fill();

  // Straße
  c.fillStyle = '#2a2a30';
  c.fillRect(x, y + h - h * 0.18, w, h * 0.18);
  // Mittellinie
  c.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) {
    c.fillRect(x + 2 + i * (w / 5), y + h - h * 0.09, w * 0.07, 2);
  }

  // Bugatti — leicht länger und niedriger als Standard, golden
  const carCx = x + w / 2;
  const carBaseY = y + h - h * 0.18;
  const carLen = w * 0.78;
  const goldGrad = c.createLinearGradient(carCx, carBaseY - carLen * 0.18, carCx, carBaseY);
  goldGrad.addColorStop(0, '#fff3a0');
  goldGrad.addColorStop(0.5, '#ffd700');
  goldGrad.addColorStop(1, '#b8860b');

  // Karosserie
  const half = carLen / 2;
  const bodyH = carLen * 0.16;
  const cabinH = carLen * 0.14;
  c.fillStyle = goldGrad;
  c.beginPath();
  c.moveTo(carCx - half, carBaseY - 6);
  c.quadraticCurveTo(carCx - half + 4, carBaseY - bodyH, carCx - half * 0.55, carBaseY - bodyH);
  c.lineTo(carCx + half * 0.55, carBaseY - bodyH);
  c.quadraticCurveTo(carCx + half - 4, carBaseY - bodyH, carCx + half, carBaseY - 6);
  c.closePath();
  c.fill();
  c.strokeStyle = '#7a5c00';
  c.lineWidth = 1.4;
  c.stroke();

  // Kabine (mit Cabriolet-Öffnung)
  c.beginPath();
  c.moveTo(carCx - half * 0.55, carBaseY - bodyH);
  c.quadraticCurveTo(carCx - half * 0.3, carBaseY - bodyH - cabinH, carCx, carBaseY - bodyH - cabinH);
  c.quadraticCurveTo(carCx + half * 0.3, carBaseY - bodyH - cabinH, carCx + half * 0.5, carBaseY - bodyH);
  c.closePath();
  c.fillStyle = goldGrad;
  c.fill();
  c.stroke();

  // Frontscheibe
  c.fillStyle = '#a8e0ff';
  c.beginPath();
  c.moveTo(carCx + half * 0.05, carBaseY - bodyH - cabinH * 0.95);
  c.lineTo(carCx + half * 0.45, carBaseY - bodyH - 2);
  c.lineTo(carCx + half * 0.08, carBaseY - bodyH - 2);
  c.closePath();
  c.fill();
  c.strokeStyle = '#7a5c00';
  c.lineWidth = 1;
  c.stroke();

  // Räder mit goldenen Felgen
  c.fillStyle = '#0a0a0a';
  const wheelR = carLen * 0.085;
  c.beginPath();
  c.arc(carCx - half * 0.65, carBaseY - 4, wheelR, 0, Math.PI * 2);
  c.arc(carCx + half * 0.65, carBaseY - 4, wheelR, 0, Math.PI * 2);
  c.fill();
  // Felgen mit Speichen
  c.fillStyle = '#ffd700';
  c.beginPath();
  c.arc(carCx - half * 0.65, carBaseY - 4, wheelR * 0.55, 0, Math.PI * 2);
  c.arc(carCx + half * 0.65, carBaseY - 4, wheelR * 0.55, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#7a5c00';
  c.lineWidth = 1;
  for (const wx of [carCx - half * 0.65, carCx + half * 0.65]) {
    for (let i = 0; i < 5; i++) {
      const ang = (i * Math.PI * 2) / 5;
      c.beginPath();
      c.moveTo(wx, carBaseY - 4);
      c.lineTo(wx + Math.cos(ang) * wheelR * 0.5, carBaseY - 4 + Math.sin(ang) * wheelR * 0.5);
      c.stroke();
    }
  }

  // Scheinwerfer
  c.fillStyle = '#fff8c0';
  c.beginPath();
  c.arc(carCx + half - 4, carBaseY - bodyH * 0.55, carLen * 0.04, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#7a5c00';
  c.lineWidth = 0.8;
  c.stroke();

  // Bugatti-Logo (rotes Oval)
  c.fillStyle = '#a01428';
  c.beginPath();
  c.ellipse(carCx, carBaseY - bodyH * 0.5, 7, 4, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#7a5c00';
  c.lineWidth = 0.8;
  c.stroke();

  // Affe — Kopf schaut über Cockpit-Rand
  const monkeyCx = carCx - half * 0.05;
  const monkeyCy = carBaseY - bodyH - cabinH + 4;
  const mHeadR = carLen * 0.085;

  // Hände am Lenkrad (oben sichtbar)
  c.fillStyle = '#5a3a25';
  c.beginPath();
  c.arc(monkeyCx - mHeadR * 0.8, monkeyCy + mHeadR * 0.6, 4, 0, Math.PI * 2);
  c.arc(monkeyCx + mHeadR * 0.8, monkeyCy + mHeadR * 0.6, 4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1;
  c.stroke();

  // Kopf
  c.fillStyle = '#7a4a2a';
  c.beginPath();
  c.arc(monkeyCx, monkeyCy, mHeadR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.4;
  c.stroke();
  // Helle Schnauze
  c.fillStyle = '#f0c898';
  c.beginPath();
  c.ellipse(monkeyCx, monkeyCy + mHeadR * 0.3, mHeadR * 0.65, mHeadR * 0.45, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Ohren (große runde Affenohren)
  c.fillStyle = '#7a4a2a';
  c.beginPath();
  c.arc(monkeyCx - mHeadR, monkeyCy, mHeadR * 0.5, 0, Math.PI * 2);
  c.arc(monkeyCx + mHeadR, monkeyCy, mHeadR * 0.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = '#f0c898';
  c.beginPath();
  c.arc(monkeyCx - mHeadR, monkeyCy, mHeadR * 0.3, 0, Math.PI * 2);
  c.arc(monkeyCx + mHeadR, monkeyCy, mHeadR * 0.3, 0, Math.PI * 2);
  c.fill();

  // Augen (groß und hell)
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(monkeyCx - mHeadR * 0.3, monkeyCy - mHeadR * 0.15, 4, 0, Math.PI * 2);
  c.arc(monkeyCx + mHeadR * 0.3, monkeyCy - mHeadR * 0.15, 4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(monkeyCx - mHeadR * 0.3, monkeyCy - mHeadR * 0.15, 2, 0, Math.PI * 2);
  c.arc(monkeyCx + mHeadR * 0.3, monkeyCy - mHeadR * 0.15, 2, 0, Math.PI * 2);
  c.fill();

  // Frecher Mund
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(monkeyCx, monkeyCy + mHeadR * 0.32, mHeadR * 0.35, 0.1, Math.PI - 0.1);
  c.stroke();
  // Zähne
  c.fillStyle = '#fff';
  c.fillRect(monkeyCx - 4, monkeyCy + mHeadR * 0.4, 8, 3);

  // Kleine Sonnenbrille — optional, macht's „cool"
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(monkeyCx - mHeadR * 0.3, monkeyCy - mHeadR * 0.15, 4.5, 0, Math.PI * 2);
  c.arc(monkeyCx + mHeadR * 0.3, monkeyCy - mHeadR * 0.15, 4.5, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = 'rgba(26,26,46,0.7)';
  c.beginPath();
  c.arc(monkeyCx - mHeadR * 0.3, monkeyCy - mHeadR * 0.15, 4.5, 0, Math.PI * 2);
  c.arc(monkeyCx + mHeadR * 0.3, monkeyCy - mHeadR * 0.15, 4.5, 0, Math.PI * 2);
  c.fill();
  // Brücke
  c.strokeStyle = '#1a1a2e';
  c.beginPath();
  c.moveTo(monkeyCx - mHeadR * 0.05, monkeyCy - mHeadR * 0.15);
  c.lineTo(monkeyCx + mHeadR * 0.05, monkeyCy - mHeadR * 0.15);
  c.stroke();

  // Geschwindigkeitslinien hinter dem Auto
  c.strokeStyle = '#fff';
  c.lineWidth = 2;
  c.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const ly = carBaseY - bodyH * 0.4 - i * 6;
    c.beginPath();
    c.moveTo(carCx - half - 4 - i * 3, ly);
    c.lineTo(carCx - half - 18 - i * 3, ly);
    c.stroke();
  }
}

// === Motiv: Künstler malt eine Katze auf eine Leinwand ===
function drawMotifArtistCat(c, x, y, w, h, t) {
  // Hintergrund (Atelier)
  c.fillStyle = '#fef3c7';
  c.fillRect(x, y, w, h);
  // Boden
  c.fillStyle = '#8b6f47';
  c.fillRect(x, y + h * 0.82, w, h * 0.18);

  // Staffelei (links groß)
  const easelCx = x + w * 0.42;
  const easelTop = y + h * 0.1;
  const easelBot = y + h * 0.82;
  c.strokeStyle = '#5a3a1a';
  c.lineWidth = 4;
  c.lineCap = 'round';
  // Beine
  c.beginPath();
  c.moveTo(easelCx - w * 0.2, easelBot);
  c.lineTo(easelCx - w * 0.05, easelTop);
  c.moveTo(easelCx + w * 0.2, easelBot);
  c.lineTo(easelCx + w * 0.05, easelTop);
  // Mittelbein
  c.moveTo(easelCx, easelBot + 4);
  c.lineTo(easelCx, easelTop + 8);
  c.stroke();

  // Leinwand
  const canvasX = easelCx - w * 0.22;
  const canvasY = easelTop + 8;
  const canvasW = w * 0.44;
  const canvasH = h * 0.5;
  c.fillStyle = '#fff';
  c.fillRect(canvasX, canvasY, canvasW, canvasH);
  c.strokeStyle = '#5a3a1a';
  c.lineWidth = 2;
  c.strokeRect(canvasX, canvasY, canvasW, canvasH);

  // Gemalte Katze auf Leinwand (Mitte)
  const catCx = canvasX + canvasW / 2;
  const catCy = canvasY + canvasH * 0.55;
  const catR = canvasH * 0.22;
  // Körper (sitzend)
  c.fillStyle = '#f5a623';
  c.beginPath();
  c.ellipse(catCx, catCy + catR * 0.7, catR * 1.1, catR * 0.9, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#6b4112';
  c.lineWidth = 1.4;
  c.stroke();
  // Kopf
  c.fillStyle = '#f5a623';
  c.beginPath();
  c.arc(catCx, catCy - catR * 0.2, catR * 0.7, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Ohren
  c.fillStyle = '#f5a623';
  c.beginPath();
  c.moveTo(catCx - catR * 0.55, catCy - catR * 0.55);
  c.lineTo(catCx - catR * 0.35, catCy - catR * 1.05);
  c.lineTo(catCx - catR * 0.1, catCy - catR * 0.6);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(catCx + catR * 0.55, catCy - catR * 0.55);
  c.lineTo(catCx + catR * 0.35, catCy - catR * 1.05);
  c.lineTo(catCx + catR * 0.1, catCy - catR * 0.6);
  c.closePath();
  c.fill();
  c.stroke();
  // Augen
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(catCx - catR * 0.25, catCy - catR * 0.25, 1.6, 0, Math.PI * 2);
  c.arc(catCx + catR * 0.25, catCy - catR * 0.25, 1.6, 0, Math.PI * 2);
  c.fill();
  // Nase + Mund
  c.fillStyle = '#ff8ad1';
  c.beginPath();
  c.moveTo(catCx, catCy - catR * 0.05);
  c.lineTo(catCx - 1.5, catCy - catR * 0.13);
  c.lineTo(catCx + 1.5, catCy - catR * 0.13);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(catCx, catCy - catR * 0.05);
  c.lineTo(catCx, catCy + catR * 0.0);
  c.stroke();
  // Schwanz (geschwungen)
  c.fillStyle = '#f5a623';
  c.strokeStyle = '#6b4112';
  c.lineWidth = 4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(catCx + catR * 0.95, catCy + catR * 1.0);
  c.quadraticCurveTo(catCx + catR * 1.6, catCy + catR * 0.3, catCx + catR * 1.3, catCy - catR * 0.4);
  c.stroke();

  // "Signatur" unten rechts
  c.strokeStyle = '#5a1240';
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(canvasX + canvasW - 18, canvasY + canvasH - 8);
  c.quadraticCurveTo(canvasX + canvasW - 14, canvasY + canvasH - 12, canvasX + canvasW - 6, canvasY + canvasH - 8);
  c.stroke();

  // Künstler (rechts, Strichmännchen mit Pinsel)
  const aBaseY = y + h * 0.82;
  const aCx = x + w * 0.85;
  const aHeadR = w * 0.045;
  // Beine
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(aCx - 5, aBaseY - h * 0.18);
  c.lineTo(aCx - 5, aBaseY - 2);
  c.moveTo(aCx + 5, aBaseY - h * 0.18);
  c.lineTo(aCx + 5, aBaseY - 2);
  c.stroke();
  // Körper (Künstler-Kittel mit Farbflecken)
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(aCx - 12, aBaseY - h * 0.18);
  c.lineTo(aCx + 12, aBaseY - h * 0.18);
  c.lineTo(aCx + 14, aBaseY - h * 0.36);
  c.lineTo(aCx - 14, aBaseY - h * 0.36);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.4;
  c.stroke();
  // Farbkleckse
  c.fillStyle = '#e63946';
  c.beginPath();
  c.arc(aCx - 6, aBaseY - h * 0.28, 2.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#3a86ff';
  c.beginPath();
  c.arc(aCx + 6, aBaseY - h * 0.24, 2, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#a3e635';
  c.beginPath();
  c.arc(aCx + 2, aBaseY - h * 0.32, 2, 0, Math.PI * 2);
  c.fill();

  // Linker Arm (hält Palette)
  c.strokeStyle = '#f5cba7';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(aCx - 12, aBaseY - h * 0.34);
  c.lineTo(aCx - 22, aBaseY - h * 0.26);
  c.stroke();
  // Palette
  c.fillStyle = '#c98a4a';
  c.beginPath();
  c.ellipse(aCx - 28, aBaseY - h * 0.22, 8, 5, 0.2, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#5a3a1a';
  c.lineWidth = 1;
  c.stroke();
  // Farbkleckse auf Palette
  c.fillStyle = '#e63946';
  c.beginPath(); c.arc(aCx - 30, aBaseY - h * 0.23, 1.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3a86ff';
  c.beginPath(); c.arc(aCx - 27, aBaseY - h * 0.21, 1.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fcd34d';
  c.beginPath(); c.arc(aCx - 24, aBaseY - h * 0.23, 1.5, 0, Math.PI * 2); c.fill();

  // Rechter Arm — hält Pinsel, malt
  c.strokeStyle = '#f5cba7';
  c.lineWidth = 4;
  const brushAngle = Math.sin(t * 4) * 0.2;
  c.beginPath();
  c.moveTo(aCx + 12, aBaseY - h * 0.34);
  const armEndX = aCx - 6 + Math.sin(brushAngle) * 4;
  const armEndY = aBaseY - h * 0.45;
  c.lineTo(armEndX, armEndY);
  c.stroke();
  // Pinsel
  c.strokeStyle = '#5a3a1a';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(armEndX, armEndY);
  c.lineTo(armEndX - 14, armEndY - 4);
  c.stroke();
  // Pinselborste
  c.fillStyle = '#e63946';
  c.beginPath();
  c.ellipse(armEndX - 18, armEndY - 5, 4, 2.5, -0.2, 0, Math.PI * 2);
  c.fill();

  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(aCx, aBaseY - h * 0.36 - aHeadR, aHeadR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.stroke();
  // Künstler-Barett (schräg)
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.ellipse(aCx + 2, aBaseY - h * 0.36 - aHeadR * 1.4, aHeadR * 1.2, aHeadR * 0.4, -0.2, 0, Math.PI * 2);
  c.fill();
  // Augen + konzentrierter Mund
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(aCx - aHeadR * 0.35, aBaseY - h * 0.36 - aHeadR + 1, 1.4, 0, Math.PI * 2);
  c.arc(aCx + aHeadR * 0.35, aBaseY - h * 0.36 - aHeadR + 1, 1.4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(aCx - 2, aBaseY - h * 0.36 - aHeadR + 5);
  c.lineTo(aCx + 2, aBaseY - h * 0.36 - aHeadR + 5);
  c.stroke();
}

// === Motiv: Sonnenblume mit Sonnenbrille ===
function drawMotifSunflower(c, x, y, w, h, t) {
  // Himmel
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#67e8f9');
  sky.addColorStop(1, '#a8d8ea');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);
  // Wiese
  c.fillStyle = '#4a8c3a';
  c.fillRect(x, y + h * 0.78, w, h * 0.22);
  // Grashalme
  c.strokeStyle = '#3a6a2a';
  c.lineWidth = 1.4;
  for (let i = 0; i < 8; i++) {
    const gx = x + (w * (i + 0.5)) / 8;
    c.beginPath();
    c.moveTo(gx, y + h * 0.78);
    c.lineTo(gx + 2, y + h * 0.74);
    c.stroke();
  }

  // Stiel
  const cx = x + w / 2;
  c.strokeStyle = '#3a6a2a';
  c.lineWidth = Math.max(4, w * 0.04);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx, y + h * 0.82);
  // Leichte Wippbewegung
  c.quadraticCurveTo(cx + Math.sin(t * 1.5) * 5, y + h * 0.55, cx, y + h * 0.4);
  c.stroke();

  // Blätter am Stiel
  c.fillStyle = '#4a8c3a';
  c.beginPath();
  c.ellipse(cx - 12, y + h * 0.62, 14, 6, -0.4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#3a6a2a';
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = '#4a8c3a';
  c.beginPath();
  c.ellipse(cx + 12, y + h * 0.7, 12, 5, 0.4, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Blütenkopf — Blütenblätter
  const flowerCx = cx;
  const flowerCy = y + h * 0.36;
  const flowerR = Math.min(w, h) * 0.25;
  c.fillStyle = '#fcd34d';
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const px = flowerCx + Math.cos(ang) * flowerR;
    const py = flowerCy + Math.sin(ang) * flowerR;
    c.save();
    c.translate(px, py);
    c.rotate(ang);
    c.beginPath();
    c.ellipse(0, 0, flowerR * 0.45, flowerR * 0.25, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#b8860b';
    c.lineWidth = 1;
    c.stroke();
    c.restore();
  }

  // Blütenmitte (braun, Gesicht)
  c.fillStyle = '#7a4a2a';
  c.beginPath();
  c.arc(flowerCx, flowerCy, flowerR * 0.62, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#3a1f10';
  c.lineWidth = 1.5;
  c.stroke();
  // Samenmuster (Punkte)
  c.fillStyle = '#3a1f10';
  for (let i = 0; i < 30; i++) {
    const ang = i * 2.4;
    const r = (i / 30) * flowerR * 0.55;
    c.beginPath();
    c.arc(flowerCx + Math.cos(ang) * r, flowerCy + Math.sin(ang) * r, 1.4, 0, Math.PI * 2);
    c.fill();
  }

  // Sonnenbrille (über die Mitte)
  const glassY = flowerCy - flowerR * 0.05;
  const glassR = flowerR * 0.22;
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(flowerCx - flowerR * 0.3, glassY, glassR, 0, Math.PI * 2);
  c.arc(flowerCx + flowerR * 0.3, glassY, glassR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#000';
  c.lineWidth = 2;
  c.stroke();
  // Steg
  c.beginPath();
  c.moveTo(flowerCx - flowerR * 0.08, glassY);
  c.lineTo(flowerCx + flowerR * 0.08, glassY);
  c.lineWidth = 3;
  c.stroke();
  // Glanz auf den Gläsern
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.beginPath();
  c.ellipse(flowerCx - flowerR * 0.36, glassY - glassR * 0.3, glassR * 0.4, glassR * 0.22, -0.3, 0, Math.PI * 2);
  c.ellipse(flowerCx + flowerR * 0.24, glassY - glassR * 0.3, glassR * 0.4, glassR * 0.22, -0.3, 0, Math.PI * 2);
  c.fill();

  // Cooler Mund (kleines Lächeln)
  c.strokeStyle = '#3a1f10';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(flowerCx, flowerCy + flowerR * 0.25, flowerR * 0.18, 0.2, Math.PI - 0.2);
  c.stroke();
}

// === Motiv: Kirsche mit Victory-Zeichen ===
function drawMotifCherryVictory(c, x, y, w, h, t) {
  // Hintergrund (Pfirsich)
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#ffe0c0');
  sky.addColorStop(1, '#ffaf80');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  // Sterne / Funkeln
  c.fillStyle = '#fff';
  for (let i = 0; i < 6; i++) {
    const sx = x + ((i * 53) % w);
    const sy = y + ((i * 71) % (h * 0.5));
    c.beginPath();
    c.arc(sx, sy, 1.5 + (i % 2), 0, Math.PI * 2);
    c.fill();
  }

  // Kirsche (groß, mittig-unten)
  const cx = x + w / 2;
  const cy = y + h * 0.62;
  const r = Math.min(w, h) * 0.26;
  c.fillStyle = '#e63946';
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#5a0a14';
  c.lineWidth = 2;
  c.stroke();
  // Glanzlicht
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.beginPath();
  c.ellipse(cx - r * 0.4, cy - r * 0.45, r * 0.22, r * 0.14, -0.4, 0, Math.PI * 2);
  c.fill();

  // Stiel + Blatt
  c.strokeStyle = '#3a6a2a';
  c.lineWidth = Math.max(2, w * 0.018);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx, cy - r);
  c.quadraticCurveTo(cx + 5, cy - r * 1.6, cx + 14, cy - r * 1.9);
  c.stroke();
  // Blatt
  c.fillStyle = '#4a8c3a';
  c.beginPath();
  c.ellipse(cx + 22, cy - r * 1.85, 8, 4, 0.4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#3a6a2a';
  c.lineWidth = 1;
  c.stroke();

  // Augen (großes Anime-Style)
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(cx - r * 0.35, cy - r * 0.15, r * 0.18, 0, Math.PI * 2);
  c.arc(cx + r * 0.35, cy - r * 0.15, r * 0.18, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(cx - r * 0.32, cy - r * 0.1, r * 0.1, 0, Math.PI * 2);
  c.arc(cx + r * 0.38, cy - r * 0.1, r * 0.1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(cx - r * 0.36, cy - r * 0.18, r * 0.04, 0, Math.PI * 2);
  c.arc(cx + r * 0.34, cy - r * 0.18, r * 0.04, 0, Math.PI * 2);
  c.fill();

  // Großes Lächeln
  c.fillStyle = '#3a0a14';
  c.beginPath();
  c.arc(cx, cy + r * 0.2, r * 0.4, 0.1, Math.PI - 0.1);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.stroke();
  // Zähne
  c.fillStyle = '#fff';
  c.fillRect(cx - r * 0.3, cy + r * 0.2, r * 0.6, r * 0.1);

  // Victory-Hand (rechts neben der Kirsche)
  const handCx = cx + r * 1.1;
  const handCy = cy - r * 0.2;
  const handR = r * 0.32;
  // Arm
  c.strokeStyle = '#5a0a14';
  c.lineWidth = Math.max(3, w * 0.022);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(cx + r * 0.85, cy + r * 0.1);
  c.lineTo(handCx, handCy + handR * 0.4);
  c.stroke();
  // Handfläche (Faust)
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(handCx, handCy + handR * 0.2, handR * 0.7, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.4;
  c.stroke();
  // Zwei Finger nach oben (V)
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.ellipse(handCx - handR * 0.25, handCy - handR * 0.5, handR * 0.18, handR * 0.55, -0.2, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.beginPath();
  c.ellipse(handCx + handR * 0.25, handCy - handR * 0.5, handR * 0.18, handR * 0.55, 0.2, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Zweite Kirsche (kleiner) verbunden über Stiel
  c.strokeStyle = '#3a6a2a';
  c.lineWidth = Math.max(2, w * 0.015);
  c.beginPath();
  c.moveTo(cx + 6, cy - r * 1.6);
  c.quadraticCurveTo(cx - 8, cy - r * 2.0, cx - 22, cy - r * 1.7);
  c.stroke();
  c.fillStyle = '#e63946';
  c.beginPath();
  c.arc(cx - 26, cy - r * 1.55, r * 0.45, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#5a0a14';
  c.lineWidth = 1.2;
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.5)';
  c.beginPath();
  c.ellipse(cx - 30, cy - r * 1.7, 4, 2, -0.4, 0, Math.PI * 2);
  c.fill();
}

// === Motiv: Eule die eine Bierdose trinkt ===
function drawMotifOwlBeer(c, x, y, w, h, t) {
  // Nachthimmel
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#1a1a4a');
  sky.addColorStop(1, '#3a2a6a');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);
  // Mond
  c.fillStyle = '#fef3c7';
  c.beginPath();
  c.arc(x + w * 0.85, y + h * 0.18, w * 0.06, 0, Math.PI * 2);
  c.fill();
  // Sterne
  c.fillStyle = '#fff';
  for (let i = 0; i < 7; i++) {
    const sx = x + ((i * 47) % w);
    const sy = y + ((i * 31) % (h * 0.5));
    c.beginPath();
    c.arc(sx, sy, 1.2, 0, Math.PI * 2);
    c.fill();
  }

  // Ast
  c.strokeStyle = '#5a3a1a';
  c.lineWidth = Math.max(6, w * 0.05);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y + h * 0.78);
  c.lineTo(x + w, y + h * 0.82);
  c.stroke();
  // Blätter am Ast
  c.fillStyle = '#4a8c3a';
  c.beginPath();
  c.arc(x + w * 0.1, y + h * 0.76, 4, 0, Math.PI * 2);
  c.arc(x + w * 0.92, y + h * 0.78, 4, 0, Math.PI * 2);
  c.fill();

  // Eule (sitzend, mittig)
  const cx = x + w / 2;
  const owlBaseY = y + h * 0.78;
  const bodyR = Math.min(w, h) * 0.25;
  // Körper
  c.fillStyle = '#a06a40';
  c.beginPath();
  c.ellipse(cx, owlBaseY - bodyR * 0.85, bodyR * 0.95, bodyR * 1.1, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#3a1f10';
  c.lineWidth = 1.5;
  c.stroke();
  // Bauchgefieder
  c.fillStyle = '#d0a070';
  c.beginPath();
  c.ellipse(cx, owlBaseY - bodyR * 0.7, bodyR * 0.55, bodyR * 0.8, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#7a4a2a';
  c.lineWidth = 1;
  c.stroke();
  // Federn-Linien
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.arc(cx, owlBaseY - bodyR * 0.95 + i * 8, bodyR * 0.4, Math.PI * 0.2, Math.PI * 0.8);
    c.stroke();
  }

  // Flügel rechts (hält Bierdose)
  c.fillStyle = '#7a4a2a';
  c.beginPath();
  c.ellipse(cx + bodyR * 0.7, owlBaseY - bodyR * 0.6, bodyR * 0.35, bodyR * 0.6, -0.3, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#3a1f10';
  c.lineWidth = 1.4;
  c.stroke();
  // Flügel links (entspannt)
  c.fillStyle = '#7a4a2a';
  c.beginPath();
  c.ellipse(cx - bodyR * 0.7, owlBaseY - bodyR * 0.6, bodyR * 0.32, bodyR * 0.55, 0.3, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Bierdose (rechts oben gehalten)
  const canCx = cx + bodyR * 0.85;
  const canCy = owlBaseY - bodyR * 1.5;
  const canW = bodyR * 0.4;
  const canH = bodyR * 0.6;
  c.fillStyle = '#e63946';
  c.fillRect(canCx - canW / 2, canCy, canW, canH);
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.strokeRect(canCx - canW / 2, canCy, canW, canH);
  // Oberseite
  c.fillStyle = '#cccccc';
  c.beginPath();
  c.ellipse(canCx, canCy, canW / 2, canW / 6, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Lasche
  c.beginPath();
  c.arc(canCx, canCy - 1, 2, 0, Math.PI * 2);
  c.fillStyle = '#888';
  c.fill();
  // Etikett
  c.fillStyle = '#fff';
  c.font = `bold ${Math.floor(canW * 0.4)}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('BIER', canCx, canCy + canH * 0.5);

  // Schaum oben aus Dose
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(canCx - canW * 0.2, canCy - 4, 3, 0, Math.PI * 2);
  c.arc(canCx, canCy - 6, 4, 0, Math.PI * 2);
  c.arc(canCx + canW * 0.2, canCy - 4, 3, 0, Math.PI * 2);
  c.fill();

  // Kopf
  const headCy = owlBaseY - bodyR * 1.7;
  const headR = bodyR * 0.7;
  c.fillStyle = '#a06a40';
  c.beginPath();
  c.arc(cx, headCy, headR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#3a1f10';
  c.lineWidth = 1.5;
  c.stroke();
  // Federohren
  c.fillStyle = '#a06a40';
  c.beginPath();
  c.moveTo(cx - headR * 0.7, headCy - headR * 0.7);
  c.lineTo(cx - headR * 0.45, headCy - headR * 1.25);
  c.lineTo(cx - headR * 0.2, headCy - headR * 0.7);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(cx + headR * 0.2, headCy - headR * 0.7);
  c.lineTo(cx + headR * 0.45, headCy - headR * 1.25);
  c.lineTo(cx + headR * 0.7, headCy - headR * 0.7);
  c.closePath();
  c.fill();
  c.stroke();
  // Augen (groß, gelb mit schwarzer Pupille)
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(cx - headR * 0.4, headCy, headR * 0.32, 0, Math.PI * 2);
  c.arc(cx + headR * 0.4, headCy, headR * 0.32, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#3a1f10';
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = '#fcd34d';
  c.beginPath();
  c.arc(cx - headR * 0.4, headCy, headR * 0.22, 0, Math.PI * 2);
  c.arc(cx + headR * 0.4, headCy, headR * 0.22, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(cx - headR * 0.4, headCy, headR * 0.12, 0, Math.PI * 2);
  c.arc(cx + headR * 0.4, headCy, headR * 0.12, 0, Math.PI * 2);
  c.fill();
  // Kleine Glanzpunkte
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(cx - headR * 0.43, headCy - 2, 1.5, 0, Math.PI * 2);
  c.arc(cx + headR * 0.37, headCy - 2, 1.5, 0, Math.PI * 2);
  c.fill();

  // Schnabel (orange Dreieck)
  c.fillStyle = '#ff8c1a';
  c.beginPath();
  c.moveTo(cx - 4, headCy + headR * 0.25);
  c.lineTo(cx + 4, headCy + headR * 0.25);
  c.lineTo(cx, headCy + headR * 0.55);
  c.closePath();
  c.fill();
  c.strokeStyle = '#3a1f10';
  c.lineWidth = 1;
  c.stroke();

  // Beschwipste Wangenröte
  c.fillStyle = 'rgba(230,57,70,0.5)';
  c.beginPath();
  c.arc(cx - headR * 0.7, headCy + headR * 0.2, 4, 0, Math.PI * 2);
  c.arc(cx + headR * 0.7, headCy + headR * 0.2, 4, 0, Math.PI * 2);
  c.fill();
}

// === Motiv: Schlafender, schnarchender Adler ===
function drawMotifEagleSnore(c, x, y, w, h, t) {
  // Berg-Hintergrund
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#a8d8ea');
  sky.addColorStop(1, '#fef3c7');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);
  // Berge hinten
  c.fillStyle = '#9ca3af';
  c.beginPath();
  c.moveTo(x, y + h * 0.55);
  c.lineTo(x + w * 0.3, y + h * 0.3);
  c.lineTo(x + w * 0.55, y + h * 0.5);
  c.lineTo(x + w * 0.85, y + h * 0.28);
  c.lineTo(x + w, y + h * 0.45);
  c.lineTo(x + w, y + h * 0.7);
  c.lineTo(x, y + h * 0.7);
  c.closePath();
  c.fill();
  // Schneekappen
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(x + w * 0.25, y + h * 0.34);
  c.lineTo(x + w * 0.3, y + h * 0.3);
  c.lineTo(x + w * 0.35, y + h * 0.34);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(x + w * 0.8, y + h * 0.32);
  c.lineTo(x + w * 0.85, y + h * 0.28);
  c.lineTo(x + w * 0.9, y + h * 0.32);
  c.closePath();
  c.fill();

  // Felsen vorne
  c.fillStyle = '#5a4a40';
  c.beginPath();
  c.moveTo(x, y + h * 0.85);
  c.lineTo(x + w * 0.2, y + h * 0.7);
  c.lineTo(x + w * 0.5, y + h * 0.78);
  c.lineTo(x + w * 0.8, y + h * 0.7);
  c.lineTo(x + w, y + h * 0.85);
  c.lineTo(x + w, y + h);
  c.lineTo(x, y + h);
  c.closePath();
  c.fill();

  // Adler (sitzend auf Felsen)
  const cx = x + w * 0.5;
  const eagleBaseY = y + h * 0.78;
  const bodyR = Math.min(w, h) * 0.22;
  // Körper (braun)
  c.fillStyle = '#5a3a1a';
  c.beginPath();
  c.ellipse(cx, eagleBaseY - bodyR * 0.7, bodyR * 0.95, bodyR * 0.95, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.stroke();
  // Bauch heller
  c.fillStyle = '#7a4a2a';
  c.beginPath();
  c.ellipse(cx, eagleBaseY - bodyR * 0.5, bodyR * 0.55, bodyR * 0.55, 0, 0, Math.PI * 2);
  c.fill();

  // Flügel zusammengelegt
  c.fillStyle = '#3a2a10';
  c.beginPath();
  c.ellipse(cx - bodyR * 0.65, eagleBaseY - bodyR * 0.55, bodyR * 0.35, bodyR * 0.7, 0.4, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.4;
  c.stroke();
  c.fillStyle = '#3a2a10';
  c.beginPath();
  c.ellipse(cx + bodyR * 0.65, eagleBaseY - bodyR * 0.55, bodyR * 0.35, bodyR * 0.7, -0.4, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Federn-Linien
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(cx - bodyR * 0.85, eagleBaseY - bodyR * 0.3 + i * 4);
    c.lineTo(cx - bodyR * 0.5, eagleBaseY - bodyR * 0.2 + i * 4);
    c.stroke();
    c.beginPath();
    c.moveTo(cx + bodyR * 0.5, eagleBaseY - bodyR * 0.2 + i * 4);
    c.lineTo(cx + bodyR * 0.85, eagleBaseY - bodyR * 0.3 + i * 4);
    c.stroke();
  }

  // Krallen
  c.fillStyle = '#fcd34d';
  c.beginPath();
  c.moveTo(cx - 8, eagleBaseY);
  c.lineTo(cx - 14, eagleBaseY + 4);
  c.lineTo(cx - 10, eagleBaseY + 4);
  c.lineTo(cx - 6, eagleBaseY + 4);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(cx + 8, eagleBaseY);
  c.lineTo(cx + 14, eagleBaseY + 4);
  c.lineTo(cx + 10, eagleBaseY + 4);
  c.lineTo(cx + 6, eagleBaseY + 4);
  c.closePath();
  c.fill();
  c.strokeStyle = '#3a1f10';
  c.lineWidth = 0.8;
  c.stroke();

  // Kopf (weiß — Weißkopfseeadler) — etwas geneigt im Schlaf
  const headCy = eagleBaseY - bodyR * 1.5;
  const headR = bodyR * 0.55;
  // Atembewegung (sanft)
  const breath = Math.sin(t * 1.5) * 1.5;
  c.fillStyle = '#fafafa';
  c.beginPath();
  c.arc(cx, headCy + breath, headR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.stroke();

  // Augen (geschlossen — Bögen)
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(cx - headR * 0.4, headCy + breath - 2, 4, Math.PI * 0.15, Math.PI * 0.85);
  c.stroke();
  c.beginPath();
  c.arc(cx + headR * 0.4, headCy + breath - 2, 4, Math.PI * 0.15, Math.PI * 0.85);
  c.stroke();
  // Wimpern
  c.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(cx - headR * 0.55 + i * 3, headCy + breath + 1);
    c.lineTo(cx - headR * 0.55 + i * 3, headCy + breath + 4);
    c.stroke();
    c.beginPath();
    c.moveTo(cx + headR * 0.25 + i * 3, headCy + breath + 1);
    c.lineTo(cx + headR * 0.25 + i * 3, headCy + breath + 4);
    c.stroke();
  }

  // Schnabel (gelb, hakig, leicht offen weil schnarcht)
  c.fillStyle = '#fcd34d';
  c.beginPath();
  c.moveTo(cx - 4, headCy + breath + headR * 0.45);
  c.lineTo(cx + 6, headCy + breath + headR * 0.45);
  c.lineTo(cx + 10, headCy + breath + headR * 0.7);
  c.lineTo(cx + 4, headCy + breath + headR * 0.78);
  c.lineTo(cx - 2, headCy + breath + headR * 0.6);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.stroke();

  // Schnarch-Blase aus Schnabel
  const snorePulse = (Math.sin(t * 2) + 1) / 2;
  c.globalAlpha = 0.7 + snorePulse * 0.3;
  c.fillStyle = '#bce8ff';
  c.beginPath();
  c.ellipse(cx + 22 + snorePulse * 4, headCy + breath + headR * 0.65 + snorePulse * 2, 6 + snorePulse * 2, 4 + snorePulse, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#5fb8e6';
  c.lineWidth = 1;
  c.stroke();
  c.globalAlpha = 1;

  // ZZZ animiert
  const zAlpha = 0.5 + 0.5 * Math.sin(t * 2);
  c.globalAlpha = zAlpha;
  c.fillStyle = '#1a1a2e';
  c.font = `bold ${Math.floor(w * 0.06)}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('z', cx + headR * 1.4, headCy + breath - headR * 0.6);
  c.fillText('Z', cx + headR * 1.9, headCy + breath - headR * 1.2);
  c.fillText('Z', cx + headR * 2.5, headCy + breath - headR * 1.9);
  c.globalAlpha = 1;
}

// === Motiv: Giraffe trinkt Kaffee und isst Kuchen ===
function drawMotifGiraffeCake(c, x, y, w, h, t) {
  // Café-Hintergrund
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#fde2c4');
  sky.addColorStop(1, '#f5c89a');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  // Tisch
  c.fillStyle = '#a06030';
  c.fillRect(x + w * 0.05, y + h * 0.7, w * 0.9, h * 0.06);
  // Tischdecke karierte Streifen
  c.fillStyle = '#fff';
  c.fillRect(x + w * 0.05, y + h * 0.7, w * 0.9, 4);

  // Boden
  c.fillStyle = '#7a4a2a';
  c.fillRect(x, y + h * 0.86, w, h * 0.14);

  // Giraffe — Kopf groß rechts, langer Hals nach oben
  const gx = x + w * 0.66;
  const headCy = y + h * 0.32;
  const headR = Math.min(w, h) * 0.16;

  // Hals (von Tisch nach oben)
  c.fillStyle = '#fcd34d';
  c.beginPath();
  c.moveTo(gx - headR * 0.6, y + h * 0.7);
  c.lineTo(gx + headR * 0.6, y + h * 0.7);
  c.lineTo(gx + headR * 0.4, headCy + headR * 0.8);
  c.lineTo(gx - headR * 0.4, headCy + headR * 0.8);
  c.closePath();
  c.fill();
  c.strokeStyle = '#a06030';
  c.lineWidth = 1.5;
  c.stroke();

  // Flecken auf Hals
  c.fillStyle = '#a06030';
  c.beginPath();
  c.ellipse(gx - 4, y + h * 0.5, 4, 5, 0, 0, Math.PI * 2);
  c.ellipse(gx + 6, y + h * 0.6, 5, 4, 0, 0, Math.PI * 2);
  c.ellipse(gx - 2, y + h * 0.65, 4, 4, 0, 0, Math.PI * 2);
  c.fill();

  // Kopf
  c.fillStyle = '#fcd34d';
  c.beginPath();
  c.ellipse(gx, headCy, headR, headR * 0.85, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#a06030';
  c.lineWidth = 1.5;
  c.stroke();
  // Schnauze (heller)
  c.fillStyle = '#fef3c7';
  c.beginPath();
  c.ellipse(gx - headR * 0.3, headCy + headR * 0.35, headR * 0.5, headR * 0.35, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Flecken auf Kopf
  c.fillStyle = '#a06030';
  c.beginPath();
  c.ellipse(gx + headR * 0.4, headCy - headR * 0.3, headR * 0.18, headR * 0.18, 0, 0, Math.PI * 2);
  c.ellipse(gx + headR * 0.55, headCy + headR * 0.1, headR * 0.13, headR * 0.13, 0, 0, Math.PI * 2);
  c.fill();

  // Hörnchen (Ossikone)
  c.fillStyle = '#a06030';
  c.fillRect(gx - headR * 0.3, headCy - headR * 1.2, 4, 12);
  c.fillRect(gx + headR * 0.15, headCy - headR * 1.2, 4, 12);
  c.fillStyle = '#3a1f10';
  c.beginPath();
  c.arc(gx - headR * 0.3 + 2, headCy - headR * 1.2, 4, 0, Math.PI * 2);
  c.arc(gx + headR * 0.15 + 2, headCy - headR * 1.2, 4, 0, Math.PI * 2);
  c.fill();

  // Ohren
  c.fillStyle = '#fcd34d';
  c.beginPath();
  c.ellipse(gx - headR * 0.85, headCy - headR * 0.3, headR * 0.3, headR * 0.18, -0.3, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#a06030';
  c.lineWidth = 1.2;
  c.stroke();
  c.fillStyle = '#fcd34d';
  c.beginPath();
  c.ellipse(gx + headR * 0.85, headCy - headR * 0.3, headR * 0.3, headR * 0.18, 0.3, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Augen (groß, freudig)
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(gx - headR * 0.25, headCy - headR * 0.1, headR * 0.18, 0, Math.PI * 2);
  c.arc(gx + headR * 0.3, headCy - headR * 0.1, headR * 0.18, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.stroke();
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(gx - headR * 0.22, headCy - headR * 0.07, headR * 0.1, 0, Math.PI * 2);
  c.arc(gx + headR * 0.33, headCy - headR * 0.07, headR * 0.1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(gx - headR * 0.25, headCy - headR * 0.13, 1.2, 0, Math.PI * 2);
  c.arc(gx + headR * 0.27, headCy - headR * 0.13, 1.2, 0, Math.PI * 2);
  c.fill();

  // Nasenlöcher
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(gx - headR * 0.4, headCy + headR * 0.32, 1.5, 0, Math.PI * 2);
  c.arc(gx - headR * 0.2, headCy + headR * 0.32, 1.5, 0, Math.PI * 2);
  c.fill();
  // Lächeln
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.3;
  c.beginPath();
  c.arc(gx - headR * 0.3, headCy + headR * 0.5, headR * 0.18, 0.2, Math.PI - 0.2);
  c.stroke();

  // Kaffeetasse (links auf Tisch)
  const cupCx = x + w * 0.22;
  const cupTop = y + h * 0.62;
  const cupW = w * 0.18;
  const cupH = h * 0.1;
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(cupCx - cupW / 2, cupTop);
  c.lineTo(cupCx + cupW / 2, cupTop);
  c.lineTo(cupCx + cupW * 0.4, cupTop + cupH);
  c.lineTo(cupCx - cupW * 0.4, cupTop + cupH);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.stroke();
  // Henkel
  c.beginPath();
  c.arc(cupCx + cupW / 2 + 4, cupTop + cupH * 0.4, 6, -Math.PI * 0.4, Math.PI * 0.4);
  c.stroke();
  // Kaffee-Oberseite
  c.fillStyle = '#5a3a1a';
  c.beginPath();
  c.ellipse(cupCx, cupTop, cupW / 2, cupW * 0.12, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Dampf (animiert)
  c.strokeStyle = '#cccccc';
  c.lineWidth = 2;
  c.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const sx = cupCx - cupW * 0.2 + i * (cupW * 0.2);
    c.beginPath();
    c.moveTo(sx, cupTop - 2);
    c.quadraticCurveTo(sx + 4 + Math.sin(t * 3 + i) * 3, cupTop - 12, sx, cupTop - 22);
    c.stroke();
  }

  // Tortenstück (mittig auf Tisch, vor Giraffe)
  const cakeCx = x + w * 0.45;
  const cakeBase = y + h * 0.7;
  const cakeW = w * 0.18;
  const cakeH = h * 0.14;
  // Teller
  c.fillStyle = '#fff';
  c.beginPath();
  c.ellipse(cakeCx, cakeBase, cakeW * 0.85, cakeW * 0.18, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#888';
  c.lineWidth = 1;
  c.stroke();
  // Tortenstück (Dreieck-Form von der Seite)
  c.fillStyle = '#f8c0c0';
  c.beginPath();
  c.moveTo(cakeCx - cakeW * 0.35, cakeBase - 2);
  c.lineTo(cakeCx + cakeW * 0.35, cakeBase - 2);
  c.lineTo(cakeCx + cakeW * 0.2, cakeBase - cakeH);
  c.lineTo(cakeCx - cakeW * 0.2, cakeBase - cakeH);
  c.closePath();
  c.fill();
  c.strokeStyle = '#a04050';
  c.lineWidth = 1.4;
  c.stroke();
  // Glasur oben
  c.fillStyle = '#e63946';
  c.beginPath();
  c.moveTo(cakeCx - cakeW * 0.2, cakeBase - cakeH);
  c.lineTo(cakeCx + cakeW * 0.2, cakeBase - cakeH);
  c.lineTo(cakeCx + cakeW * 0.25, cakeBase - cakeH + 6);
  c.lineTo(cakeCx - cakeW * 0.25, cakeBase - cakeH + 6);
  c.closePath();
  c.fill();
  c.strokeStyle = '#5a0a14';
  c.lineWidth = 1.2;
  c.stroke();
  // Schicht-Linien (Cremefüllung)
  c.strokeStyle = '#fff';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(cakeCx - cakeW * 0.32, cakeBase - cakeH * 0.55);
  c.lineTo(cakeCx + cakeW * 0.32, cakeBase - cakeH * 0.55);
  c.stroke();
  // Kirsche obendrauf
  c.fillStyle = '#e63946';
  c.beginPath();
  c.arc(cakeCx, cakeBase - cakeH - 2, 5, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#5a0a14';
  c.lineWidth = 1;
  c.stroke();
  // Kirschstiel
  c.beginPath();
  c.moveTo(cakeCx, cakeBase - cakeH - 6);
  c.lineTo(cakeCx + 3, cakeBase - cakeH - 12);
  c.strokeStyle = '#3a6a2a';
  c.lineWidth = 1.5;
  c.stroke();

  // Kuchengabel (klein neben Teller)
  c.fillStyle = '#cccccc';
  c.fillRect(cakeCx + cakeW * 0.5, cakeBase - 6, 2, 8);
  c.fillRect(cakeCx + cakeW * 0.5 - 1, cakeBase - 8, 1, 4);
  c.fillRect(cakeCx + cakeW * 0.5 + 2, cakeBase - 8, 1, 4);
}

// === Motiv: Fliegender Teppich mit Herzen ===
function drawMotifFlyingCarpet(c, x, y, w, h, t) {
  // Sternenhimmel
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#1a1a4a');
  sky.addColorStop(1, '#5a3a8a');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);
  // Mond
  c.fillStyle = '#fef3c7';
  c.beginPath();
  c.arc(x + w * 0.18, y + h * 0.2, w * 0.06, 0, Math.PI * 2);
  c.fill();
  // Sterne
  c.fillStyle = '#fff';
  for (let i = 0; i < 9; i++) {
    const sx = x + ((i * 53 + 17) % w);
    const sy = y + ((i * 41 + 11) % (h * 0.6));
    const sz = 1 + (i % 3) * 0.6;
    c.beginPath();
    c.arc(sx, sy, sz, 0, Math.PI * 2);
    c.fill();
  }

  // Teppich — schwebt sanft
  const cx = x + w / 2;
  const cy = y + h * 0.55 + Math.sin(t * 1.6) * 4;
  const carpetW = w * 0.8;
  const carpetH = h * 0.22;

  c.save();
  c.translate(cx, cy);
  c.rotate(Math.sin(t * 1.2) * 0.06);

  // Wellen-Form (vorne nach unten gewölbt, hinten leicht hoch)
  c.fillStyle = '#7a1e3f';
  c.beginPath();
  c.moveTo(-carpetW / 2, -carpetH / 2 + Math.sin(t * 2) * 3);
  c.quadraticCurveTo(-carpetW / 4, -carpetH / 2 - 6, 0, -carpetH / 2 + 2);
  c.quadraticCurveTo(carpetW / 4, -carpetH / 2 + 8, carpetW / 2, -carpetH / 2 - Math.sin(t * 2) * 3);
  c.lineTo(carpetW / 2, carpetH / 2);
  c.quadraticCurveTo(carpetW / 4, carpetH / 2 + 6, 0, carpetH / 2 - 2);
  c.quadraticCurveTo(-carpetW / 4, carpetH / 2 - 8, -carpetW / 2, carpetH / 2);
  c.closePath();
  c.fill();
  c.strokeStyle = '#3a0a1a';
  c.lineWidth = 1.6;
  c.stroke();

  // Goldener Rand
  c.strokeStyle = '#ffd700';
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(-carpetW / 2 + 6, -carpetH / 2 + 4);
  c.lineTo(carpetW / 2 - 6, -carpetH / 2 + 2);
  c.lineTo(carpetW / 2 - 6, carpetH / 2 - 4);
  c.lineTo(-carpetW / 2 + 6, carpetH / 2 - 2);
  c.closePath();
  c.stroke();

  // Herzmuster auf Teppich (3x3)
  const cols = 5, rows = 3;
  for (let r = 0; r < rows; r++) {
    for (let cc = 0; cc < cols; cc++) {
      const px = -carpetW / 2 + carpetW * (cc + 0.5) / cols;
      const py = -carpetH / 2 + carpetH * (r + 0.5) / rows;
      const heartSize = 8 + (r === 1 && cc === 2 ? 4 : 0);
      drawHeart(c, px, py, heartSize, (r + cc) % 2 === 0 ? '#ff8ad1' : '#ffd700');
    }
  }

  // Quasten links und rechts
  c.strokeStyle = '#ffd700';
  c.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const ty = -carpetH / 2 + (carpetH * (i + 0.5)) / 5;
    c.beginPath();
    c.moveTo(-carpetW / 2, ty);
    c.lineTo(-carpetW / 2 - 6, ty + 5);
    c.stroke();
    c.beginPath();
    c.moveTo(carpetW / 2, ty);
    c.lineTo(carpetW / 2 + 6, ty + 5);
    c.stroke();
  }
  c.restore();

  // Schwebende Herzen drumherum (animiert)
  for (let i = 0; i < 4; i++) {
    const phase = t * 0.8 + i * 1.6;
    const fhx = cx + Math.cos(phase) * (carpetW * 0.6) + (i - 1.5) * 8;
    const fhy = cy - carpetH - 12 + Math.sin(phase) * 6;
    drawHeart(c, fhx, fhy, 8 + Math.sin(phase * 2) * 2, '#ff5fb0');
  }
}

// === Motiv: Betrunkene Katze, die singt ===
function drawMotifDrunkSingingCat(c, x, y, w, h, t) {
  // Bar-Hintergrund
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#3a1f4a');
  sky.addColorStop(1, '#7a3a5a');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  // Bühnen-Bodenlicht (gelblich)
  const stage = c.createRadialGradient(x + w / 2, y + h * 0.85, 4, x + w / 2, y + h * 0.85, w * 0.6);
  stage.addColorStop(0, 'rgba(255, 215, 0, 0.5)');
  stage.addColorStop(1, 'rgba(255, 215, 0, 0)');
  c.fillStyle = stage;
  c.fillRect(x, y, w, h);

  // Diskokugeln
  c.fillStyle = '#cccccc';
  c.beginPath();
  c.arc(x + w * 0.85, y + h * 0.18, w * 0.045, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#888';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x + w * 0.85, y);
  c.lineTo(x + w * 0.85, y + h * 0.135);
  c.stroke();

  // Boden
  c.fillStyle = '#5a3045';
  c.fillRect(x, y + h * 0.85, w, h * 0.15);

  // Katze — wackelt und steht schräg
  const cx = x + w / 2;
  const baseY = y + h * 0.85;
  const wobble = Math.sin(t * 2.5) * 0.15;
  const bodyR = Math.min(w, h) * 0.18;

  c.save();
  c.translate(cx, baseY - bodyR * 0.7);
  c.rotate(wobble);

  // Körper
  c.fillStyle = '#f5a623';
  c.beginPath();
  c.ellipse(0, 0, bodyR * 1.0, bodyR * 1.15, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#6b4112';
  c.lineWidth = 1.5;
  c.stroke();
  // Streifen
  c.strokeStyle = '#6b4112';
  c.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(-bodyR * 0.7, -bodyR * 0.5 + i * 8);
    c.lineTo(-bodyR * 0.4, -bodyR * 0.55 + i * 8);
    c.moveTo(bodyR * 0.7, -bodyR * 0.5 + i * 8);
    c.lineTo(bodyR * 0.4, -bodyR * 0.55 + i * 8);
    c.stroke();
  }

  // Arm/Pfote rechts hochgeworfen (mit Bierglas)
  c.strokeStyle = '#f5a623';
  c.lineWidth = 8;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(bodyR * 0.4, -bodyR * 0.5);
  c.lineTo(bodyR * 1.2, -bodyR * 1.2);
  c.stroke();
  // Bierglas
  c.fillStyle = '#fcd34d';
  c.fillRect(bodyR * 1.05, -bodyR * 1.6, 14, 16);
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.strokeRect(bodyR * 1.05, -bodyR * 1.6, 14, 16);
  // Henkel
  c.beginPath();
  c.arc(bodyR * 1.05 + 14 + 4, -bodyR * 1.6 + 8, 5, -Math.PI * 0.4, Math.PI * 0.4);
  c.stroke();
  // Schaum
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(bodyR * 1.08, -bodyR * 1.62, 3, 0, Math.PI * 2);
  c.arc(bodyR * 1.13, -bodyR * 1.65, 4, 0, Math.PI * 2);
  c.arc(bodyR * 1.18, -bodyR * 1.6, 3, 0, Math.PI * 2);
  c.fill();
  // Splash (etwas Bier verschüttet)
  c.fillStyle = 'rgba(252, 211, 77, 0.7)';
  c.beginPath();
  c.arc(bodyR * 1.3, -bodyR * 1.0, 2, 0, Math.PI * 2);
  c.arc(bodyR * 1.35, -bodyR * 0.85, 1.5, 0, Math.PI * 2);
  c.fill();

  // Linker Arm hängt
  c.strokeStyle = '#f5a623';
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(-bodyR * 0.4, -bodyR * 0.4);
  c.lineTo(-bodyR * 0.7, bodyR * 0.5);
  c.stroke();

  // Kopf (weit nach hinten geneigt — singt)
  const headCy = -bodyR * 1.5;
  const headR = bodyR * 0.7;
  c.fillStyle = '#f5a623';
  c.beginPath();
  c.arc(0, headCy, headR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#6b4112';
  c.lineWidth = 1.5;
  c.stroke();
  // Ohren
  c.fillStyle = '#f5a623';
  c.beginPath();
  c.moveTo(-headR * 0.6, headCy - headR * 0.5);
  c.lineTo(-headR * 0.35, headCy - headR * 1.2);
  c.lineTo(-headR * 0.05, headCy - headR * 0.6);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(headR * 0.05, headCy - headR * 0.6);
  c.lineTo(headR * 0.35, headCy - headR * 1.2);
  c.lineTo(headR * 0.6, headCy - headR * 0.5);
  c.closePath();
  c.fill();
  c.stroke();

  // Augen — eines zugekniffen, eines glasig (X und Spirale)
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 2;
  // X-Auge
  c.beginPath();
  c.moveTo(-headR * 0.45, headCy - 4);
  c.lineTo(-headR * 0.2, headCy + 0);
  c.moveTo(-headR * 0.2, headCy - 4);
  c.lineTo(-headR * 0.45, headCy + 0);
  c.stroke();
  // Spirale-Auge
  c.beginPath();
  for (let i = 0; i < 14; i++) {
    const ang = i * 0.7;
    const rr = i * 0.4;
    const px = headR * 0.35 + Math.cos(ang) * rr;
    const py = headCy - 2 + Math.sin(ang) * rr;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.stroke();

  // Nase + Wangenröte (alkoholisch)
  c.fillStyle = '#ff8ad1';
  c.beginPath();
  c.arc(0, headCy + headR * 0.2, 3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(230,57,70,0.5)';
  c.beginPath();
  c.arc(-headR * 0.7, headCy + headR * 0.3, 5, 0, Math.PI * 2);
  c.arc(headR * 0.7, headCy + headR * 0.3, 5, 0, Math.PI * 2);
  c.fill();

  // Mund weit offen — singt!
  c.fillStyle = '#3a0a14';
  c.beginPath();
  c.ellipse(0, headCy + headR * 0.55, headR * 0.3, headR * 0.4, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.4;
  c.stroke();
  // Zunge
  c.fillStyle = '#ff5e7a';
  c.beginPath();
  c.ellipse(0, headCy + headR * 0.7, headR * 0.18, headR * 0.12, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  c.restore();

  // Musiknoten überall
  c.fillStyle = '#ffd700';
  c.font = `bold ${Math.floor(w * 0.07)}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const noteAlpha = 0.7 + 0.3 * Math.sin(t * 3);
  c.globalAlpha = noteAlpha;
  c.fillText('♪', x + w * 0.15, y + h * 0.3 + Math.sin(t * 2) * 5);
  c.fillText('♫', x + w * 0.78, y + h * 0.4 + Math.sin(t * 2 + 1) * 5);
  c.fillText('♪', x + w * 0.25, y + h * 0.55 + Math.sin(t * 2 + 2) * 5);
  c.fillText('♬', x + w * 0.85, y + h * 0.6 + Math.sin(t * 2 + 1.5) * 5);
  c.globalAlpha = 1;
}

// === Motiv: Multitasking-Oktopus (Buch schreiben + Telefon + Handy YT + Zähne putzen) ===
function drawMotifMultitaskOctopus(c, x, y, w, h, t) {
  // Unterwasser-Hintergrund
  const sky = c.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#1a4a8a');
  sky.addColorStop(1, '#0a2a5a');
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  // Bläschen
  c.fillStyle = 'rgba(255, 255, 255, 0.4)';
  for (let i = 0; i < 8; i++) {
    const bx = x + ((i * 73 + t * 8) % w);
    const by = y + h - ((i * 31 + t * 30) % h);
    c.beginPath();
    c.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2);
    c.fill();
  }

  // Oktopus-Körper (mittig)
  const cx = x + w / 2;
  const cy = y + h * 0.42;
  const bodyR = Math.min(w, h) * 0.2;
  c.fillStyle = '#c44dc4';
  c.beginPath();
  c.ellipse(cx, cy, bodyR, bodyR * 0.95, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#5a1a5a';
  c.lineWidth = 1.6;
  c.stroke();
  // Hellerer Bauch
  c.fillStyle = '#e090e0';
  c.beginPath();
  c.ellipse(cx, cy + bodyR * 0.1, bodyR * 0.7, bodyR * 0.5, 0, 0, Math.PI * 2);
  c.fill();

  // 8 Arme — die ersten 4 machen verschiedene Dinge, die anderen 4 sind dekorativ
  // Arm 1 (oben links): hält Stift + Buch
  drawTentacle(c, cx, cy, -bodyR * 0.7, -bodyR * 0.3, -bodyR * 1.7, -bodyR * 0.3, '#c44dc4');
  // Buch
  const bookCx = cx - bodyR * 1.7;
  const bookCy = cy - bodyR * 0.3;
  c.fillStyle = '#fff';
  c.fillRect(bookCx - 12, bookCy - 8, 24, 16);
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.strokeRect(bookCx - 12, bookCy - 8, 24, 16);
  // Buch-Mittellinie
  c.beginPath();
  c.moveTo(bookCx, bookCy - 8);
  c.lineTo(bookCx, bookCy + 8);
  c.stroke();
  // Textlinien
  c.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    c.beginPath();
    c.moveTo(bookCx - 10, bookCy - 5 + i * 4);
    c.lineTo(bookCx - 2, bookCy - 5 + i * 4);
    c.moveTo(bookCx + 2, bookCy - 5 + i * 4);
    c.lineTo(bookCx + 10, bookCy - 5 + i * 4);
    c.stroke();
  }
  // Stift in Arm-Spitze
  c.strokeStyle = '#fcd34d';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(bookCx + 4, bookCy + 12);
  c.lineTo(bookCx + 12, bookCy + 18);
  c.stroke();
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.moveTo(bookCx + 12, bookCy + 18);
  c.lineTo(bookCx + 14, bookCy + 22);
  c.lineTo(bookCx + 10, bookCy + 20);
  c.closePath();
  c.fill();

  // Arm 2 (oben rechts): Telefonhörer am "Ohr"
  drawTentacle(c, cx, cy, bodyR * 0.5, -bodyR * 0.7, bodyR * 0.6, -bodyR * 1.4, '#c44dc4');
  // Telefon (Hörer altmodisch)
  c.save();
  c.translate(cx + bodyR * 0.6, cy - bodyR * 1.4);
  c.rotate(-0.6);
  c.fillStyle = '#3a3a3a';
  c.beginPath();
  c.moveTo(-12, -3);
  c.quadraticCurveTo(-10, 4, -4, 4);
  c.lineTo(4, 4);
  c.quadraticCurveTo(10, 4, 12, -3);
  c.lineTo(8, -5);
  c.quadraticCurveTo(6, -1, 0, -1);
  c.quadraticCurveTo(-6, -1, -8, -5);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1;
  c.stroke();
  c.restore();
  // Telefon-Schallwellen
  c.strokeStyle = '#fff';
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(cx + bodyR * 0.6, cy - bodyR * 1.4, 14, -Math.PI * 0.3, Math.PI * 0.3);
  c.stroke();
  c.beginPath();
  c.arc(cx + bodyR * 0.6, cy - bodyR * 1.4, 18, -Math.PI * 0.3, Math.PI * 0.3);
  c.stroke();

  // Arm 3 (unten links): Smartphone mit YouTube
  drawTentacle(c, cx, cy, -bodyR * 0.7, bodyR * 0.4, -bodyR * 1.7, bodyR * 1.0, '#c44dc4');
  const phoneCx = cx - bodyR * 1.7;
  const phoneCy = cy + bodyR * 1.0;
  c.fillStyle = '#1a1a2e';
  c.fillRect(phoneCx - 9, phoneCy - 14, 18, 28);
  c.strokeStyle = '#444';
  c.lineWidth = 1;
  c.strokeRect(phoneCx - 9, phoneCy - 14, 18, 28);
  // Bildschirm
  c.fillStyle = '#fff';
  c.fillRect(phoneCx - 7, phoneCy - 11, 14, 20);
  // YT-rotes Rechteck
  c.fillStyle = '#e63946';
  c.fillRect(phoneCx - 6, phoneCy - 6, 12, 8);
  c.strokeStyle = '#000';
  c.lineWidth = 0.6;
  c.strokeRect(phoneCx - 6, phoneCy - 6, 12, 8);
  // Play-Dreieck
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(phoneCx - 1, phoneCy - 4);
  c.lineTo(phoneCx + 3, phoneCy - 2);
  c.lineTo(phoneCx - 1, phoneCy);
  c.closePath();
  c.fill();
  // Untertitel-Linien
  c.strokeStyle = '#888';
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(phoneCx - 5, phoneCy + 4);
  c.lineTo(phoneCx + 5, phoneCy + 4);
  c.moveTo(phoneCx - 5, phoneCy + 6);
  c.lineTo(phoneCx + 3, phoneCy + 6);
  c.stroke();

  // Arm 4 (unten rechts): Zahnbürste
  drawTentacle(c, cx, cy, bodyR * 0.7, bodyR * 0.4, bodyR * 1.5, bodyR * 0.2, '#c44dc4');
  // Zahnbürste
  const tbCx = cx + bodyR * 1.5;
  const tbCy = cy + bodyR * 0.2;
  c.save();
  c.translate(tbCx, tbCy);
  c.rotate(-0.5);
  // Stiel
  c.fillStyle = '#5fb8e6';
  c.fillRect(0, -3, 18, 5);
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1;
  c.strokeRect(0, -3, 18, 5);
  // Borstenkopf
  c.fillStyle = '#fff';
  c.fillRect(-7, -4, 7, 7);
  c.strokeRect(-7, -4, 7, 7);
  // Borsten
  c.strokeStyle = '#aaa';
  c.lineWidth = 0.5;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    c.moveTo(-6 + i * 1.4, -4);
    c.lineTo(-6 + i * 1.4, -7);
    c.stroke();
  }
  // Zahnpasta-Klecks
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(-3, -7, 2.5, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#bbb';
  c.lineWidth = 0.5;
  c.stroke();
  c.restore();

  // 4 weitere dekorative Arme (unten am Körper)
  drawTentacle(c, cx, cy, -bodyR * 0.4, bodyR * 0.7, -bodyR * 0.7, bodyR * 1.7, '#c44dc4');
  drawTentacle(c, cx, cy, -bodyR * 0.1, bodyR * 0.85, -bodyR * 0.1, bodyR * 1.9, '#c44dc4');
  drawTentacle(c, cx, cy, bodyR * 0.2, bodyR * 0.85, bodyR * 0.4, bodyR * 1.85, '#c44dc4');
  drawTentacle(c, cx, cy, bodyR * 0.4, bodyR * 0.7, bodyR * 0.85, bodyR * 1.6, '#c44dc4');

  // Augen (groß, gestresst)
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(cx - bodyR * 0.35, cy - bodyR * 0.15, bodyR * 0.22, 0, Math.PI * 2);
  c.arc(cx + bodyR * 0.35, cy - bodyR * 0.15, bodyR * 0.22, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.stroke();
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(cx - bodyR * 0.35, cy - bodyR * 0.13, bodyR * 0.1, 0, Math.PI * 2);
  c.arc(cx + bodyR * 0.35, cy - bodyR * 0.13, bodyR * 0.1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(cx - bodyR * 0.37, cy - bodyR * 0.16, 1.5, 0, Math.PI * 2);
  c.arc(cx + bodyR * 0.33, cy - bodyR * 0.16, 1.5, 0, Math.PI * 2);
  c.fill();
  // Schweißtropfen
  c.fillStyle = '#67e8f9';
  c.beginPath();
  c.ellipse(cx - bodyR * 0.7, cy - bodyR * 0.3, 2, 4, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#5fb8e6';
  c.lineWidth = 0.6;
  c.stroke();

  // Mund — gestresster Strich
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(cx - 6, cy + bodyR * 0.25);
  c.lineTo(cx + 6, cy + bodyR * 0.25);
  c.stroke();
}

function drawTentacle(c, fromX, fromY, ctrlX, ctrlY, toX, toY, color) {
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(fromX, fromY);
  c.quadraticCurveTo(fromX + ctrlX, fromY + ctrlY, fromX + toX, fromY + toY);
  c.stroke();
  // Saugnäpfe
  c.fillStyle = '#e090e0';
  for (let i = 0.3; i < 1; i += 0.25) {
    const px = fromX + ctrlX * 2 * i * (1 - i) + toX * i * i;
    const py = fromY + ctrlY * 2 * i * (1 - i) + toY * i * i;
    c.beginPath();
    c.arc(px, py, 1.5, 0, Math.PI * 2);
    c.fill();
  }
}

// === Motiv: Riese und 2 Zwerge zusammen am Computer ===
function drawMotifGiantDwarves(c, x, y, w, h, t) {
  // Büro-Hintergrund
  c.fillStyle = '#fef3c7';
  c.fillRect(x, y, w, h);
  // Wand-Trennung
  c.strokeStyle = '#c8b48a';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x, y + h * 0.55);
  c.lineTo(x + w, y + h * 0.55);
  c.stroke();
  // Boden
  c.fillStyle = '#8b6f47';
  c.fillRect(x, y + h * 0.85, w, h * 0.15);

  // Schreibtisch
  const deskTop = y + h * 0.65;
  const deskBot = y + h * 0.85;
  c.fillStyle = '#5a3a1a';
  c.fillRect(x + w * 0.08, deskTop, w * 0.84, 6);
  c.fillRect(x + w * 0.1, deskTop + 6, w * 0.06, deskBot - deskTop - 6);
  c.fillRect(x + w * 0.84, deskTop + 6, w * 0.06, deskBot - deskTop - 6);
  c.strokeStyle = '#3a1f10';
  c.lineWidth = 1;
  c.strokeRect(x + w * 0.08, deskTop, w * 0.84, 6);

  // Monitor (Computer) auf Schreibtisch
  const monW = w * 0.32;
  const monH = h * 0.22;
  const monCx = x + w * 0.5;
  const monBot = deskTop;
  c.fillStyle = '#1a1a2e';
  c.fillRect(monCx - monW / 2, monBot - monH, monW, monH);
  c.strokeStyle = '#000';
  c.lineWidth = 1.5;
  c.strokeRect(monCx - monW / 2, monBot - monH, monW, monH);
  // Bildschirm
  c.fillStyle = '#67e8f9';
  c.fillRect(monCx - monW / 2 + 4, monBot - monH + 4, monW - 8, monH - 8);
  // Code-Linien auf Bildschirm
  c.fillStyle = '#1a1a2e';
  for (let i = 0; i < 5; i++) {
    const lw = (i % 3 === 0 ? monW * 0.5 : i % 2 === 0 ? monW * 0.6 : monW * 0.4);
    c.fillRect(monCx - monW / 2 + 8, monBot - monH + 9 + i * 6, lw, 2);
  }
  // Cursor blinkend
  if (Math.floor(t * 2) % 2 === 0) {
    c.fillRect(monCx - monW / 2 + 8 + monW * 0.4, monBot - monH + 9 + 4 * 6, 2, 4);
  }
  // Monitor-Standfuß
  c.fillStyle = '#1a1a2e';
  c.fillRect(monCx - 6, monBot - 4, 12, 4);
  c.fillRect(monCx - 14, monBot - 1, 28, 3);

  // Tastatur vor Monitor
  c.fillStyle = '#cccccc';
  c.fillRect(monCx - monW * 0.4, deskTop + 8, monW * 0.8, 4);
  c.strokeStyle = '#888';
  c.lineWidth = 0.6;
  for (let i = 0; i < 8; i++) {
    c.beginPath();
    c.moveTo(monCx - monW * 0.4 + i * (monW * 0.1), deskTop + 8);
    c.lineTo(monCx - monW * 0.4 + i * (monW * 0.1), deskTop + 12);
    c.stroke();
  }

  // Riese (rechts, sehr groß) — Kopf reicht bis fast oben
  const giantCx = x + w * 0.82;
  const giantHeadR = h * 0.11;
  const giantHeadCy = y + h * 0.18;
  // Körper (breit, vom Schreibtisch nach oben)
  c.fillStyle = '#5a8c4a';
  c.beginPath();
  c.moveTo(giantCx - giantHeadR * 1.4, deskTop);
  c.lineTo(giantCx + giantHeadR * 1.4, deskTop);
  c.lineTo(giantCx + giantHeadR * 1.2, giantHeadCy + giantHeadR * 0.7);
  c.lineTo(giantCx - giantHeadR * 1.2, giantHeadCy + giantHeadR * 0.7);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.stroke();
  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(giantCx, giantHeadCy, giantHeadR, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.5;
  c.stroke();
  // Riesen-Haare (struppig)
  c.fillStyle = '#7a3a1a';
  c.beginPath();
  c.arc(giantCx, giantHeadCy, giantHeadR + 2, Math.PI + 0.2, 2 * Math.PI - 0.2);
  c.fill();
  // Augen
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(giantCx - giantHeadR * 0.35, giantHeadCy, 2, 0, Math.PI * 2);
  c.arc(giantCx + giantHeadR * 0.35, giantHeadCy, 2, 0, Math.PI * 2);
  c.fill();
  // Mund (lächelnd, konzentriert)
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(giantCx, giantHeadCy + giantHeadR * 0.35, 4, 0.2, Math.PI - 0.2);
  c.stroke();
  // Großer Arm zur Tastatur
  c.strokeStyle = '#f5cba7';
  c.lineWidth = 7;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(giantCx - giantHeadR * 1.3, deskTop + 4);
  c.lineTo(monCx + monW * 0.35, deskTop + 12);
  c.stroke();

  // Zwerg 1 (links, klein) — auf Stuhl
  const dwarf1Cx = x + w * 0.18;
  const dwarf1HeadR = w * 0.04;
  const dwarf1HeadCy = deskTop - 8;
  // Körper (rote Tunika)
  c.fillStyle = '#e63946';
  c.beginPath();
  c.moveTo(dwarf1Cx - 9, deskTop);
  c.lineTo(dwarf1Cx + 9, deskTop);
  c.lineTo(dwarf1Cx + 7, dwarf1HeadCy + dwarf1HeadR * 0.5);
  c.lineTo(dwarf1Cx - 7, dwarf1HeadCy + dwarf1HeadR * 0.5);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.stroke();
  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(dwarf1Cx, dwarf1HeadCy, dwarf1HeadR, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Großer weißer Bart
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(dwarf1Cx - dwarf1HeadR * 0.9, dwarf1HeadCy + 1);
  c.quadraticCurveTo(dwarf1Cx, dwarf1HeadCy + dwarf1HeadR * 1.6, dwarf1Cx + dwarf1HeadR * 0.9, dwarf1HeadCy + 1);
  c.lineTo(dwarf1Cx + dwarf1HeadR * 0.6, dwarf1HeadCy + dwarf1HeadR * 0.4);
  c.lineTo(dwarf1Cx - dwarf1HeadR * 0.6, dwarf1HeadCy + dwarf1HeadR * 0.4);
  c.closePath();
  c.fill();
  c.strokeStyle = '#aaa';
  c.lineWidth = 0.8;
  c.stroke();
  // Spitzhut (klassisch Zwerg)
  c.fillStyle = '#3a86ff';
  c.beginPath();
  c.moveTo(dwarf1Cx - dwarf1HeadR, dwarf1HeadCy - dwarf1HeadR * 0.4);
  c.lineTo(dwarf1Cx + dwarf1HeadR, dwarf1HeadCy - dwarf1HeadR * 0.4);
  c.lineTo(dwarf1Cx, dwarf1HeadCy - dwarf1HeadR * 2.5);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1;
  c.stroke();
  // Augen
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(dwarf1Cx - dwarf1HeadR * 0.3, dwarf1HeadCy, 1.2, 0, Math.PI * 2);
  c.arc(dwarf1Cx + dwarf1HeadR * 0.3, dwarf1HeadCy, 1.2, 0, Math.PI * 2);
  c.fill();
  // Arme zur Tastatur
  c.strokeStyle = '#f5cba7';
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(dwarf1Cx + 8, dwarf1HeadCy + dwarf1HeadR * 1.6);
  c.lineTo(monCx - monW * 0.35, deskTop + 12);
  c.stroke();

  // Zwerg 2 (vor dem Schreibtisch unten zentriert, schaut hoch zum Bildschirm)
  const dwarf2Cx = x + w * 0.32;
  const dwarf2HeadR = w * 0.04;
  const dwarf2HeadCy = deskTop - 10;
  // Körper (grüne Tunika)
  c.fillStyle = '#3a8c5a';
  c.beginPath();
  c.moveTo(dwarf2Cx - 9, deskTop);
  c.lineTo(dwarf2Cx + 9, deskTop);
  c.lineTo(dwarf2Cx + 7, dwarf2HeadCy + dwarf2HeadR * 0.5);
  c.lineTo(dwarf2Cx - 7, dwarf2HeadCy + dwarf2HeadR * 0.5);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1.2;
  c.stroke();
  // Kopf
  c.fillStyle = '#f5cba7';
  c.beginPath();
  c.arc(dwarf2Cx, dwarf2HeadCy, dwarf2HeadR, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  // Brauner Bart
  c.fillStyle = '#7a4a2a';
  c.beginPath();
  c.moveTo(dwarf2Cx - dwarf2HeadR * 0.9, dwarf2HeadCy + 1);
  c.quadraticCurveTo(dwarf2Cx, dwarf2HeadCy + dwarf2HeadR * 1.6, dwarf2Cx + dwarf2HeadR * 0.9, dwarf2HeadCy + 1);
  c.lineTo(dwarf2Cx + dwarf2HeadR * 0.6, dwarf2HeadCy + dwarf2HeadR * 0.4);
  c.lineTo(dwarf2Cx - dwarf2HeadR * 0.6, dwarf2HeadCy + dwarf2HeadR * 0.4);
  c.closePath();
  c.fill();
  c.strokeStyle = '#3a1f10';
  c.lineWidth = 0.8;
  c.stroke();
  // Spitzhut rot
  c.fillStyle = '#e63946';
  c.beginPath();
  c.moveTo(dwarf2Cx - dwarf2HeadR, dwarf2HeadCy - dwarf2HeadR * 0.4);
  c.lineTo(dwarf2Cx + dwarf2HeadR, dwarf2HeadCy - dwarf2HeadR * 0.4);
  c.lineTo(dwarf2Cx, dwarf2HeadCy - dwarf2HeadR * 2.5);
  c.closePath();
  c.fill();
  c.strokeStyle = '#1a1a2e';
  c.lineWidth = 1;
  c.stroke();
  // Augen — schaut konzentriert nach oben
  c.fillStyle = '#1a1a2e';
  c.beginPath();
  c.arc(dwarf2Cx - dwarf2HeadR * 0.3, dwarf2HeadCy - 1, 1.2, 0, Math.PI * 2);
  c.arc(dwarf2Cx + dwarf2HeadR * 0.3, dwarf2HeadCy - 1, 1.2, 0, Math.PI * 2);
  c.fill();

  // Eine "Idee-Glühbirne" über Riese (animiert)
  const bulbAlpha = 0.5 + 0.5 * Math.sin(t * 3);
  c.globalAlpha = bulbAlpha;
  c.fillStyle = '#fcd34d';
  c.beginPath();
  c.arc(giantCx + giantHeadR * 1.3, giantHeadCy - giantHeadR * 0.6, 6, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#a06030';
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = '#5a4a30';
  c.fillRect(giantCx + giantHeadR * 1.3 - 3, giantHeadCy - giantHeadR * 0.6 + 4, 6, 2);
  // Strahlen
  c.strokeStyle = '#fcd34d';
  c.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const ang = i * (Math.PI * 2 / 6);
    c.beginPath();
    c.moveTo(giantCx + giantHeadR * 1.3 + Math.cos(ang) * 8, giantHeadCy - giantHeadR * 0.6 + Math.sin(ang) * 8);
    c.lineTo(giantCx + giantHeadR * 1.3 + Math.cos(ang) * 12, giantHeadCy - giantHeadR * 0.6 + Math.sin(ang) * 12);
    c.stroke();
  }
  c.globalAlpha = 1;
}
