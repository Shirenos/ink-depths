// Ink Depths: a twin-stick roguelike in black and white ink.
// Pure Canvas 2D + vanilla JS, no dependencies.
'use strict';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = 960, H = 640, HUD = 64;
// Playable room bounds (inside the walls)
const RX0 = 56, RY0 = HUD + 56, RX1 = W - 56, RY1 = H - 56;
const RCX = (RX0 + RX1) / 2, RCY = (RY0 + RY1) / 2;
const DOOR = 44; // half width of a door opening

// ---------- utilities ----------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randi(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- input ----------
const keys = new Set();
let mouse = { x: 0, y: 0, down: false };
// Normalise a keyboard event to a layout-independent token. e.code is the physical
// key, so WASD works with any layout (Russian included) and with Caps Lock on.
const CODE_MAP = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyP: 'p', KeyR: 'r', KeyM: 'm',
  ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
  Escape: 'escape', Enter: 'enter', NumpadEnter: 'enter', Space: ' ' };
const CYR_MAP = { 'ц': 'w', 'ф': 'a', 'ы': 's', 'в': 'd', 'з': 'p', 'к': 'r', 'ь': 'm' };
function keyToken(e) {
  if (e.code && CODE_MAP[e.code]) return CODE_MAP[e.code];
  const k = (e.key || '').toLowerCase();
  return CYR_MAP[k] || k;
}
window.addEventListener('keydown', (e) => {
  const k = keyToken(e);
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (!keys.has(k)) onPress(k);
  keys.add(k);
});
window.addEventListener('keyup', (e) => keys.delete(keyToken(e)));
addEventListener('blur', () => { keys.clear(); mouse.down = false; if (state === 'play') state = 'pause'; });
function toCanvas(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
cv.addEventListener('mousemove', (e) => { const p = toCanvas(e); mouse.x = p.x; mouse.y = p.y; });
cv.addEventListener('mousedown', (e) => { const p = toCanvas(e); mouse.x = p.x; mouse.y = p.y; mouse.down = true; cv.focus(); audio.init(); if (state === 'title' || state === 'dead') newRun(); });
addEventListener('mouseup', () => (mouse.down = false));
cv.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- procedural audio ----------
const audio = {
  ac: null, muted: localStorage.getItem('ink-muted') === '1',
  init() { if (!this.ac) try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} if (this.ac && this.ac.state === 'suspended') this.ac.resume(); },
  tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
    if (this.muted || !this.ac) return;
    const t = this.ac.currentTime, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ac.destination); o.start(t); o.stop(t + dur);
  },
  noise(dur, vol = 0.2, hp = 800) {
    if (this.muted || !this.ac) return;
    const n = Math.floor(this.ac.sampleRate * dur), b = this.ac.createBuffer(1, n, this.ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.buffer = b;
    s.connect(f).connect(g).connect(this.ac.destination); s.start();
  },
};
const sfx = {
  shoot: () => audio.tone(rand(520, 600), 0.08, 'triangle', 0.06, 0.5),
  hit: () => audio.noise(0.06, 0.12, 2000),
  kill: () => { audio.noise(0.18, 0.18, 400); audio.tone(180, 0.2, 'sine', 0.12, 0.3); },
  hurt: () => { audio.tone(140, 0.3, 'sawtooth', 0.12, 0.4); audio.noise(0.15, 0.15, 300); },
  door: () => audio.tone(90, 0.35, 'sine', 0.2, 1.8),
  item: () => [440, 554, 659, 880].forEach((f, i) => setTimeout(() => audio.tone(f, 0.25, 'triangle', 0.1), i * 70)),
  heart: () => { audio.tone(660, 0.12, 'sine', 0.12); setTimeout(() => audio.tone(990, 0.15, 'sine', 0.1), 80); },
  enemyShot: () => audio.tone(300, 0.1, 'square', 0.03, 0.6),
  boss: () => audio.tone(55, 1.2, 'sawtooth', 0.15, 0.5),
};

// ---------- items ----------
const ITEMS = [
  { id: 'ink', name: 'Bottle of Ink', desc: 'Damage up', apply: (s) => (s.dmg += 1) },
  { id: 'quill', name: 'Sharp Quill', desc: 'Tears up', apply: (s) => (s.delay = Math.max(5, s.delay * 0.75)) },
  { id: 'feather', name: 'Crow Feather', desc: 'Speed up', apply: (s) => (s.speed += 0.6) },
  { id: 'needle', name: 'Iron Needle', desc: 'Piercing tears', apply: (s) => (s.pierce = true, s.dmg += 0.3) },
  { id: 'eye', name: 'Third Eye', desc: 'Homing tears', apply: (s) => (s.homing = true) },
  { id: 'fork', name: 'Forked Tongue', desc: 'Triple shot', apply: (s) => (s.multi = Math.min(5, s.multi + 2), s.delay *= 1.25) },
  { id: 'lens', name: 'Cracked Lens', desc: 'Range and shot speed up', apply: (s) => (s.range += 120, s.shotSpeed += 2) },
  { id: 'heart', name: 'Charcoal Heart', desc: 'Health up', apply: (s, p) => (p.maxHp += 2, p.hp += 2) },
  { id: 'stone', name: 'Heavy Stone', desc: 'Huge tears, damage up, tears down', apply: (s) => (s.size += 4, s.dmg += 1.5, s.delay *= 1.2) },
  { id: 'moon', name: 'Paper Moon', desc: 'All stats up', apply: (s) => (s.dmg += 0.4, s.delay *= 0.9, s.speed += 0.25, s.range += 40) },
  { id: 'smoke', name: 'Wisp of Smoke', desc: 'Spectral tears pass rocks', apply: (s) => (s.spectral = true, s.dmg += 0.2) },
  { id: 'twin', name: 'Twin Shadow', desc: 'Shoots backwards too', apply: (s) => (s.back = true) },
];

// ---------- game state ----------
let state = 'title'; // title | play | pause | dead | win-floor
let player, floor, map, room, tears, enemies, particles, pickups, floatTexts;
let shake = 0, time = 0, banner = null, stats, fade = 0;

function newRun() {
  audio.init();
  player = {
    x: RCX, y: RCY, r: 14, vx: 0, vy: 0, hp: 6, maxHp: 6, inv: 0, cool: 0, face: 1,
    s: { dmg: 3.5, delay: 22, speed: 3.4, range: 360, shotSpeed: 8, pierce: false, homing: false, multi: 1, size: 6, spectral: false, back: false },
    items: [],
  };
  stats = { kills: 0, rooms: 0, items: 0, start: performance.now(), floor: 1 };
  floor = 0; nextFloor(); state = 'play';
}

function nextFloor() {
  floor++; stats.floor = floor;
  map = genFloor(floor);
  enterRoom(map.start, null);
  banner = { text: `Floor ${floor}`, sub: pick(['The ink runs deeper', 'Shadows remember you', 'Quiet pages, loud teeth', 'Every blot is hungry']), t: 2.5 };
}

// Grid-based floor generator: grows rooms outwards from the centre.
function genFloor(f) {
  const N = 9, target = Math.min(18, 6 + f * 2 + randi(0, 2));
  for (let attempt = 0; attempt < 200; attempt++) {
    const grid = new Map(), key = (x, y) => x + ',' + y;
    const start = { gx: 4, gy: 4 };
    grid.set(key(4, 4), start);
    const list = [start];
    while (list.length < target) {
      const base = pick(list), d = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const nx = base.gx + d[0], ny = base.gy + d[1];
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || grid.has(key(nx, ny))) continue;
      // keep the layout branchy: avoid cells with more than one existing neighbour
      let nb = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (grid.has(key(nx + dx, ny + dy))) nb++;
      if (nb > 1 && Math.random() < 0.8) continue;
      const r = { gx: nx, gy: ny }; grid.set(key(nx, ny), r); list.push(r);
    }
    for (const r of list) {
      r.n = {}; r.cleared = false; r.seen = false; r.visited = false; r.type = 'normal';
      for (const [dir, dx, dy] of [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]]) { const o = grid.get(key(r.gx + dx, r.gy + dy)); if (o) r.n[dir] = o; }
    }
    // BFS distances to find dead ends far from the start
    const dmap = new Map([[start, 0]]), q = [start];
    while (q.length) { const c = q.shift(); for (const o of Object.values(c.n)) if (!dmap.has(o)) { dmap.set(o, dmap.get(c) + 1); q.push(o); } }
    const ends = list.filter((r) => r !== start && Object.keys(r.n).length === 1).sort((a, b) => dmap.get(b) - dmap.get(a));
    if (ends.length < 2) continue;
    ends[0].type = 'boss'; ends[1].type = 'treasure';
    start.type = 'start'; start.cleared = true;
    for (const r of list) r.rocks = r.type === 'normal' ? genRocks() : [];
    return { rooms: list, start, N };
  }
  throw new Error('floor generation failed');
}

function genRocks() {
  const rocks = [], pattern = randi(0, 3);
  const add = (x, y, r = 22) => rocks.push({ x, y, r });
  if (pattern === 1) { add(RCX - 180, RCY - 80); add(RCX + 180, RCY - 80); add(RCX - 180, RCY + 80); add(RCX + 180, RCY + 80); }
  else if (pattern === 2) { add(RCX, RCY, 34); }
  else if (pattern === 3) for (let i = 0; i < 4; i++) add(rand(RX0 + 120, RX1 - 120), rand(RY0 + 80, RY1 - 80), randi(16, 26));
  return rocks.filter((r) => Math.hypot(r.x - RCX, r.y - RCY) > 60 || pattern === 2);
}

function doorPos(dir) {
  return { n: { x: RCX, y: RY0 }, s: { x: RCX, y: RY1 }, w: { x: RX0, y: RCY }, e: { x: RX1, y: RCY } }[dir];
}
const OPP = { n: 's', s: 'n', w: 'e', e: 'w' };

function enterRoom(r, fromDir) {
  room = r; tears = []; particles = particles || []; pickups = r.pickups || (r.pickups = []); floatTexts = [];
  enemies = [];
  if (!r.visited) { stats.rooms++; r.visited = true; }
  r.seen = true; for (const o of Object.values(r.n)) o.seen = o.seen || o.type !== 'normal' ? true : o.seen || 'adj';
  if (fromDir) {
    const d = doorPos(OPP[fromDir]), off = 50;
    player.x = d.x + (fromDir === 'e' ? off : fromDir === 'w' ? -off : 0);
    player.y = d.y + (fromDir === 's' ? off : fromDir === 'n' ? -off : 0);
    player.vx = player.vy = 0;
  }
  if (!r.cleared) {
    if (r.type === 'normal') spawnWave(r);
    else if (r.type === 'boss') { spawnBoss(); sfx.boss(); banner = { text: bossName(), sub: 'Boss', t: 2 }; }
    else r.cleared = true;
  }
  if (r.type === 'treasure' && !r.looted) { r.looted = true; pickups.push(makeItemPickup(RCX, RCY)); }
  fade = 1;
}

function makeItemPickup(x, y) {
  const owned = new Set(player.items.map((i) => i.id));
  const pool = ITEMS.filter((i) => !owned.has(i.id) || i.id === 'ink' || i.id === 'heart');
  return { kind: 'item', item: pick(pool.length ? pool : ITEMS), x, y, r: 18, bob: rand(0, 6) };
}

// ---------- enemies ----------
const ENEMY = {
  fly: { hp: 4, r: 11, speed: 1.9, score: 1 },
  chaser: { hp: 9, r: 15, speed: 1.35, score: 1 },
  shooter: { hp: 10, r: 15, speed: 0.6, score: 2 },
  splitter: { hp: 16, r: 22, speed: 0.9, score: 2 },
  dasher: { hp: 12, r: 15, speed: 0.5, score: 2 },
  turret: { hp: 18, r: 18, speed: 0, score: 2 },
};
function makeEnemy(type, x, y, scale = 1) {
  const d = ENEMY[type], hpMul = 1 + (floor - 1) * 0.35;
  return { type, x, y, r: d.r * scale, hp: d.hp * hpMul * scale, maxHp: d.hp * hpMul * scale, speed: d.speed * (1 + (floor - 1) * 0.08), vx: 0, vy: 0, t: rand(0, 2), scale, flash: 0, state: 0, spawn: 0.6 };
}
function spawnWave(r) {
  const n = Math.min(9, randi(2, 4) + floor);
  const types = ['fly', 'chaser', 'shooter', 'splitter', 'dasher', 'turret'].slice(0, Math.min(6, 3 + floor));
  for (let i = 0; i < n; i++) {
    let x, y, tries = 0;
    do { x = rand(RX0 + 40, RX1 - 40); y = rand(RY0 + 40, RY1 - 40); tries++; }
    while (tries < 50 && (Math.hypot(x - player.x, y - player.y) < 220 || room.rocks.some((k) => Math.hypot(x - k.x, y - k.y) < k.r + 30)));
    enemies.push(makeEnemy(pick(types), x, y));
  }
}
function bossName() { return ['The Blotted Mother', 'Gutter King', 'The Smudge', 'Hollow Scribe'][(floor - 1) % 4]; }
function spawnBoss() {
  const hp = 220 + floor * 130;
  enemies.push({ type: 'boss', boss: true, x: RCX, y: RCY - 60, r: 42, hp, maxHp: hp, speed: 1.1 + floor * 0.1, vx: 0, vy: 0, t: 0, flash: 0, state: 0, phase: 0, spawn: 1.0 });
}

function enemyShot(e, ang, spd = 3.6, r = 7) {
  tears.push({ x: e.x, y: e.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r, enemy: true, life: 4 });
}

function updateEnemy(e, dt) {
  e.t += dt; e.flash = Math.max(0, e.flash - dt);
  if (e.spawn > 0) { e.spawn -= dt; return; }
  const ang = Math.atan2(player.y - e.y, player.x - e.x), d = dist(e, player);
  const steer = (tx, ty, sp, k = 0.08) => { e.vx += (tx * sp - e.vx) * k; e.vy += (ty * sp - e.vy) * k; };
  switch (e.type) {
    case 'fly': steer(Math.cos(ang + Math.sin(e.t * 6) * 0.9), Math.sin(ang + Math.sin(e.t * 6) * 0.9), e.speed); break;
    case 'chaser': steer(Math.cos(ang), Math.sin(ang), e.speed); break;
    case 'splitter': steer(Math.cos(ang), Math.sin(ang), e.speed * (1.4 - e.scale * 0.4)); break;
    case 'shooter': {
      const want = d < 200 ? -1 : d > 320 ? 1 : 0; // keeps its distance
      steer(Math.cos(ang) * want + Math.cos(e.t) * 0.4, Math.sin(ang) * want + Math.sin(e.t) * 0.4, e.speed * 1.5, 0.04);
      if (e.t > 1.8) { e.t = rand(0, 0.4); enemyShot(e, ang, 3.4 + floor * 0.2); sfx.enemyShot(); }
      break;
    }
    case 'dasher': {
      if (e.state === 0) { steer(0, 0, 0); if (e.t > 1.4) { e.state = 1; e.t = 0; e.aim = ang; } }
      else if (e.state === 1) { e.vx = e.vy = 0; if (e.t > 0.45) { e.state = 2; e.t = 0; e.vx = Math.cos(e.aim) * 8.5; e.vy = Math.sin(e.aim) * 8.5; } }
      else { e.vx *= 0.96; e.vy *= 0.96; if (e.t > 0.7) { e.state = 0; e.t = 0; } }
      break;
    }
    case 'turret': {
      e.vx = e.vy = 0;
      if (e.t > 2.4) { e.t = 0; const o = Math.random() * Math.PI; for (let i = 0; i < 8; i++) enemyShot(e, o + i * Math.PI / 4, 2.8); sfx.enemyShot(); }
      break;
    }
    case 'boss': updateBoss(e, ang, d, dt, steer); break;
  }
  e.x += e.vx * dt * 60; e.y += e.vy * dt * 60;
  collideWalls(e, e.type === 'dasher' && e.state === 2);
  if (e.type !== 'fly') for (const k of room.rocks) pushOut(e, k);
}

function updateBoss(e, ang, d, dt, steer) {
  const enraged = e.hp < e.maxHp * 0.5;
  if (enraged && e.phase === 0) { e.phase = 1; shake = 14; sfx.boss(); burst(e.x, e.y, 40, 1); }
  const rate = enraged ? 0.75 : 1;
  // cycle of attacks: drift + aimed spread, radial burst, charge, summon
  const cycle = Math.floor(e.state) % 4;
  if (cycle === 0) {
    steer(Math.cos(ang), Math.sin(ang), e.speed * 0.7, 0.03);
    if (e.t > 0.9 * rate) { e.t = 0; e.shots = (e.shots || 0) + 1; for (let i = -2; i <= 2; i++) enemyShot(e, ang + i * 0.18, 4.2, 8); sfx.enemyShot(); if (e.shots >= 4) { e.shots = 0; e.state++; } }
  } else if (cycle === 1) {
    e.vx *= 0.9; e.vy *= 0.9;
    if (e.t > 0.7 * rate) { e.t = 0; e.shots = (e.shots || 0) + 1; const o = e.shots * 0.2; for (let i = 0; i < 14; i++) enemyShot(e, o + i * Math.PI * 2 / 14, 3.2, 8); sfx.enemyShot(); shake = 4; if (e.shots >= (enraged ? 5 : 3)) { e.shots = 0; e.state++; } }
  } else if (cycle === 2) {
    if (!e.charging) { e.vx *= 0.85; e.vy *= 0.85; if (e.t > 0.8) { e.charging = true; e.t = 0; e.vx = Math.cos(ang) * 10; e.vy = Math.sin(ang) * 10; } }
    else if (e.t > 0.9) { e.charging = false; e.t = 0; e.shots = (e.shots || 0) + 1; if (e.shots >= 3) { e.shots = 0; e.state++; } }
  } else {
    e.vx *= 0.9; e.vy *= 0.9;
    if (e.t > 0.6) { e.t = 0; const live = enemies.filter((x) => !x.boss).length; if (live < 6) for (let i = 0; i < 2 + floor; i++) enemies.push(makeEnemy('fly', e.x + rand(-40, 40), e.y + rand(-40, 40))); e.state++; }
  }
}

function collideWalls(o, bounce) {
  const r = o.r;
  if (o.x < RX0 + r) { o.x = RX0 + r; if (bounce) { o.vx *= -1; shake = 5; } }
  if (o.x > RX1 - r) { o.x = RX1 - r; if (bounce) { o.vx *= -1; shake = 5; } }
  if (o.y < RY0 + r) { o.y = RY0 + r; if (bounce) { o.vy *= -1; shake = 5; } }
  if (o.y > RY1 - r) { o.y = RY1 - r; if (bounce) { o.vy *= -1; shake = 5; } }
}
function pushOut(o, k) {
  const dx = o.x - k.x, dy = o.y - k.y, d = Math.hypot(dx, dy) || 1, m = o.r + k.r;
  if (d < m) { o.x = k.x + dx / d * m; o.y = k.y + dy / d * m; }
}

function damageEnemy(e, dmg, kx, ky) {
  e.hp -= dmg; e.flash = 0.1; e.x += kx * (e.boss ? 0.3 : 3); e.y += ky * (e.boss ? 0.3 : 3);
  sfx.hit(); burst(e.x, e.y, 4, 0.6);
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; stats.kills++; sfx.kill(); shake = Math.max(shake, e.boss ? 20 : 4);
  burst(e.x, e.y, e.boss ? 80 : 16, e.boss ? 2 : 1);
  splats.push({ x: e.x, y: e.y, r: e.r * rand(1.2, 1.8), room, rot: rand(0, 6) });
  if (e.type === 'splitter' && e.scale > 0.55) for (let i = 0; i < 2; i++) { const c = makeEnemy('splitter', e.x + rand(-10, 10), e.y + rand(-10, 10), e.scale * 0.6); c.spawn = 0; c.vx = rand(-4, 4); c.vy = rand(-4, 4); enemies.push(c); }
  if (e.boss) {
    enemies.forEach((o) => { if (!o.dead && o !== e) { o.dead = true; burst(o.x, o.y, 10, 1); } });
    pickups.push(makeItemPickup(RCX - 90, RCY));
    pickups.push({ kind: 'trapdoor', x: RCX + 90, y: RCY, r: 26 });
    banner = { text: 'Boss defeated', sub: 'Take the item, then descend', t: 2.5 };
  }
}

// ---------- particles ----------
let splats = [];
function burst(x, y, n, power) {
  for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(1, 5) * power; particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.8), max: 0.8, r: rand(1.5, 4), c: Math.random() < 0.5 ? '#fff' : '#777' }); }
}

// ---------- player ----------
function shoot() {
  const s = player.s;
  let dx = 0, dy = 0;
  if (keys.has('arrowleft')) dx--; if (keys.has('arrowright')) dx++;
  if (keys.has('arrowup')) dy--; if (keys.has('arrowdown')) dy++;
  if (!dx && !dy && mouse.down) { const a = Math.atan2(mouse.y - player.y, mouse.x - player.x); dx = Math.cos(a); dy = Math.sin(a); }
  if (!dx && !dy) return;
  const len = Math.hypot(dx, dy); dx /= len; dy /= len;
  if (Math.abs(dx) > 0.1) player.face = Math.sign(dx);
  if (player.cool > 0) return;
  player.cool = s.delay;
  const base = Math.atan2(dy, dx);
  const fire = (a) => tears.push({ x: player.x, y: player.y, vx: Math.cos(a) * s.shotSpeed + player.vx * 0.3, vy: Math.sin(a) * s.shotSpeed + player.vy * 0.3, r: s.size, dmg: s.dmg, travel: 0, range: s.range, pierce: s.pierce, homing: s.homing, spectral: s.spectral, hit: new Set() });
  for (let i = 0; i < s.multi; i++) fire(base + (i - (s.multi - 1) / 2) * 0.16);
  if (s.back) fire(base + Math.PI);
  sfx.shoot();
}

function hurtPlayer(amount = 1) {
  if (player.inv > 0) return;
  player.hp -= amount; player.inv = 1.1; shake = 10; sfx.hurt(); burst(player.x, player.y, 14, 1);
  if (player.hp <= 0) { player.hp = 0; state = 'dead'; stats.end = performance.now(); sfx.boss(); }
}

function updatePlayer(dt) {
  let mx = 0, my = 0;
  if (keys.has('a')) mx--; if (keys.has('d')) mx++;
  if (keys.has('w')) my--; if (keys.has('s')) my++;
  const l = Math.hypot(mx, my) || 1, sp = player.s.speed;
  player.vx += (mx / l * sp - player.vx) * 0.22; player.vy += (my / l * sp - player.vy) * 0.22;
  player.x += player.vx * dt * 60; player.y += player.vy * dt * 60;
  if (mx > 0) player.face = 1; else if (mx < 0) player.face = -1;
  // doors: allow walking through an open doorway into the neighbour room
  const open = room.cleared;
  for (const [dir, nb] of Object.entries(room.n)) {
    const d = doorPos(dir);
    const inGap = dir === 'n' || dir === 's' ? Math.abs(player.x - d.x) < DOOR - player.r * 0.3 : Math.abs(player.y - d.y) < DOOR - player.r * 0.3;
    if (!open || !inGap) continue;
    if ((dir === 'n' && player.y < RY0 + 4) || (dir === 's' && player.y > RY1 - 4) || (dir === 'w' && player.x < RX0 + 4) || (dir === 'e' && player.x > RX1 - 4)) { sfx.door(); enterRoom(nb, OPP[dir]); return; }
    // let the player step into the door gap
    if (dir === 'n' && player.y < RY0 + player.r) { player.y = Math.max(player.y, RY0 - 2); continue; }
  }
  const inDoorGap = (dir) => {
    if (!open || !room.n[dir]) return false;
    const d = doorPos(dir);
    return dir === 'n' || dir === 's' ? Math.abs(player.x - d.x) < DOOR - player.r * 0.3 : Math.abs(player.y - d.y) < DOOR - player.r * 0.3;
  };
  const r = player.r;
  if (player.x < RX0 + r && !inDoorGap('w')) player.x = RX0 + r;
  if (player.x > RX1 - r && !inDoorGap('e')) player.x = RX1 - r;
  if (player.y < RY0 + r && !inDoorGap('n')) player.y = RY0 + r;
  if (player.y > RY1 - r && !inDoorGap('s')) player.y = RY1 - r;
  player.x = clamp(player.x, RX0 - 10, RX1 + 10); player.y = clamp(player.y, RY0 - 10, RY1 + 10);
  for (const k of room.rocks) pushOut(player, k);
  player.cool -= dt * 60; player.inv = Math.max(0, player.inv - dt);
  shoot();
}

// ---------- main update ----------
function update(dt) {
  time += dt;
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  fade = Math.max(0, fade - dt * 4);
  shake = Math.max(0, shake - dt * 40);
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  particles = particles.filter((p) => p.life > 0);
  if (state !== 'play') return;

  updatePlayer(dt);
  for (const e of enemies) {
    updateEnemy(e, dt);
    if (e.spawn <= 0 && dist(e, player) < e.r + player.r - 3) hurtPlayer(e.boss && floor > 2 ? 2 : 1);
  }
  for (const t of tears) {
    if (t.homing && !t.enemy) {
      let best = null, bd = 260;
      for (const e of enemies) { const d = dist(t, e); if (!e.dead && d < bd && !t.hit.has(e)) { bd = d; best = e; } }
      if (best) { const sp = Math.hypot(t.vx, t.vy), a = Math.atan2(best.y - t.y, best.x - t.x), ca = Math.atan2(t.vy, t.vx); let da = a - ca; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; const na = ca + clamp(da, -0.12, 0.12); t.vx = Math.cos(na) * sp; t.vy = Math.sin(na) * sp; }
    }
    t.x += t.vx * dt * 60; t.y += t.vy * dt * 60;
    if (t.enemy) {
      t.life -= dt;
      if (dist(t, player) < t.r + player.r - 4) { t.dead = true; hurtPlayer(1); }
    } else {
      t.travel += Math.hypot(t.vx, t.vy) * dt * 60;
      if (t.travel > t.range) t.dead = true;
      for (const e of enemies) {
        if (e.dead || e.spawn > 0 || t.hit.has(e)) continue;
        if (dist(t, e) < t.r + e.r) { const l = Math.hypot(t.vx, t.vy) || 1; damageEnemy(e, t.dmg, t.vx / l, t.vy / l); t.hit.add(e); if (!t.pierce) { t.dead = true; break; } }
      }
    }
    if (t.x < RX0 || t.x > RX1 || t.y < RY0 || t.y > RY1 || (t.enemy && t.life <= 0)) t.dead = true;
    if (!t.spectral) for (const k of room.rocks) if (Math.hypot(t.x - k.x, t.y - k.y) < k.r + t.r * 0.5) t.dead = true;
    if (t.dead) burst(t.x, t.y, 4, 0.5);
  }
  tears = tears.filter((t) => !t.dead);
  enemies = enemies.filter((e) => !e.dead);

  if (!room.cleared && enemies.length === 0) {
    room.cleared = true; sfx.door(); shake = 3;
    if (room.type === 'normal' && Math.random() < 0.3 + (player.hp < player.maxHp / 2 ? 0.2 : 0)) pickups.push({ kind: 'heart', x: RCX, y: RCY, r: 12, bob: 0 });
  }
  for (const p of pickups) {
    if (dist(p, player) > p.r + player.r) continue;
    if (p.kind === 'heart' && player.hp < player.maxHp) { player.hp = Math.min(player.maxHp, player.hp + 2); p.taken = true; sfx.heart(); floatText('+1 heart', p.x, p.y); }
    else if (p.kind === 'item') {
      p.item.apply(player.s, player); player.items.push(p.item); stats.items++; p.taken = true; sfx.item(); burst(p.x, p.y, 30, 1.3);
      banner = { text: p.item.name, sub: p.item.desc, t: 2.2 };
    } else if (p.kind === 'trapdoor' && !pickups.some((o) => o.kind === 'item' && !o.taken && o !== p && dist(o, player) < 0)) { sfx.door(); nextFloor(); return; }
  }
  pickups = room.pickups = pickups.filter((p) => !p.taken);
  for (const f of floatTexts) { f.y -= dt * 30; f.t -= dt; }
  floatTexts = floatTexts.filter((f) => f.t > 0);
}
function floatText(text, x, y) { floatTexts.push({ text, x, y, t: 1 }); }

function onPress(k) {
  audio.init();
  if (k === 'm') { audio.muted = !audio.muted; localStorage.setItem('ink-muted', audio.muted ? '1' : '0'); return; }
  if (state === 'title') { cv.focus(); return newRun(); }
  if (state === 'dead' && (k === 'enter' || k === ' ' || k === 'r')) return newRun();
  if (k === 'escape' || k === 'p') { if (state === 'play') state = 'pause'; else if (state === 'pause') state = 'play'; return; }
  if (state === 'pause' && k === 'r') return newRun();
}

// ---------- rendering ----------
// Pre-rendered paper grain texture for the floor
const grain = document.createElement('canvas'); grain.width = W; grain.height = H;
{
  const g = grain.getContext('2d'); g.fillStyle = '#121212'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { const v = randi(14, 34); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * W, Math.random() * H, rand(1, 2.5), rand(1, 2.5)); }
  g.strokeStyle = 'rgba(255,255,255,0.025)';
  for (let i = 0; i < 70; i++) { g.lineWidth = rand(0.5, 2); g.beginPath(); const x = rand(0, W), y = rand(0, H); g.moveTo(x, y); g.bezierCurveTo(x + rand(-80, 80), y + rand(-80, 80), x + rand(-80, 80), y + rand(-80, 80), x + rand(-160, 160), y + rand(-160, 160)); g.stroke(); }
}

function inkCircle(x, y, r, fill, stroke = '#000', lw = 2.5, wobble = 0.08, seed = 0) {
  ctx.beginPath();
  const n = 18;
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = r * (1 + Math.sin(a * 3 + seed + time * 2) * wobble); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function drawRoom() {
  ctx.drawImage(grain, 0, 0);
  // splats from killed enemies stay on the floor
  for (const s of splats) if (s.room === room) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.ellipse(0, 0, s.r, s.r * 0.7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  // walls
  ctx.fillStyle = '#1d1d1d';
  ctx.fillRect(0, HUD, W, RY0 - HUD); ctx.fillRect(0, RY1, W, H - RY1); ctx.fillRect(0, HUD, RX0, H - HUD); ctx.fillRect(RX1, HUD, W - RX1, H - HUD);
  ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 3; ctx.strokeRect(RX0, RY0, RX1 - RX0, RY1 - RY0);
  ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.strokeRect(RX0 - 14, RY0 - 14, RX1 - RX0 + 28, RY1 - RY0 + 28);
  // vignette
  const vg = ctx.createRadialGradient(RCX, RCY, 120, RCX, RCY, 560); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = vg; ctx.fillRect(0, HUD, W, H - HUD);
  // doors
  for (const [dir, nb] of Object.entries(room.n)) {
    const d = doorPos(dir), horiz = dir === 'n' || dir === 's';
    ctx.save(); ctx.translate(d.x, d.y); if (!horiz) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#000'; ctx.fillRect(-DOOR, -22, DOOR * 2, 44);
    ctx.strokeStyle = nb.type === 'boss' ? '#fff' : '#bbb'; ctx.lineWidth = nb.type === 'boss' ? 5 : 3;
    ctx.strokeRect(-DOOR, -22, DOOR * 2, 44);
    if (!room.cleared) { ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-DOOR + 4, -18, DOOR * 2 - 8, 36); ctx.strokeStyle = '#888'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 14, -18); ctx.lineTo(i * 14, 18); ctx.stroke(); } }
    if (nb.type === 'boss') { ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Georgia'; ctx.textAlign = 'center'; ctx.fillText('☠', 0, 6); }
    if (nb.type === 'treasure') { ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Georgia'; ctx.textAlign = 'center'; ctx.fillText('♛', 0, 6); }
    ctx.restore();
  }
  for (const k of room.rocks) { inkCircle(k.x, k.y + 4, k.r, '#000', null); inkCircle(k.x, k.y, k.r, '#4a4a4a', '#cfcfcf', 2, 0.12, k.x); ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(k.x - k.r * 0.4, k.y - k.r * 0.2); ctx.lineTo(k.x + k.r * 0.1, k.y + k.r * 0.3); ctx.stroke(); }
  if (room.type === 'start' && floor === 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '20px Georgia'; ctx.textAlign = 'center';
    ctx.fillText('WASD  move', RCX, RCY - 110); ctx.fillText('ARROWS or MOUSE  shoot', RCX, RCY - 80); ctx.fillText('ESC  pause     M  mute', RCX, RCY + 110);
  }
}

function drawPickups() {
  for (const p of pickups) {
    const bob = Math.sin(time * 3 + (p.bob || 0)) * 4;
    if (p.kind === 'item') {
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(p.x - 22, p.y + 8, 44, 18); ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 22, p.y + 8, 44, 18);
      ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; inkCircle(p.x, p.y - 10 + bob, 13, '#fff', '#000', 2, 0.15, 3); ctx.restore();
      ctx.fillStyle = '#000'; ctx.font = 'bold 15px Georgia'; ctx.textAlign = 'center'; ctx.fillText(p.item.name[0], p.x, p.y - 5 + bob);
    } else if (p.kind === 'heart') drawHeart(p.x, p.y + bob, 12, 1);
    else if (p.kind === 'trapdoor') {
      ctx.fillStyle = '#000'; ctx.fillRect(p.x - 26, p.y - 26, 52, 52); ctx.strokeStyle = '#eee'; ctx.lineWidth = 3; ctx.strokeRect(p.x - 26, p.y - 26, 52, 52);
      for (let i = 1; i < 4; i++) { ctx.strokeStyle = `rgba(255,255,255,${0.35 - i * 0.08})`; ctx.strokeRect(p.x - 26 + i * 6, p.y - 26 + i * 6, 52 - i * 12, 52 - i * 12); }
    }
  }
}

function drawHeart(x, y, s, fill) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 12, s / 12);
  const path = () => { ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(-14, 0, -12, -12, 0, -5); ctx.bezierCurveTo(12, -12, 14, 0, 0, 10); };
  path(); ctx.fillStyle = '#1a1a1a'; ctx.fill();
  if (fill > 0) { ctx.save(); path(); ctx.clip(); ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-14, -14, fill >= 1 ? 28 : 14, 28); ctx.restore(); }
  path(); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
}

function drawEnemy(e) {
  const a = e.spawn > 0 ? 1 - e.spawn / 0.6 : 1;
  ctx.globalAlpha = clamp(a, 0.15, 1);
  const body = e.flash > 0 ? '#fff' : '#0a0a0a', line = '#e6e6e6';
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.9, e.r * 0.9, e.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  const eyes = (sp = 0.35, er = 0.18) => { const ang = Math.atan2(player.y - e.y, player.x - e.x); for (const s of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x + s * e.r * sp + Math.cos(ang) * 2, e.y - e.r * 0.15 + Math.sin(ang) * 2, e.r * er, 0, 7); ctx.fill(); } };
  switch (e.type) {
    case 'fly': {
      const w = Math.sin(time * 40) * 6; ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(e.x - 9, e.y - 6, 8, 4 + w * 0.3, -0.5, 0, 7); ctx.ellipse(e.x + 9, e.y - 6, 8, 4 - w * 0.3, 0.5, 0, 7); ctx.stroke();
      inkCircle(e.x, e.y, e.r, body, line, 2, 0.1, e.t); eyes(0.35, 0.2); break;
    }
    case 'chaser': inkCircle(e.x, e.y, e.r, body, line, 2.5, 0.12, e.t); eyes(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y + e.r * 0.35, e.r * 0.35, 0.2, Math.PI - 0.2); ctx.stroke(); break;
    case 'shooter': inkCircle(e.x, e.y, e.r, body, line, 2.5, 0.05, e.t); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; { const ang = Math.atan2(player.y - e.y, player.x - e.x); ctx.beginPath(); ctx.arc(e.x + Math.cos(ang) * 4, e.y + Math.sin(ang) * 4, e.r * 0.25, 0, 7); ctx.fill(); } break;
    case 'splitter': inkCircle(e.x, e.y, e.r, body, line, 2.5, 0.22, e.t * 3); eyes(0.3, 0.14); break;
    case 'dasher': {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.state ? e.aim : Math.atan2(player.y - e.y, player.x - e.x));
      ctx.beginPath(); ctx.moveTo(e.r * 1.3, 0); ctx.lineTo(-e.r, -e.r); ctx.lineTo(-e.r * 0.5, 0); ctx.lineTo(-e.r, e.r); ctx.closePath();
      ctx.fillStyle = e.state === 1 ? (Math.floor(time * 20) % 2 ? '#fff' : '#000') : body; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); break;
    }
    case 'turret': {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(time);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? e.r * 0.6 : e.r; ctx.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } ctx.closePath();
      ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
      ctx.fillStyle = e.t > 2 ? '#fff' : '#666'; ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, 7); ctx.fill(); break;
    }
    case 'boss': {
      const pulse = 1 + Math.sin(time * 4) * 0.04;
      ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = e.phase ? 25 : 10;
      inkCircle(e.x, e.y, e.r * pulse, body, '#fff', 4, 0.14, e.t);
      ctx.restore();
      for (let i = 0; i < 6; i++) { const a = time * 0.8 + i * Math.PI / 3; ctx.strokeStyle = '#bbb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r); ctx.quadraticCurveTo(e.x + Math.cos(a + 0.4) * e.r * 1.5, e.y + Math.sin(a + 0.4) * e.r * 1.5, e.x + Math.cos(a + 0.2) * e.r * 1.8, e.y + Math.sin(a + 0.2) * e.r * 1.8); ctx.stroke(); }
      eyes(0.35, 0.16); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x, e.y + e.r * 0.35, e.r * 0.25, 0, Math.PI); ctx.fill();
      break;
    }
  }
  if (!e.boss && e.hp < e.maxHp && e.spawn <= 0) { ctx.fillStyle = '#333'; ctx.fillRect(e.x - 14, e.y - e.r - 10, 28, 3); ctx.fillStyle = '#ddd'; ctx.fillRect(e.x - 14, e.y - e.r - 10, 28 * e.hp / e.maxHp, 3); }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  if (player.inv > 0 && Math.floor(player.inv * 15) % 2) return;
  const p = player, bob = Math.abs(Math.sin(time * 10)) * (Math.hypot(p.vx, p.vy) > 0.5 ? 2 : 0);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 15, 13, 4, 0, 0, 7); ctx.fill();
  inkCircle(p.x, p.y + 6 - bob, 10, '#d9d9d9', '#000', 2.5, 0.04, 1); // body
  inkCircle(p.x, p.y - 8 - bob, 15, '#f4f4f4', '#000', 2.5, 0.03, 2); // head
  let ax = p.face, ay = 0;
  if (keys.has('arrowup')) { ax = 0; ay = -1; } else if (keys.has('arrowdown')) { ax = 0; ay = 1; }
  if (ay >= 0) for (const s of [-1, 1]) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(p.x + s * 5.5 + ax * 3, p.y - 8 - bob + ay * 2, 3, 4.5, 0, 0, 7); ctx.fill(); }
  if (ay >= 0) { ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(p.x + s * 5.5 + ax * 3, p.y - 3 - bob); ctx.lineTo(p.x + s * 5.5 + ax * 3, p.y + 1 - bob); ctx.stroke(); } }
}

function drawTears() {
  for (const t of tears) {
    if (t.enemy) { inkCircle(t.x, t.y, t.r, '#000', '#fff', 2, 0.1, t.x); }
    else { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(t.x, t.y + 10, t.r * 0.8, 0, 7); ctx.fill(); ctx.fillStyle = t.spectral ? 'rgba(255,255,255,0.55)' : '#f0f0f0'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.3, 0, 7); ctx.fill(); }
  }
}

function drawHUD() {
  ctx.fillStyle = '#060606'; ctx.fillRect(0, 0, W, HUD); ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(0, HUD - 0.5); ctx.lineTo(W, HUD - 0.5); ctx.stroke();
  for (let i = 0; i < player.maxHp / 2; i++) { const v = player.hp - i * 2; drawHeart(24 + i * 26, 22, 10, v >= 2 ? 1 : v === 1 ? 0.5 : 0); }
  const s = player.s; ctx.fillStyle = '#9a9a9a'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`DMG ${s.dmg.toFixed(1)}  TEARS ${(60 / s.delay).toFixed(1)}/s  SPD ${s.speed.toFixed(1)}  RNG ${s.range}`, 16, 50);
  ctx.fillStyle = '#ddd'; ctx.font = 'bold 16px Georgia'; ctx.textAlign = 'center'; ctx.fillText(`FLOOR ${floor}`, W / 2, 26);
  ctx.font = '11px Georgia'; ctx.fillStyle = '#777'; ctx.fillText(player.items.map((i) => i.name).slice(-4).join(' · ') || 'no items yet', W / 2, 46);
  if (audio.muted) { ctx.fillStyle = '#666'; ctx.textAlign = 'left'; ctx.fillText('muted', W / 2 + 70, 26); }
  drawMinimap();
  const boss = enemies.find((e) => e.boss);
  if (boss) { const bw = 360; ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - bw / 2, H - 34, bw, 12); ctx.fillStyle = '#eee'; ctx.fillRect(W / 2 - bw / 2, H - 34, bw * Math.max(0, boss.hp) / boss.maxHp, 12); ctx.strokeStyle = '#888'; ctx.strokeRect(W / 2 - bw / 2, H - 34, bw, 12); ctx.fillStyle = '#bbb'; ctx.font = '12px Georgia'; ctx.textAlign = 'center'; ctx.fillText(bossName(), W / 2, H - 40); }
}

function drawMinimap() {
  const cs = 13, gap = 2, ox = W - 16 - map.N * (cs + gap), oy = 4;
  const rooms = map.rooms.filter((r) => r.seen);
  const minX = Math.min(...rooms.map((r) => r.gx)), minY = Math.min(...rooms.map((r) => r.gy));
  const maxY = Math.max(...rooms.map((r) => r.gy));
  const scale = Math.min(1, 4 / Math.max(1, maxY - minY + 1));
  const c = cs * Math.max(scale, 0.75) , g = gap;
  const bx = W - 20 - (Math.max(...rooms.map((r) => r.gx)) - minX + 1) * (c + g);
  for (const r of rooms) {
    const x = bx + (r.gx - minX) * (c + g), y = oy + (r.gy - minY) * (c * 0.75 + g);
    ctx.fillStyle = r === room ? '#fff' : r.visited ? '#6a6a6a' : '#262626';
    ctx.fillRect(x, y, c, c * 0.75); ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, c - 1, c * 0.75 - 1);
    if (r.type === 'boss' || r.type === 'treasure') { ctx.fillStyle = r === room ? '#000' : '#fff'; ctx.font = '9px Georgia'; ctx.textAlign = 'center'; ctx.fillText(r.type === 'boss' ? '☠' : '♛', x + c / 2, y + c * 0.62); }
  }
  void ox;
}

function drawCenterText(title, lines, alpha = 0.78) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#f2f2f2'; ctx.font = 'bold 56px Georgia'; ctx.fillText(title, W / 2, H / 2 - 70);
  ctx.font = '18px Georgia'; ctx.fillStyle = '#aaa';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 10 + i * 30));
}

function render() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
  if (state === 'title') {
    ctx.drawImage(grain, 0, 0);
    for (let i = 0; i < 6; i++) inkCircle(W / 2 + Math.cos(time * 0.3 + i) * 300, H / 2 + Math.sin(time * 0.4 + i * 2) * 180, 30 + i * 6, 'rgba(0,0,0,0.6)', '#333', 2, 0.2, i);
    ctx.restore();
    drawCenterText('INK DEPTHS', ['A roguelike drawn in ink', '', 'WASD move  ·  Arrows or mouse shoot  ·  Esc pause  ·  M mute', '', Math.floor(time * 2) % 2 ? 'Press any key or click to start' : ''], 0.35);
    return;
  }
  drawRoom(); drawPickups();
  for (const e of enemies) drawEnemy(e);
  drawPlayer(); drawTears();
  for (const p of particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ddd'; ctx.font = '14px Georgia'; ctx.textAlign = 'center';
  for (const f of floatTexts) { ctx.globalAlpha = f.t; ctx.fillText(f.text, f.x, f.y); } ctx.globalAlpha = 1;
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, HUD, W, H - HUD); }
  ctx.restore();
  drawHUD();
  if (banner) { ctx.globalAlpha = Math.min(1, banner.t); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, H / 2 - 150, W, 74); ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Georgia'; ctx.textAlign = 'center'; ctx.fillText(banner.text, W / 2, H / 2 - 112); ctx.font = 'italic 16px Georgia'; ctx.fillStyle = '#aaa'; ctx.fillText(banner.sub, W / 2, H / 2 - 88); ctx.globalAlpha = 1; }
  if (state === 'pause') drawCenterText('PAUSED', ['Esc to resume  ·  R to restart  ·  M to mute', '', 'Items: ' + (player.items.map((i) => i.name).join(', ') || 'none')]);
  if (state === 'dead') {
    const secs = Math.round(((stats.end || performance.now()) - stats.start) / 1000);
    drawCenterText('YOU DISSOLVED', [`Reached floor ${stats.floor}`, `Enemies slain: ${stats.kills}   Rooms explored: ${stats.rooms}   Items: ${stats.items}`, `Time: ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, '', 'Press ENTER or click to try again']);
  }
}

// ---------- loop (fixed-step simulation, rAF rendering) ----------
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
particles = [];
requestAnimationFrame(frame);

// Small hook for automated smoke tests
window.__ink = { get state() { return state; }, get floor() { return floor; }, get room() { return room; }, get enemies() { return enemies; }, get player() { return player; }, newRun, nextFloor, killAll: () => enemies.forEach((e) => killEnemy(e)) };
