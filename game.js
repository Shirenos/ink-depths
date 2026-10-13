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
  Escape: 'escape', Enter: 'enter', NumpadEnter: 'enter', Space: ' ', KeyC: 'c', KeyK: 'k', KeyL: 'l', KeyQ: 'q', KeyE: 'e', Tab: 'tab', Backspace: 'backspace',
  Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5', Digit6: '6', Digit7: '7' };
const CYR_MAP = { 'ц': 'w', 'ф': 'a', 'ы': 's', 'в': 'd', 'з': 'p', 'к': 'r', 'ь': 'm', 'с': 'c', 'л': 'k', 'д': 'l', 'й': 'q', 'у': 'e' };
const DEBUG = /[?&]debug=1/.test(location.search);
const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
const SEQ2 = ['KeyI', 'KeyN', 'KeyK', 'KeyK', 'KeyI', 'KeyL', 'KeyL'];
let seqBuf = [];
function physCode(e) { if (e.code) return e.code; return { 'и': 'KeyB', 'ф': 'KeyA', 'ш': 'KeyI', 'т': 'KeyN', 'л': 'KeyK', 'д': 'KeyL' }[(e.key || '').toLowerCase()] || ''; }
function keyToken(e) {
  if (e.code && CODE_MAP[e.code]) return CODE_MAP[e.code];
  const k = (e.key || '').toLowerCase();
  return CYR_MAP[k] || k;
}
window.addEventListener('keydown', (e) => {
  const k = keyToken(e);
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab', 'backspace'].includes(k)) e.preventDefault();
  if (!e.repeat && state === 'play') { seqBuf.push(physCode(e)); if (seqBuf.length > SEQ.length) seqBuf.shift(); const j = seqBuf.join(); if (j.endsWith(SEQ.join())) { seqBuf = []; grantSecret(); } else if (j.endsWith(SEQ2.join())) { seqBuf = []; grantStroke(); } }
  if (!keys.has(k)) onPress(k);
  keys.add(k);
});
window.addEventListener('keyup', (e) => keys.delete(keyToken(e)));
addEventListener('blur', () => { keys.clear(); mouse.down = false; if (state === 'play') state = 'pause'; });
document.documentElement.lang = localStorage.getItem('ink-lang') || ((navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en');
function toCanvas(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
cv.addEventListener('mousemove', (e) => { const p = toCanvas(e); mouse.x = p.x; mouse.y = p.y; });
cv.addEventListener('mousedown', (e) => { const p = toCanvas(e); mouse.x = p.x; mouse.y = p.y; mouse.down = true; cv.focus(); audio.init(); if (state === 'title') menuClick(p); else if (state === 'collection') colClick(p); else if (state === 'dead' || state === 'end') newRun(); else if (state === 'cutscene') advanceCut(); });
addEventListener('mouseup', () => (mouse.down = false));
cv.addEventListener('contextmenu', (e) => e.preventDefault());


// ---------- language ----------
let lang = localStorage.getItem('ink-lang') || ((navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en');
function setLang(l) { lang = l; localStorage.setItem('ink-lang', l); document.documentElement.lang = l; }
const L = (k, ...a) => { const v = UI[lang][k] !== undefined ? UI[lang][k] : UI.en[k]; return typeof v === 'function' ? v(...a) : v; };
const itemName = (it) => { const t = ITEM_TXT[it.id]; return t ? (lang === 'ru' ? t[1][0] : t[2] || it.name) : it.name; };
const itemDesc = (it) => { const t = ITEM_TXT[it.id]; return t ? (lang === 'ru' ? t[1][1] : t[3] || it.desc) : it.desc; };
const itemFl = (it) => ITEM_TXT[it.id] ? (lang === 'ru' ? ITEM_TXT[it.id][1][2] : ITEM_TXT[it.id][0]) : it.fl;
const enemyName = (t) => ENEMY_TXT[t][lang === 'ru' ? 1 : 0][0];
const enemyFl = (t) => ENEMY_TXT[t][lang === 'ru' ? 1 : 0][1];
const synName = (n) => lang === 'ru' && SYN_RU[n] ? SYN_RU[n] : n;

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
  type: () => audio.tone(rand(900, 1100), 0.03, 'triangle', 0.02),
  secret: () => [262, 330, 392, 523, 659].forEach((f, i) => setTimeout(() => audio.tone(f, 0.5, 'sine', 0.06), i * 90)),
};

// ---------- items ----------
const ITEMS = [
  { id: 'ink', fl: "The pen she gave him for his birthday.", name: 'Bottle of Ink', desc: 'Damage up', apply: (s) => (s.dmg += 1) },
  { id: 'quill', fl: "He learned to write her name before his own.", name: 'Sharp Quill', desc: 'Tears up', apply: (s) => (s.delay = Math.max(5, s.delay * 0.75)) },
  { id: 'feather', fl: "Found on the hospital windowsill.", name: 'Crow Feather', desc: 'Speed up', apply: (s) => (s.speed += 0.6) },
  { id: 'needle', fl: "The nurse said it would only sting a little.", name: 'Iron Needle', desc: 'Piercing tears', apply: (s) => (s.pierce = true, s.dmg += 0.3) },
  { id: 'eye', fl: "She always knew when he was lying.", name: 'Third Eye', desc: 'Homing tears', apply: (s) => (s.homing = true) },
  { id: 'fork', fl: "Two voices telling one story.", name: 'Forked Tongue', desc: 'Triple shot', apply: (s) => (s.multi = Math.min(5, s.multi + 2), s.delay *= 1.25) },
  { id: 'lens', fl: "Her glasses. She could not see the yard without them.", name: 'Cracked Lens', desc: 'Range and shot speed up', apply: (s) => (s.range += 120, s.shotSpeed += 2) },
  { id: 'heart', fl: "Drawn on the cast, signed by everyone.", name: 'Charcoal Heart', desc: 'Health up', apply: (s, p) => (p.maxHp += 2, p.hp += 2) },
  { id: 'stone', fl: "He carried it in his pocket for luck. It did not work.", name: 'Heavy Stone', desc: 'Huge tears, damage up, tears down', apply: (s) => (s.size += 4, s.dmg += 1.5, s.delay *= 1.2) },
  { id: 'moon', fl: "Stuck on her ceiling. It glowed for ten minutes every night.", name: 'Paper Moon', desc: 'All stats up', apply: (s) => (s.dmg += 0.4, s.delay *= 0.9, s.speed += 0.25, s.range += 40) },
  { id: 'smoke', fl: "Blown-out candles. Nine of them, not ten.", name: 'Wisp of Smoke', desc: 'Spectral tears pass rocks', apply: (s) => (s.spectral = true, s.dmg += 0.2) },
  { id: 'twin', fl: "Who is the shadow, and who is the one casting it?", name: 'Twin Shadow', desc: 'Shoots backwards too', apply: (s) => (s.back = true) },
  { id: 'salt', fl: "Some tears were never cried.", name: 'Salt Tear', desc: 'Tears slow enemies', apply: (s) => (s.slow = Math.max(s.slow, 1.6)) },
  { id: 'nightshade', fl: "The medicine tasted of this.", name: 'Nightshade Ink', desc: 'Poison tears', apply: (s) => (s.poison += 1.2) },
  { id: 'die', fl: "They played until she was too tired to roll.", name: 'Loaded Die', desc: '15% chance of critical tears', apply: (s) => (s.crit += 0.15) },
  { id: 'prism', fl: "She split the sunlight on the wall to make him laugh.", name: 'Glass Prism', desc: 'Tears split on hit', apply: (s) => (s.split = true) },
  { id: 'eraser', fl: "He rubbed out her name and wrote his own instead.", name: 'Rubber Eraser', desc: 'Tears bounce off walls', apply: (s) => (s.bounce = true, s.range += 80) },
  { id: 'ribbon', fl: "From her hair. Mother kept it in a drawer.", name: 'Silk Ribbon', desc: 'Wavy tears, damage up', apply: (s) => (s.wavy = true, s.dmg += 0.6) },
  { id: 'moth', fl: "It circled the night lamp in her room.", name: 'Paper Moth', desc: 'An orbiting moth guards you', apply: (s) => (s.orbitals = Math.min(4, s.orbitals + 1)) },
  { id: 'locket', fl: "Inside: a girl, and a smaller boy holding her finger.", name: 'Silver Locket', desc: 'Orbital, health up', apply: (s, p) => (s.orbitals = Math.min(4, s.orbitals + 1), p.maxHp += 2, p.hp += 2) },
  { id: 'pup', fl: "The dog they were going to get when she came home.", name: 'Shadow Pup', desc: 'A little shadow shoots for you', apply: (s) => (s.familiars = Math.min(3, s.familiars + 1)) },
  { id: 'kite', fl: "It flew once. She watched from the window.", name: 'Ink Kite', desc: 'Familiar, range up', apply: (s) => (s.familiars = Math.min(3, s.familiars + 1), s.range += 60) },
  { id: 'tooth', fl: "He lost it the same week. Nobody noticed.", name: 'Milk Tooth', desc: 'Knockback and damage up', apply: (s) => (s.knock *= 2.2, s.dmg += 0.3) },
  { id: 'leech', fl: "The machines took a little every day.", name: 'Pale Leech', desc: 'Kills slowly heal you', apply: (s) => (s.leech += 1) },
  { id: 'umbrella', fl: "Nine days of rain, and he never opened it.", name: 'Black Umbrella', desc: 'Blocks the first hit in every room', apply: (s) => (s.shield = true) },
  { id: 'match', fl: "Lit for a candle on a cake she did not eat.", name: 'Burnt Match', desc: 'Enemies burst when they die', apply: (s) => (s.explode = true) },
  { id: 'candle', fl: "Still burning in the window of room 12.", name: 'Wax Candle', desc: 'A warm aura hurts nearby enemies', apply: (s) => (s.aura += 4) },
  { id: 'musicbox', fl: "It played her lullaby. Now it plays his.", name: 'Music Box', desc: 'Cleared rooms may heal you', apply: (s) => (s.regen += 0.35) },
  { id: 'photo', fl: "Two children. One of them is fading.", name: 'Old Photograph', desc: 'Damage x1.5 at full health', apply: (s) => (s.fullHp = true) },
  { id: 'crayon', fl: "The dragon, half finished. Green, because green was her favourite.", name: 'Crayon Drawing', desc: 'Tears up, shot speed up, health up', apply: (s, p) => (s.delay = Math.max(5, s.delay * 0.88), s.shotSpeed += 1, p.maxHp += 2, p.hp += 2) },
  { id: 'compass', name: 'Paper Compass', desc: 'Range and shot speed up', apply: (s) => (s.range += 100, s.shotSpeed += 1.5) },
  { id: 'bandage', name: 'Plaster', desc: 'Health up, full heal', apply: (s, p) => (p.maxHp += 2, p.hp = p.maxHp) },
  { id: 'sticker', name: 'Gold Star', desc: 'Damage and tears up', apply: (s) => (s.dmg += 0.6, s.delay = Math.max(5, s.delay * 0.9)) },
  { id: 'yoyo', name: 'Yo-yo', desc: 'An orbiting yo-yo guards you', apply: (s) => (s.orbitals = Math.min(4, s.orbitals + 1)) },
  { id: 'marble', name: 'Glass Marble', desc: 'Tears bounce and pierce', apply: (s) => (s.bounce = true, s.pierce = true) },
  { id: 'sock', name: 'Odd Sock', desc: 'Speed and knockback up', apply: (s) => (s.speed += 0.4, s.knock *= 1.5) },
  { id: 'cape', name: 'Blanket Cape', desc: 'Speed up, blocks a hit per room', apply: (s) => (s.speed += 0.3, s.shield = true) },
  { id: 'chalk', name: 'Chalk Stick', desc: 'Spectral tears, range up', apply: (s) => (s.spectral = true, s.range += 60) },
  { id: 'bicycle', name: 'Bicycle Bell', desc: 'Crits and tears up', apply: (s) => (s.crit += 0.1, s.delay = Math.max(5, s.delay * 0.9)) },
  { id: 'dino', name: 'Toy Dinosaur', desc: 'Familiar, damage up', apply: (s) => (s.familiars = Math.min(3, s.familiars + 1), s.dmg += 0.3) },
  { id: 'jam', name: 'Jam Sandwich', desc: 'Full heal, rooms may heal', apply: (s, p) => (p.hp = p.maxHp, s.regen += 0.2) },
  { id: 'glasses', name: 'Toy Glasses', desc: 'Homing, slowing tears', apply: (s) => (s.homing = true, s.slow = Math.max(s.slow, 1.2)) },
  { id: 'pz1', pz: 1, name: 'Music Sheet', desc: 'Tears up a lot', apply: (s) => (s.delay = Math.max(5, s.delay * 0.7)) },
  { id: 'pz2', pz: 1, name: 'Watering Can', desc: 'Familiar, rooms may heal', apply: (s) => (s.familiars = Math.min(3, s.familiars + 1), s.regen += 0.25) },
  { id: 'pz3', pz: 1, name: 'Chalk Arrow', desc: 'Homing, range up', apply: (s) => (s.homing = true, s.range += 120) },
  { id: 'pz4', pz: 1, name: 'Raincoat', desc: 'Shield, puddles no longer slow', apply: (s) => (s.shield = true, s.noPuddle = true) },
  { id: 'pz5', pz: 1, name: 'Flashlight', desc: 'Aura, crits up', apply: (s) => (s.aura += 3, s.crit += 0.1) },
  { id: 'pz6', pz: 1, name: 'Little Flame', desc: 'Big damage up, enemies burst', apply: (s) => (s.dmg += 1.5, s.explode = true) },
  { id: 'pz7', pz: 1, name: 'Mended Page', desc: 'All stats up, health up', apply: (s, p) => (s.dmg += 0.8, s.delay = Math.max(5, s.delay * 0.85), s.speed += 0.3, s.range += 80, p.maxHp += 2, p.hp += 2) },
];
const SECRET = { id: 'inkheart', fl: "Her heart was never the broken one.", name: 'Ink Heart', desc: 'Something remembers you. Everything up', apply: (s, p) => (s.dmg += 4, s.homing = true, s.pierce = true, s.size += 2, s.delay = Math.max(5, s.delay * 0.8), p.maxHp += 2, p.hp = p.maxHp) };
const SYNERGIES = [
  { a: 'eye', b: 'needle', name: 'Seeking Needle', apply: (s) => (s.dmg += 1) },
  { a: 'fork', b: 'twin', name: 'Mirror Tongue', apply: (s) => (s.backMulti = true) },
  { a: 'salt', b: 'nightshade', name: 'Frostbite', apply: (s) => (s.frostbite = true) },
  { a: 'moth', b: 'locket', name: 'Keepsakes', apply: (s) => (s.orbDmg *= 2) },
  { a: 'pup', b: 'kite', name: 'Playmates', apply: (s) => (s.famDmg += 2) },
  { a: 'candle', b: 'match', name: 'Wildfire', apply: (s) => (s.aura += 4) },
];
function checkSynergies() {
  const own = new Set(player.items.map((i) => i.id));
  for (const sy of SYNERGIES) if (!player.syn.has(sy.name) && own.has(sy.a) && own.has(sy.b)) { player.syn.add(sy.name); sy.apply(player.s); floatText(L('synergy', synName(sy.name)), player.x, player.y - 40); }
}
const STROKE = { id: 'laststroke', fl: "One line. That's all it ever needed.", name: 'Last Stroke', desc: 'Every hit ends it', apply: (s) => (s.oneShot = true) };
function grantStroke() {
  if (!player || player.stroke) return;
  player.stroke = true;
  const p = freeSpot(player.x - 60, player.y, 18);
  pickups.push({ kind: 'item', item: STROKE, x: p.x, y: p.y, r: 18, bob: 0 });
  sfx.secret(); flash = 0.6; burst(p.x, p.y, 40, 1.4);
}
function grantSecret() {
  if (!player || player.secret) return;
  player.secret = true;
  const p = freeSpot(player.x + 60, player.y, 18);
  pickups.push({ kind: 'item', item: SECRET, x: p.x, y: p.y, r: 18, bob: 0 });
  sfx.secret(); flash = 0.6; burst(p.x, p.y, 40, 1.4);
}


// ---------- game state ----------
let state = 'title'; // title | play | pause | dead | win-floor
let player, floor, map, room, tears, enemies, particles, pickups, floatTexts;
let meets = [], shake = 0, time = 0, banner = null, stats, fade = 0, flash = 0, cut = null, endTimer = 0;

function newRun() {
  audio.init();
  player = {
    x: RCX, y: RCY, r: 14, vx: 0, vy: 0, hp: 6, maxHp: 6, inv: 0, cool: 0, face: 1,
    s: { dmg: 3.5, delay: 22, speed: 3.4, range: 360, shotSpeed: 8, pierce: false, homing: false, multi: 1, size: 6, spectral: false, back: false,
      slow: 0, poison: 0, crit: 0, split: false, bounce: false, wavy: false, orbitals: 0, familiars: 0, knock: 1, leech: 0, shield: false, explode: false,
      aura: 0, regen: 0, fullHp: false, backMulti: false, frostbite: false, orbDmg: 1, famDmg: 0 },
    items: [], drops: 0, syn: new Set(), fams: [], orbs: [], shieldUp: false, secret: false, leechN: 0,
  };
  stats = { kills: 0, rooms: 0, items: 0, start: performance.now(), floor: 1, met: new Set(), offered: new Set() }; meets = [];
  floor = 0; seqBuf = []; endTimer = 0; splats = []; nextFloor(); state = 'play';
  playCut('intro');
}

function nextFloor() {
  floor++; stats.floor = floor;
  map = genFloor(floor);
  enterRoom(map.start, null);
  banner = { text: L('floor', floor), sub: floor <= 7 ? FLOOR_TXT[lang][floor - 1] : pick(DEEP_TXT[lang]), t: 2.5 };
}

// Grid-based floor generator: grows rooms outwards from the centre.
function genFloor(f) {
  const N = 9, target = Math.min(14, Math.floor(6 + f * 1.3) + randi(0, 1));
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
    ends[0].type = 'boss'; ends[1].type = 'treasure'; if (f >= 2 && ends[2]) ends[2].type = 'challenge';
    start.type = 'start'; start.cleared = true;
    for (const r of list) { r.rocks = r.type === 'normal' || r.type === 'challenge' ? genRocks() : []; r.puddles = []; r.wavesLeft = r.type === 'challenge' ? 2 : r.type === 'normal' && f >= 2 && Math.random() < 0.3 ? 1 : 0; }
    { const norm = shuffle(list.filter((r) => r.type === 'normal'));
      const want = ['puzzle', 'memory', 'shop'].concat(f >= 3 && Math.random() < 0.7 ? ['trade'] : []);
      for (const t of want) if (norm.length > (t === 'puzzle' ? 0 : 2)) { const r = norm.pop(); r.type = t; r.rocks = []; r.wavesLeft = 0; }
      const cand = list.filter((r) => r.type === 'normal'); if (cand.length) pick(cand).note = (f - 1) % 7;
      for (const par of shuffle(cand.slice())) {
        const opts = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]].filter(([d, dx, dy]) => { const x = par.gx + dx, y = par.gy + dy; return x >= 0 && y >= 0 && x < N && y < N && !grid.has(key(x, y)); });
        if (!opts.length) continue;
        const [d, dx, dy] = pick(opts), sec = { gx: par.gx + dx, gy: par.gy + dy, n: {}, type: 'secret', cleared: true, seen: false, visited: false, rocks: [], puddles: [], wavesLeft: 0, hidden: true, crack: 0 };
        grid.set(key(sec.gx, sec.gy), sec); par.n[d] = sec; sec.n[OPP[d]] = par; list.push(sec); break;
      } }
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

// Is a circle of radius r at (x, y) blocked by walls, rocks, doorways or other pickups?
function blockedAt(x, y, r, noPick) {
  if (x < RX0 + r + 8 || x > RX1 - r - 8 || y < RY0 + r + 8 || y > RY1 - r - 8) return true;
  for (const k of room.rocks) if (Math.hypot(x - k.x, y - k.y) < k.r + r + 10) return true;
  for (const d of Object.keys(room.n)) { const p = doorPos(d); if (Math.hypot(x - p.x, y - p.y) < 90) return true; }
  if (room.thorns) for (const k of room.thorns) if (Math.hypot(x - k.x, y - k.y) < k.r + r + 6) return true;
  if (!noPick && pickups) for (const p of pickups) if (!p.taken && Math.hypot(x - p.x, y - p.y) < p.r + r + 10) return true;
  return false;
}
// Spiral search for the nearest free spot around (x, y).
function freeSpot(x, y, r = 16, opt = {}) {
  if (!blockedAt(x, y, r, opt.noPick)) return { x, y };
  for (let ring = 1; ring < 80; ring++) {
    const rad = ring * 8, n = Math.max(8, Math.floor(rad / 5)), o = ring * 0.37;
    for (let i = 0; i < n; i++) { const a = o + i / n * Math.PI * 2, px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; if (!blockedAt(px, py, r, opt.noPick)) return { x: px, y: py }; }
  }
  return { x: RCX, y: RCY };
}

function freeSpotIgnoringDoors(x, y, r) {
  for (let ring = 0; ring < 40; ring++) { const rad = ring * 6, n = Math.max(1, ring * 6); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; if (px > RX0 + r && px < RX1 - r && py > RY0 + r && py < RY1 - r && !room.rocks.some((k) => Math.hypot(px - k.x, py - k.y) < k.r + r + 4)) return { x: px, y: py }; } }
  return { x, y };
}
const doorHidden = (dir) => { const nb = room.n[dir]; return nb && nb.type === 'secret' && nb.hidden; };
function doorPos(dir) {
  return { n: { x: RCX, y: RY0 }, s: { x: RCX, y: RY1 }, w: { x: RX0, y: RCY }, e: { x: RX1, y: RCY } }[dir];
}
const OPP = { n: 's', s: 'n', w: 'e', e: 'w' };

function initRoom(r) {
  if (floor === 2 && (r.type === 'normal' || r.type === 'challenge')) { r.thorns = []; for (let i = 0; i < 3; i++) { const p = freeSpot(rand(RX0 + 120, RX1 - 120), rand(RY0 + 80, RY1 - 80), 26, { noPick: true }); r.thorns.push({ x: p.x, y: p.y, r: 24 }); } }
  if (floor === 4 && r.type !== 'boss') for (let i = 0; i < 3; i++) { const p = freeSpot(rand(RX0 + 100, RX1 - 100), rand(RY0 + 70, RY1 - 70), 40, { noPick: true }); r.puddles.push({ x: p.x, y: p.y, r: 38, life: 1e9, max: 1e9 }); }
  const put = (o, x, y) => { const p = freeSpot(x, y, o.r); o.x = p.x; o.y = p.y; pickups.push(o); return o; };
  if (r.type === 'memory') { put({ kind: 'heart', r: 12, bob: 0 }, RCX, RCY + 40); playCut('mem' + Math.min(7, floor)); }
  else if (r.type === 'shop') {
    banner = { text: L('shop'), sub: L('shopSub'), t: 2.6 };
    put(Object.assign(makeItemPickup(0, 0), { price: 6 + floor }), RCX - 130, RCY + 40);
    put(Object.assign(makeItemPickup(0, 0), { price: 8 + floor }), RCX + 130, RCY + 40);
    put({ kind: 'heart', r: 12, bob: 0, price: 3 }, RCX, RCY + 70);
  } else if (r.type === 'trade') { banner = { text: L('trade'), sub: L('tradeSub'), t: 2.6 }; { const o = makeItemPickup(0, 0); if (o.kind === 'item') o.trade = true; put(o, RCX, RCY + 20); } }
  else if (r.type === 'puzzle') { pzInit(r);
  } else if (r.type === 'secret') { banner = { text: L('secret'), sub: L('secretSub'), t: 2.6 }; put(makeItemPickup(0, 0), RCX, RCY); for (let i = 0; i < 4; i++) put({ kind: 'drop', r: 8 }, RCX + rand(-90, 90), RCY + rand(50, 100)); }
}
function enterRoom(r, fromDir) {
  room = r; tears = []; particles = particles || []; pickups = r.pickups || (r.pickups = []); floatTexts = [];
  enemies = [];
  if (!r.visited) { stats.rooms++; r.visited = true; }
  r.seen = true; for (const o of Object.values(r.n)) if (!(o.type === 'secret' && o.hidden)) o.seen = true;
  if (fromDir) {
    // fromDir is the side of the NEW room we walked in through: appear just inside that door
    const d = doorPos(fromDir), off = 52;
    let px = d.x + (fromDir === 'w' ? off : fromDir === 'e' ? -off : 0);
    let py = d.y + (fromDir === 'n' ? off : fromDir === 's' ? -off : 0);
    if (r.rocks.some((k) => Math.hypot(px - k.x, py - k.y) < k.r + player.r + 4)) { const sv = room; const p = freeSpotIgnoringDoors(px, py, player.r); px = p.x; py = p.y; void sv; }
    player.x = px; player.y = py; player.vx = player.vy = 0;
    player.face = fromDir === 'e' ? -1 : 1;
    player.inv = Math.max(player.inv, 0.5);
  }
  player.shieldUp = player.s.shield; player.fams.forEach((f) => { f.x = player.x; f.y = player.y; });
  if (!r.cleared) {
    if (r.type === 'normal') spawnWave(r);
    else if (r.type === 'challenge') { spawnWave(r, { challenge: true }); banner = { text: L('challenge'), sub: L('challengeSub'), t: 2.2 }; }
    else if (r.type === 'boss') {
      spawnBoss(); sfx.boss(); banner = { text: bossName(), sub: BOSS_TXT[lang][bossIdx()][1], t: 2.5 };
      if (floor === 7 && !r.preCut) { r.preCut = true; playCut('final'); }
    }
    else r.cleared = true;
  }
  if (!r.init) { r.init = true; initRoom(r); }
  if (r.type === 'treasure' && !r.looted) { r.looted = true; const p = freeSpot(RCX, RCY, 18); pickups.push(makeItemPickup(p.x, p.y)); }
  fade = 1;
}

function makeItemPickup(x, y, id) {
  // every item can show up at most once per run, from any source; when the pool runs dry, hearts and ink instead
  const pool = id ? ITEMS.filter((i) => i.id === id && !stats.offered.has(i.id)) : ITEMS.filter((i) => !i.pz && !stats.offered.has(i.id));
  if (!pool.length) return Math.random() < 0.5 ? { kind: 'heart', x, y, r: 12, bob: 0 } : { kind: 'drop', x, y, r: 8 };
  const it = pick(pool); stats.offered.add(it.id);
  return { kind: 'item', item: it, x, y, r: 18, bob: rand(0, 6) };
}

// ---------- story puzzles: one per floor, each a page Theo drew for Ada ----------
const PZ_PADS = [-210, -70, 70, 210];
function pzInit(r) {
  const k = ((floor - 1) % 7) + 1, P = r.pz = { k, done: false, t: 0 };
  banner = { text: L('pz')[k - 1][0], sub: L('pz')[k - 1][1], t: 4 };
  if (k === 1) { P.seq = Array.from({ length: 6 }, () => Math.floor(rand(0, 4))); P.round = 0; P.phase = 'show'; P.i = 0; P.lit = -1; P.on = -1; P.t = -1; }
  else if (k === 2) { P.marks = [[RCX - 170, RCY - 70], [RCX + 10, RCY + 100], [RCX + 190, RCY - 40]].map(([x, y]) => ({ x, y })); P.start = [[RCX - 90, RCY + 20], [RCX + 60, RCY - 40], [RCX + 110, RCY + 60]]; P.pots = P.start.map(([x, y]) => ({ x, y })); P.can = { x: RX0 + 60, y: RY0 + 50 }; }
  else if (k === 3) {
    const cols = 9, x0 = RX0 + 60, dx = (RX1 - RX0 - 120) / (cols - 1), y0 = RY0 + 70, dy = (RY1 - RY0 - 140) / 4;
    let c = 0, row = 2; const pts = [[c, row]];
    while (c < cols - 1) { const opts = []; if (row > 0 && pts.length > 1 && pts[pts.length - 2][1] <= row) opts.push(-1); if (row < 4 && pts.length > 1 && pts[pts.length - 2][1] >= row) opts.push(1); if (Math.random() < 0.5 && opts.length) row += pick(opts); else c++; pts.push([c, row]); }
    P.path = pts.map(([c, r]) => ({ x: x0 + c * dx, y: y0 + r * dy })); P.light = 4; P.walk = false;
  } else if (k === 4) { P.word = L('pzWord'); P.got = 0; P.letters = []; P.spawn = 0; P.rain = 0; }
  else if (k === 5) { P.objs = []; for (let i = 0; i < 5; i++) { const p = freeSpot(rand(RX0 + 80, RX1 - 80), rand(RY0 + 60, RY1 - 60), 20, { noPick: true }); P.objs.push({ x: p.x, y: p.y, look: 0, found: false }); } P.dir = 0; P.n = 0; }
  else if (k === 6) { P.ped = { x: RX0 + 90, y: RCY - 130 }; P.lamp = { x: RX1 - 90, y: RCY + 130 }; P.carry = false; P.flame = 0; P.lanes = [-180, 0, 180].map((dx, i) => ({ x: RCX + dx, off: i * 1.1 })); }
  else if (k === 7) {
    P.sz = 80; P.x0 = RCX - P.sz * 1.5; P.y0 = RCY - P.sz * 1.5 + 10;
    do { P.slot = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]); P.rot = P.slot.map(() => Math.floor(rand(0, 4))); } while (pzSolved7(P));
    P.sel = -1; P.stand = -1; P.st = 0; P.img = pzPicture(P.sz * 3);
  }
}
function pzSolved7(P) { return P.slot.every((v, i) => v === i && P.rot[i] % 4 === 0); }
function pzPicture(n) {
  const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
  g.fillStyle = '#e9e9e4'; g.fillRect(0, 0, n, n); g.lineCap = 'round';
  g.strokeStyle = '#6fbf73'; g.lineWidth = 7; g.beginPath(); g.moveTo(n * 0.1, n * 0.6); g.quadraticCurveTo(n * 0.4, n * 0.8, n * 0.6, n * 0.55); g.quadraticCurveTo(n * 0.75, n * 0.4, n * 0.8, n * 0.2); g.stroke();
  g.beginPath(); g.arc(n * 0.84, n * 0.15, n * 0.06, 0, 7); g.stroke(); g.beginPath(); g.moveTo(n * 0.4, n * 0.66); g.lineTo(n * 0.3, n * 0.25); g.lineTo(n * 0.55, n * 0.58); g.stroke();
  g.fillStyle = '#111'; for (const [x, y, r] of [[0.42, 0.5, 0.05], [0.53, 0.46, 0.04]]) { g.beginPath(); g.arc(n * x, n * y, n * r, 0, 7); g.fill(); g.fillRect(n * x - n * r * 0.7, n * y + n * r, n * r * 1.4, n * r * 2); }
  g.strokeStyle = '#999'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(n * (0.15 + i * 0.25), n * 0.9, n * 0.07, Math.PI, 0); g.stroke(); }
  g.fillStyle = '#333'; g.font = `${Math.round(n * 0.07)}px "Comic Sans MS", cursive`; g.fillText('ADA + THEO', n * 0.05, n * 0.12);
  g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeRect(2, 2, n - 4, n - 4); return c;
}
function pzSolve() {
  const P = room.pz; P.done = true; const k = P.k;
  const p = freeSpot(RCX, RCY + 10, 18); pickups.push(makeItemPickup(p.x, p.y, 'pz' + k));
  banner = { text: L('pz')[k - 1][0], sub: L('pz')[k - 1][2], t: 3 }; sfx.item(); burst(p.x, p.y, 40, 1.4);
}
function pzTear(t) {
  const P = room.pz; if (P.k !== 7) return false;
  const c = Math.floor((t.x - P.x0) / P.sz), r = Math.floor((t.y - P.y0) / P.sz);
  if (c < 0 || c > 2 || r < 0 || r > 2) return false;
  const i = r * 3 + c; P.rot[i] = (P.rot[i] + 1) % 4; audio.tone(500, 0.08, 'triangle', 0.05); if (pzSolved7(P)) pzSolve(); return true;
}
function pzUpdate(dt) {
  const P = room.pz, pl = player; P.t += dt;
  if (P.k === 1) {
    const len = 3 + P.round, padAt = PZ_PADS.findIndex((dx) => Math.hypot(pl.x - (RCX + dx), pl.y - (RCY + 60)) < 40);
    if (P.phase === 'show') {
      const idx = Math.floor(P.t / 0.75); P.lit = P.t >= 0 && idx < len && P.t - idx * 0.75 < 0.5 ? P.seq[idx] : -1;
      if (P.lit >= 0 && P.lit !== P.prevLit) audio.tone(330 * Math.pow(1.26, P.lit), 0.4, 'triangle', 0.08);
      P.prevLit = P.lit; if (idx >= len) { P.phase = 'input'; P.i = 0; P.lit = -1; P.on = padAt; }
    } else {
      if (padAt >= 0 && padAt !== P.on) {
        if (padAt === P.seq[P.i]) { P.i++; P.lit = padAt; audio.tone(330 * Math.pow(1.26, padAt), 0.3, 'triangle', 0.08); if (P.i >= len) { P.round++; if (P.round >= 3) { pzSolve(); } else { P.phase = 'show'; P.t = -1; } } }
        else { floatText(L('pzWrong'), pl.x, pl.y - 40); audio.tone(110, 0.4, 'sine', 0.1); P.phase = 'show'; P.t = -1.2; }
      }
      if (padAt < 0) P.lit = -1;
    }
    P.on = padAt;
  } else if (P.k === 2) {
    const hs = 18, R = pl.r;
    for (const pot of P.pots) {
      const dx = pl.x - pot.x, dy = pl.y - pot.y; if (Math.abs(dx) >= hs + R || Math.abs(dy) >= hs + R) continue;
      const ox = pot.x, oy = pot.y;
      if (Math.abs(dx) > Math.abs(dy)) pot.x = pl.x - Math.sign(dx) * (hs + R); else pot.y = pl.y - Math.sign(dy) * (hs + R);
      const stuck = pot.x < RX0 + hs + 4 || pot.x > RX1 - hs - 4 || pot.y < RY0 + hs + 4 || pot.y > RY1 - hs - 4 || P.pots.some((q) => q !== pot && Math.abs(q.x - pot.x) < hs * 2 && Math.abs(q.y - pot.y) < hs * 2);
      if (stuck) { pot.x = ox; pot.y = oy; if (Math.abs(dx) > Math.abs(dy)) pl.x = pot.x + Math.sign(dx) * (hs + R); else pl.y = pot.y + Math.sign(dy) * (hs + R); }
    }
    if (Math.hypot(pl.x - P.can.x, pl.y - P.can.y) < 30) { if (!P.canOn) { P.pots.forEach((q, i) => { q.x = P.start[i][0]; q.y = P.start[i][1]; }); floatText(L('pzReset'), pl.x, pl.y - 40); } P.canOn = true; } else P.canOn = false;
    if (P.marks.every((m) => P.pots.some((q) => Math.hypot(q.x - m.x, q.y - m.y) < 16))) pzSolve();
  } else if (P.k === 3) {
    P.light -= dt; if (P.light < -6) P.light = 1.2;
    const a = P.path[0], z = P.path[P.path.length - 1];
    if (!P.walk) { if (Math.hypot(pl.x - a.x, pl.y - a.y) < 30) P.walk = true; }
    else {
      let d = 1e9; for (let i = 1; i < P.path.length; i++) d = Math.min(d, segDist(pl, P.path[i - 1], P.path[i]));
      if (d > 30) { P.walk = false; pl.x = a.x; pl.y = a.y; pl.vx = pl.vy = 0; P.light = 2; floatText(L('pzOff'), pl.x, pl.y - 40); audio.tone(110, 0.3, 'sine', 0.1); }
      else if (Math.hypot(pl.x - z.x, pl.y - z.y) < 26) pzSolve();
    }
  } else if (P.k === 4) {
    P.spawn -= dt; P.rain -= dt;
    if (P.spawn <= 0) { P.spawn = 0.55; const w = P.word, ch = Math.random() < 0.45 ? w[P.got] : w[Math.floor(rand(0, w.length))]; P.letters.push({ x: rand(RX0 + 40, RX1 - 40), y: RY0 + 10, ch, vy: rand(1.2, 1.9) }); }
    if (P.rain <= 0) { P.rain = 0.32; enemyShot({ x: rand(RX0 + 20, RX1 - 20), y: RY0 + 6 }, Math.PI / 2 + rand(-0.15, 0.15), 3.4, 5); }
    for (const l of P.letters) { l.y += l.vy * dt * 60; if (Math.hypot(pl.x - l.x, pl.y - l.y) < 26) { l.dead = true; if (l.ch === P.word[P.got]) { P.got++; audio.tone(500 + P.got * 60, 0.15, 'triangle', 0.07); if (P.got >= P.word.length) { pzSolve(); tears = tears.filter((t) => !t.enemy); } } else { P.got = Math.max(0, P.got - 1); floatText(L('pzWrong'), l.x, l.y - 20); audio.tone(120, 0.2, 'sine', 0.08); } } if (l.y > RY1) l.dead = true; }
    P.letters = P.letters.filter((l) => !l.dead);
  } else if (P.k === 5) {
    let a = Math.hypot(pl.vx, pl.vy) > 0.4 ? Math.atan2(pl.vy, pl.vx) : P.dir;
    if (pl.aimT !== undefined && time - pl.aimT < 0.4) a = pl.aim;
    let da = a - P.dir; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; P.dir += da * Math.min(1, dt * 10);
    P.objs.forEach((o, i) => {
      if (o.found) return; let d = Math.atan2(o.y - pl.y, o.x - pl.x) - P.dir; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) < 0.45 && Math.hypot(o.x - pl.x, o.y - pl.y) < 270) o.look += dt; else o.look = Math.max(0, o.look - dt);
      if (o.look > 0.5) { o.found = true; P.n++; banner = { text: L('pzFound', P.n), sub: L('finds')[i], t: 2.4 }; audio.tone(600, 0.3, 'triangle', 0.08); if (P.n >= 5) pzSolve(); }
    });
  } else if (P.k === 6) {
    if (!P.carry && Math.hypot(pl.x - P.ped.x, pl.y - P.ped.y) < 34) { P.carry = true; P.flame = 100; audio.tone(700, 0.2, 'triangle', 0.06); }
    if (P.carry) {
      const gust = P.lanes.some((l) => Math.abs(pl.x - l.x) < 45 && pzGust(l, P.t) === 2);
      if (gust) { P.flame -= 75 * dt; pl.y += 1.1 * dt * 60; } else P.flame = Math.min(100, P.flame + 18 * dt);
      if (P.flame <= 0) { P.carry = false; floatText(L('pzOut'), pl.x, pl.y - 40); audio.tone(100, 0.4, 'sine', 0.1); }
      else if (Math.hypot(pl.x - P.lamp.x, pl.y - P.lamp.y) < 34) pzSolve();
    }
  } else if (P.k === 7) {
    const c = Math.floor((pl.x - P.x0) / P.sz), r = Math.floor((pl.y - P.y0) / P.sz), at = c >= 0 && c < 3 && r >= 0 && r < 3 ? r * 3 + c : -1;
    if (at !== P.stand) { P.stand = at; P.st = 0; P.used = false; } else P.st += dt;
    if (at >= 0 && P.st > 0.45 && !P.used) {
      P.used = true;
      if (P.sel < 0) { P.sel = at; audio.tone(440, 0.1, 'triangle', 0.05); }
      else if (P.sel === at) P.sel = -1;
      else { const a = P.sel; [P.slot[a], P.slot[at]] = [P.slot[at], P.slot[a]]; [P.rot[a], P.rot[at]] = [P.rot[at], P.rot[a]]; P.sel = -1; audio.tone(660, 0.15, 'triangle', 0.06); if (pzSolved7(P)) pzSolve(); }
    }
  }
}
function pzGust(l, t) { const c = (t + l.off) % 3.4; return c > 1.6 ? 2 : c > 1.0 ? 1 : 0; } // 0 calm, 1 warning, 2 gust
function segDist(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1, u = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l, 0, 1); return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy); }
function pzDraw() {
  const P = room.pz; ctx.save(); ctx.textAlign = 'center';
  if (P.k === 1) PZ_PADS.forEach((dx, i) => { const x = RCX + dx, y = RCY + 60, on = P.lit === i || P.done; ctx.fillStyle = on ? '#f4f4f4' : '#1a1a1a'; ctx.strokeStyle = '#ccc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 40, 24, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = on ? '#000' : '#888'; ctx.font = '22px Georgia'; ctx.fillText(['♩', '♪', '♫', '♬'][i], x, y + 8); });
  if (P.k === 1 && !P.done) { ctx.fillStyle = '#999'; ctx.font = '14px Georgia'; ctx.fillText(`${P.round + 1}/3`, RCX, RCY - 30); }
  if (P.k === 2) { for (const m of P.marks) { ctx.strokeStyle = '#6fbf73'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.strokeRect(m.x - 20, m.y - 20, 40, 40); ctx.setLineDash([]); } for (const q of P.pots) { ctx.fillStyle = '#d0d0d0'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(q.x - 18, q.y - 12); ctx.lineTo(q.x + 18, q.y - 12); ctx.lineTo(q.x + 12, q.y + 18); ctx.lineTo(q.x - 12, q.y + 18); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#6fbf73'; ctx.beginPath(); ctx.moveTo(q.x, q.y - 12); ctx.lineTo(q.x, q.y - 26); ctx.stroke(); ctx.fillStyle = '#eee'; ctx.beginPath(); ctx.arc(q.x, q.y - 29, 5, 0, 7); ctx.fill(); } ctx.fillStyle = '#bbb'; ctx.font = '24px Georgia'; ctx.fillText('⟲', P.can.x, P.can.y + 8); }
  if (P.k === 3) { const a = P.path[0], z = P.path[P.path.length - 1]; ctx.strokeStyle = '#eee'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, 16, 0, 7); ctx.stroke(); ctx.fillStyle = '#6fbf73'; ctx.beginPath(); ctx.arc(z.x, z.y, 12, 0, 7); ctx.fill(); }
  if (P.k === 4) { ctx.font = 'bold 26px Georgia'; for (const l of P.letters) { ctx.fillStyle = '#f0f0f0'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeText(l.ch, l.x, l.y); ctx.fillText(l.ch, l.x, l.y); } }
  if (P.k === 5) for (const o of P.objs) { ctx.strokeStyle = o.found ? '#6fbf73' : '#ddd'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(o.x, o.y, 14, 0, 7); ctx.stroke(); ctx.fillStyle = o.found ? '#6fbf73' : '#ddd'; ctx.font = '16px Georgia'; ctx.fillText(o.found ? '✓' : '?', o.x, o.y + 6); }
  if (P.k === 6) {
    for (const l of P.lanes) { const g = pzGust(l, P.t); if (!g) continue; ctx.strokeStyle = g === 2 ? 'rgba(230,230,230,0.35)' : 'rgba(200,200,200,0.12)'; ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const y = RY0 + ((i * 53 + P.t * (g === 2 ? 700 : 200)) % (RY1 - RY0)); ctx.beginPath(); ctx.moveTo(l.x - 40 + (i * 17) % 80, y); ctx.lineTo(l.x - 40 + (i * 17) % 80, y + 22); ctx.stroke(); } }
    for (const [o, lit] of [[P.ped, !P.carry && !P.done], [P.lamp, P.done]]) { ctx.strokeStyle = '#ccc'; ctx.lineWidth = 3; ctx.strokeRect(o.x - 12, o.y - 4, 24, 26); if (lit) { ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(o.x, o.y - 14, 6, 12, 0, 0, 7); ctx.fill(); ctx.restore(); } }
  }
  if (P.k === 7) for (let i = 0; i < 9; i++) {
    const x = P.x0 + (i % 3) * P.sz, y = P.y0 + Math.floor(i / 3) * P.sz, src = P.slot[i], s = P.sz;
    ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.rotate(P.rot[i] * Math.PI / 2); ctx.drawImage(P.img, (src % 3) * s, Math.floor(src / 3) * s, s, s, -s / 2, -s / 2, s, s); ctx.restore();
    ctx.strokeStyle = P.sel === i ? '#6fbf73' : '#111'; ctx.lineWidth = P.sel === i ? 4 : 1.5; ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
  }
  ctx.restore();
}
function pzDrawOver() {
  const P = room.pz; ctx.save(); ctx.textAlign = 'center';
  if (P.k === 3 && !P.done) {
    ctx.fillStyle = 'rgba(0,0,0,0.93)'; ctx.beginPath(); ctx.rect(RX0, RY0, RX1 - RX0, RY1 - RY0); ctx.arc(player.x, player.y, 55, 0, 7, true); ctx.fill();
    if (P.light > 0) { ctx.strokeStyle = `rgba(240,240,240,${Math.min(1, P.light)})`; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.setLineDash([10, 8]); ctx.beginPath(); P.path.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); ctx.setLineDash([]); }
    const a = P.path[0], z = P.path[P.path.length - 1]; ctx.strokeStyle = '#eee'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, 16, 0, 7); ctx.stroke(); ctx.fillStyle = '#6fbf73'; ctx.beginPath(); ctx.arc(z.x, z.y, 12, 0, 7); ctx.fill();
  }
  if (P.k === 5 && !P.done) { ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.beginPath(); ctx.rect(RX0, RY0, RX1 - RX0, RY1 - RY0); ctx.moveTo(player.x, player.y); ctx.arc(player.x, player.y, 270, P.dir + 0.45, P.dir - 0.45, true); ctx.closePath(); ctx.fill('evenodd'); ctx.fillStyle = '#aaa'; ctx.font = '14px Georgia'; ctx.fillText(L('pzFound', P.n), RCX, RY0 + 22); }
  if (P.k === 4 && !P.done) { ctx.font = 'bold 28px Georgia'; for (let i = 0; i < P.word.length; i++) { ctx.fillStyle = i < P.got ? '#6fbf73' : '#444'; ctx.fillText(P.word[i], RCX + (i - (P.word.length - 1) / 2) * 30, RY0 + 30); } }
  if (P.k === 6 && P.carry) { ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 16; ctx.fillStyle = '#fff'; const h = 4 + P.flame / 9; ctx.beginPath(); ctx.ellipse(player.x + Math.sin(time * 20) * 1.5, player.y - 52 - h / 2, 4 + P.flame / 40, h, 0, 0, 7); ctx.fill(); ctx.restore(); }
  ctx.restore();
}

// ---------- enemies ----------
const ENEMY = {
  fly: { hp: 4, r: 11, speed: 1.9, score: 1 },
  chaser: { hp: 9, r: 15, speed: 1.35, score: 1 },
  shooter: { hp: 10, r: 15, speed: 0.6, score: 2 },
  splitter: { hp: 16, r: 22, speed: 0.9, score: 2 },
  dasher: { hp: 12, r: 15, speed: 0.5, score: 2 },
  turret: { hp: 18, r: 18, speed: 0, score: 2 },
  ghost: { hp: 9, r: 14, speed: 1.15, score: 2 },
  bomber: { hp: 14, r: 17, speed: 0.9, score: 2 },
  spider: { hp: 10, r: 13, speed: 0, score: 2 },
  sniper: { hp: 11, r: 14, speed: 0.5, score: 2 },
  summoner: { hp: 18, r: 16, speed: 0.7, score: 3 },
  bouncer: { hp: 14, r: 14, speed: 3.0, score: 2 },
};
// Every enemy is an echo of the story. Shown the first time you meet it.
const ENEMY_INFO = {
  chaser: ['Crayon Scribble', 'Someone pressed too hard.'],
  fly: ['Hum', 'Machines that hummed like tired bees.'],
  splitter: ['Ink Blot', 'Spilled, and spilled again.'],
  bouncer: ['Rubber Ball', 'He threw it at her window so she would look out.'],
  shooter: ['Watching Eye', 'Visiting hours are over.'],
  spider: ['Night-light Spider', 'It jumps whenever the hallway light flickers.'],
  ghost: ['Drip Wraith', 'It drips where her bed used to be.'],
  turret: ['Pill Wheel', 'Twice a day, with water. She hated the big one.'],
  dasher: ['Paper Dart', 'Folded from a get-well card.'],
  bomber: ['Raincloud', 'It leaves puddles nobody wipes up.'],
  sniper: ['Night Lamp', 'Someone always kept a light on for her.'],
  summoner: ['Hush', '"Shh. Your sister is sleeping."'],
};
const POOL = ['chaser', 'fly', 'splitter', 'bouncer', 'shooter', 'spider', 'ghost', 'turret', 'dasher', 'bomber', 'sniper', 'summoner'];
const POOL_N = [4, 6, 9, 10, 11, 12];
// Faint scribbled notes on room floors, one line per floor
function makeEnemy(type, x, y, scale = 1, elite = false) {
  const d = ENEMY[type], hpMul = (1 + (floor - 1) * 0.35) * (elite ? 2.2 : 1), rs = elite ? 1.15 : 1;
  return { type, x, y, r: d.r * scale * rs, hp: d.hp * hpMul * scale, maxHp: d.hp * hpMul * scale, speed: d.speed * (1 + (floor - 1) * 0.08) * (elite ? 1.1 : 1), vx: 0, vy: 0, t: rand(0, 2), scale, flash: 0, state: 0, spawn: 0.6, elite };
}
function meetEnemy(type) {
  if (stats.met.has(type) || !ENEMY_INFO[type]) return;
  stats.met.add(type); meets.push({ type, t: 3.2 });
}
function spawnWave(r, opt = {}) {
  const horde = !opt.challenge && Math.random() < 0.15 + floor * 0.02;
  const n = Math.min(14, randi(3, 4) + Math.floor(floor * 1.3) + (horde ? 4 : 0));
  const types = POOL.slice(0, POOL_N[Math.min(floor, 6) - 1]);
  const fresh = types.slice(-2); // the newest types for this floor show up more often
  const eliteP = opt.challenge ? 0.5 : Math.min(0.35, 0.06 * floor);
  for (let i = 0; i < n; i++) {
    let x, y, tries = 0, p;
    do { x = rand(RX0 + 40, RX1 - 40); y = rand(RY0 + 40, RY1 - 40); p = freeSpot(x, y, 24, { noPick: true }); tries++; }
    while (tries < 60 && Math.hypot(p.x - player.x, p.y - player.y) < 230);
    if (Math.hypot(p.x - player.x, p.y - player.y) < 170) continue;
    const type = horde && i % 2 ? 'fly' : Math.random() < 0.35 ? pick(fresh) : pick(types);
    const e = makeEnemy(type, p.x, p.y, 1, Math.random() < eliteP);
    enemies.push(e); meetEnemy(type);
  }
  if (opt.challenge && !opt.wave) { const p = freeSpot(RCX + rand(-200, 200), RY0 + 90, 30, { noPick: true }); const mb = makeEnemy(pick(types.filter((t) => t !== 'fly')), p.x, p.y, 1.7, true); mb.mini = true; enemies.push(mb); }
  if (horde) banner = banner || { text: L('crowded'), sub: '', t: 1.5 };
}
const BOSSES = [
  { name: 'The Cradle Moth', sub: 'It still hums the lullaby', hp: 280, r: 38 },
  { name: 'The Thorn Gardener', sub: 'Every flower, roots and all', hp: 400, r: 42 },
  { name: 'The Night Nurse', sub: 'She only comes when the lights go out', hp: 500, r: 36 },
  { name: 'The Rain Choir', sub: 'Nine days of rain', hp: 620, r: 42 },
  { name: 'The Hollow Toybox', sub: 'Nobody plays with it now', hp: 740, r: 44 },
  { name: 'The Mourning Bell', sub: 'It rings for one', hp: 880, r: 46 },
  { name: 'The Unwritten', sub: 'The dragon you never drew', hp: 1600, r: 50 },
];
function bossIdx() { return floor <= 7 ? floor - 1 : (floor - 1) % 6; }
function bossName() { return BOSS_TXT[lang][bossIdx()][0]; }
function spawnBoss() {
  const k = bossIdx(), B = BOSSES[k], hp = B.hp * 1.5 * (floor > 7 ? 1 + (floor - 7) * 0.5 : 1);
  enemies.push({ type: 'boss', boss: true, kind: k, x: RCX, y: RCY - 70, r: B.r, hp, maxHp: hp, speed: 1.1 + Math.min(floor, 9) * 0.08, vx: 0, vy: 0, t: 0, a: 0, b: 0, c: 0, spin: 0, flash: 0, state: 0, phase: 0, spawn: 1.0, alpha: 1, shots: 0 });
}
const ring = (e, n, spd, off = 0, r = 7, skip) => { for (let i = 0; i < n; i++) if (!skip || !skip(i)) enemyShot(e, off + i * Math.PI * 2 / n, spd, r); };
const fan = (e, ang, n, step, spd, r = 7) => { for (let i = 0; i < n; i++) enemyShot(e, ang + (i - (n - 1) / 2) * step, spd, r); };
const rainDrop = (x, y, vx, vy) => tears.push({ x, y, vx, vy, r: 6, enemy: true, life: 6 });
function minions(e, type, n, cap) {
  if (enemies.filter((x) => !x.boss && !x.dead).length >= cap) return;
  for (let i = 0; i < n; i++) { const p = freeSpot(e.x + rand(-70, 70), e.y + rand(-70, 70), 16, { noPick: true }); enemies.push(makeEnemy(type, p.x, p.y)); }
}
function seek(e, tx, ty, sp, k = 0.05) { const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1, s = Math.min(sp, l / 15); e.vx += (dx / l * s - e.vx) * k; e.vy += (dy / l * s - e.vy) * k; }

function enemyShot(e, ang, spd = 3.6, r = 7) {
  tears.push({ x: e.x, y: e.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r, enemy: true, life: 4 });
}

function updateEnemy(e, dt) {
  e.t += dt; e.flash = Math.max(0, e.flash - dt);
  if (e.spawn > 0) { e.spawn -= dt; return; }
  if (e.slow > 0) e.slow -= dt;
  if (e.poison > 0) { e.poison -= dt; e.hp -= e.poisonDmg * dt * (player.s.frostbite && e.slow > 0 ? 2 : 1); if (Math.random() < 0.1) particles.push({ x: e.x + rand(-e.r, e.r), y: e.y, vx: 0, vy: -1, life: 0.5, max: 0.5, r: 2.5, c: '#888' }); }
  const ang = Math.atan2((player && state !== 'collection' ? player.y : e.y + 10) - e.y, (player && state !== 'collection' ? player.x : e.x) - e.x), d = dist(e, player);
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
    case 'ghost': { // drifts through rocks, fading in and out
      steer(Math.cos(ang + Math.sin(e.t * 1.3) * 0.6), Math.sin(ang + Math.sin(e.t * 1.3) * 0.6), e.speed, 0.04);
      e.alpha = 0.35 + 0.45 * (Math.sin(e.t * 2.2) * 0.5 + 0.5); break;
    }
    case 'bomber': {
      if (!e.dir || e.t > 2) { e.t = 0; e.dir = Math.atan2((player && state !== 'collection' ? player.y : e.y + 10) - e.y, (player && state !== 'collection' ? player.x : e.x) - e.x) + rand(-1.2, 1.2); e.drops = (e.drops || 0) + 1; if (e.drops % 2 === 0) dropPuddle(e.x, e.y, 34); }
      steer(Math.cos(e.dir), Math.sin(e.dir), e.speed, 0.05); break;
    }
    case 'spider': {
      if (e.state === 0) { e.vx = e.vy = 0; if (e.t > 1.3) { e.state = 1; e.t = 0; e.fx = e.x; e.fy = e.y; const p = freeSpot(clamp(player.x, RX0 + 30, RX1 - 30), clamp(player.y, RY0 + 30, RY1 - 30), e.r, { noPick: true }); e.tx = p.x; e.ty = p.y; } }
      else if (e.state === 1) { e.air = e.t < 0.65; const k = Math.min(1, e.t / 0.65); e.x = e.fx + (e.tx - e.fx) * k; e.y = e.fy + (e.ty - e.fy) * k; e.h = Math.sin(k * Math.PI) * 40; e.vx = e.vy = 0;
        if (k >= 1) { e.state = 0; e.t = rand(0, 0.4); e.h = 0; e.air = false; shake = Math.max(shake, 3); if (floor >= 3) ring(e, 6, 2.6, rand(0, 1), 5); } }
      break;
    }
    case 'sniper': {
      if (e.state === 0) { steer(Math.cos(ang + Math.PI / 2), Math.sin(ang + Math.PI / 2), e.speed * Math.sign(Math.sin(e.t * 0.7 + 1)), 0.05); if (e.t > 1.8) { e.state = 1; e.t = 0; } }
      else if (e.state === 1) { e.vx *= 0.8; e.vy *= 0.8; if (e.t < 0.65) e.aim = ang; if (e.t > 0.95) { enemyShot(e, e.aim, 9, 5); sfx.enemyShot(); e.state = 0; e.t = 0; } }
      break;
    }
    case 'summoner': {
      const want = d < 230 ? -1 : d > 340 ? 1 : 0;
      steer(Math.cos(ang) * want + Math.cos(e.t) * 0.3, Math.sin(ang) * want + Math.sin(e.t) * 0.3, e.speed * 1.4, 0.04);
      for (const o of enemies) if (o !== e && !o.boss && o.type !== 'summoner' && dist(o, e) < 230) o.shielded = 0.25;
      if (e.t > 6.5) { e.t = 0; minions(e, 'fly', 2, 10); }
      break;
    }
    case 'bouncer': {
      if (!e.vx && !e.vy) { const a = pick([0.7, 2.4, 3.9, 5.5]); e.vx = Math.cos(a) * e.speed; e.vy = Math.sin(a) * e.speed; }
      const sp = Math.hypot(e.vx, e.vy) || 1, want = Math.min(e.speed * 1.6, e.speed + e.t * 0.05); e.vx = e.vx / sp * want; e.vy = e.vy / sp * want;
      for (const k of room.rocks) if (Math.hypot(e.x - k.x, e.y - k.y) < e.r + k.r) { const nx = (e.x - k.x), ny = (e.y - k.y), l = Math.hypot(nx, ny) || 1, dot = (e.vx * nx + e.vy * ny) / l; if (dot < 0) { e.vx -= 2 * dot * nx / l; e.vy -= 2 * dot * ny / l; } }
      break;
    }
    case 'boss': updateBoss(e, ang, d, dt, steer); break;
  }
  const mf = e.slow > 0 ? 0.5 : 1;
  e.x += e.vx * dt * 60 * mf; e.y += e.vy * dt * 60 * mf;
  collideWalls(e, (e.type === 'dasher' && e.state === 2) || (e.boss && e.charging) || e.type === 'bouncer');
  if (e.shielded > 0) e.shielded -= dt;
  if (e.type !== 'fly' && e.type !== 'ghost' && !e.air) for (const k of room.rocks) pushOut(e, k);
}

function updateBoss(e, ang, d, dt, steer) {
  const en = e.hp < e.maxHp * 0.5;
  if (en && e.phase === 0 && e.kind !== 6) { e.phase = 1; shake = 14; sfx.boss(); burst(e.x, e.y, 40, 1); }
  e.a += dt; e.b += dt; e.c += dt;
  const R = en ? 0.6 : 0.82;
  if (e.pend) { e.pend.t -= dt; if (e.pend.t <= 0) { const q = e.pend; e.pend = null; if (q.ring) ring(e, q.n, q.spd, q.off, q.r); else fan(e, q.ang, q.n, q.step, q.spd, q.r); sfx.enemyShot(); } }
  switch (e.kind) {
    case 0: // Cradle Moth: fluttering figure-eight, aimed spreads, summons flies, enraged dust spiral
      seek(e, RCX + Math.cos(e.t * 0.7) * 260, RCY - 40 + Math.sin(e.t * 1.4) * 90, e.speed * 1.6);
      if (e.a > 1.1 * R) { e.a = 0; fan(e, ang, 3, 0.22, 3.8); sfx.enemyShot(); }
      if (e.b > 4.5) { e.b = 0; minions(e, 'fly', 2, 5); }
      if (en && e.c > 0.12) { e.c = 0; e.spin += 0.55; enemyShot(e, e.spin, 2.8, 6); }
      if (en && e.t % 3 < dt) ring(e, 10, 3, rand(0, 1));
      break;
    case 1: // Thorn Gardener: slow stalk, thorn rings with a gap, vine lines, enraged plants turrets
      steer(Math.cos(ang), Math.sin(ang), e.speed * 0.55, 0.03);
      if (e.a > 2.3 * R) { e.a = 0; const gap = randi(0, 17); ring(e, 18, 2.8, 0, 8, (i) => Math.min(Math.abs(i - gap), 18 - Math.abs(i - gap)) < 2); sfx.enemyShot(); shake = 4; }
      if (e.b > 1.6 * R) { e.b = 0; for (let i = 0; i < 5; i++) enemyShot(e, ang, 2.4 + i * 0.7, 6); sfx.enemyShot(); }
      if (en && e.c > 5) { e.c = 0; minions(e, 'turret', 1, 2); }
      if (en && e.t % 1.3 < dt) fan(e, ang, 3, 0.25, 4.2);
      break;
    case 2: // Night Nurse: fades out, reappears far away, fires aimed bursts; enraged adds rings
      e.vx *= 0.9; e.vy *= 0.9;
      if (e.state === 0) { if (e.a > 1.6 * R) { e.state = 1; e.a = 0; } }
      else if (e.state === 1) {
        e.ghost = true; e.alpha = Math.max(0, 1 - e.a / 0.45);
        if (e.a > 0.5) { let p; for (let i = 0; i < 20; i++) { p = freeSpot(rand(RX0 + 80, RX1 - 80), rand(RY0 + 80, RY1 - 80), e.r, { noPick: true }); if (Math.hypot(p.x - player.x, p.y - player.y) > 220) break; } e.x = p.x; e.y = p.y; e.state = 2; e.a = 0; }
      } else if (e.state === 2) { e.alpha = Math.min(1, e.a / 0.35); if (e.a > 0.4) { e.ghost = false; e.alpha = 1; e.state = 3; e.a = 0; e.shots = 0; ring(e, en ? 16 : 10, 2.6, rand(0, 1)); } }
      else if (e.a > 0.28) { e.a = 0; fan(e, ang, en ? 5 : 3, 0.15, 4.8); sfx.enemyShot(); if (++e.shots >= (en ? 4 : 3)) e.state = 0; }
      break;
    case 3: // Rain Choir: sways along the top wall, rain from above, enraged sideways rain
      seek(e, RCX + Math.sin(e.t * 0.6) * 300, RY0 + 90, e.speed * 1.5);
      if (e.a > (en ? 0.12 : 0.22)) { e.a = 0; rainDrop(rand(RX0 + 15, RX1 - 15), RY0 + 8, rand(-0.4, 0.4), rand(2.4, 3.4)); }
      if (en && e.c > 0.5) { e.c = 0; const left = Math.random() < 0.5; rainDrop(left ? RX0 + 8 : RX1 - 8, rand(RY0 + 30, RY1 - 30), left ? 3 : -3, rand(-0.3, 0.3)); }
      if (e.b > 2.4 * R) { e.b = 0; fan(e, ang, 5, 0.2, 3.8, 8); sfx.enemyShot(); }
      if (en && e.t % 1 < dt) fan(e, ang, 3, 0.12, 5);
      break;
    case 4: // Hollow Toybox: wall-bouncing charges that spill shots, summons splitters
      if (!e.charging) { e.vx *= 0.85; e.vy *= 0.85; if (en && e.a > 0.3 && !e.restShot) { e.restShot = true; ring(e, 14, 2.8, rand(0, 1)); } if (e.a > (en ? 0.55 : 0.9)) { e.charging = true; e.restShot = false; e.a = 0; const sp = en ? 10 : 8.5; e.vx = Math.cos(ang) * sp; e.vy = Math.sin(ang) * sp; } }
      else if (e.a > 2.2) { e.charging = false; e.a = 0; if (Math.random() < 0.6) minions(e, 'splitter', 1, 3); }
      break;
    case 5: { // Mourning Bell: rotating spiral arms with rests, tolling slow rings
      seek(e, RCX + Math.sin(e.t * 0.4) * 120, RCY - 20, e.speed * 0.6);
      if (en && e.c > 2) { e.c = 0; fan(e, ang, 5, 0.18, 4.2, 7); }
      if (e.t % 3.8 < 3 && e.a > 0.09) { e.a = 0; e.spin += 0.13; const arms = en ? 3 : 2; for (let i = 0; i < arms; i++) enemyShot(e, e.spin + i * Math.PI * 2 / arms, 2.9, 6); }
      if (e.b > 3.2 * R) { e.b = 0; ring(e, 28, 2.2, rand(0, 1), 9); shake = 8; sfx.boss(); }
      break;
    }
    case 6: finalBoss(e, ang, steer); break;
  }
}
function finalBoss(e, ang, steer) {
  const f = e.hp / e.maxHp, want = f < 0.34 ? 2 : f < 0.67 ? 1 : 0;
  if (want > e.phase) {
    e.phase = want; e.spawn = 1.2; shake = 18; sfx.boss(); burst(e.x, e.y, 60, 1.5); flash = 0.4;
    tears = tears.filter((t) => !t.enemy);
    banner = want === 1 ? { text: L('p1'), sub: L('p1s'), t: 2.5 } : { text: L('p2'), sub: L('p2s'), t: 2.5 };
    return;
  }
  if (e.phase === 0) { // the mirror: copies you from the other side of the room
    seek(e, 2 * RCX - player.x, 2 * RCY - player.y, e.speed * 2.2, 0.06);
    if (e.a > 0.45) { e.a = 0; enemyShot(e, ang, 4.4, 7); sfx.enemyShot(); }
    if (e.b > 2.6) { e.b = 0; ring(e, 14, 2.6, rand(0, 1), 8); }
    if (e.c > 3.4 && !e.pend) { e.c = 0; e.pend = { t: 0.6, ang, n: 5, step: 0.2, spd: 4.6, r: 8 }; }
  } else if (e.phase === 1) { // echoes of every memory: rain, spirals, flies
    const mode = Math.floor(e.t / 4) % 2;
    steer(Math.cos(ang), Math.sin(ang), e.speed * 0.5, 0.03);
    if (mode === 0 && e.a > 0.13) { e.a = 0; rainDrop(rand(RX0 + 15, RX1 - 15), RY0 + 8, 0, rand(2.6, 3.6)); }
    if (mode === 1 && e.a > 0.09) { e.a = 0; e.spin += 0.21; for (let i = 0; i < 2; i++) enemyShot(e, e.spin + i * Math.PI, 3, 6); }
    if (e.b > 5) { e.b = 0; minions(e, 'fly', 3, 6); }
    if (e.c > 2 && !e.pend) { e.c = 0; e.pend = { t: 0.55, ang, n: 7, step: 0.17, spd: 4.2, r: 8 }; }
  } else { // unravelling: counter-rotating spirals around the centre
    seek(e, RCX, RCY, e.speed, 0.05);
    if (e.a > 0.13) { e.a = 0; e.spin += 0.17; for (let i = 0; i < 2; i++) { enemyShot(e, e.spin + i * Math.PI, 2.7, 6); enemyShot(e, -e.spin * 1.3 + i * Math.PI, 2.2, 5); } }
    if (e.b > 2.2 && !e.pend) { e.b = 0; e.pend = Math.random() < 0.5 ? { t: 0.6, ang, n: 7, step: 0.16, spd: 4.6, r: 8 } : { t: 0.8, ring: true, n: 22, spd: 2.4, off: rand(0, 1), r: 9 }; }
    if (e.c > 0.2) { e.c = 0; rainDrop(rand(RX0 + 15, RX1 - 15), RY0 + 8, 0, rand(2.2, 2.8)); }
  }
}

function collideWalls(o, bounce) {
  const r = o.r, vx = o.vx, vy = o.vy, sh = shake;
  if (o.x < RX0 + r) { o.x = RX0 + r; if (bounce) { o.vx *= -1; shake = 5; } }
  if (o.x > RX1 - r) { o.x = RX1 - r; if (bounce) { o.vx *= -1; shake = 5; } }
  if (o.y < RY0 + r) { o.y = RY0 + r; if (bounce) { o.vy *= -1; shake = 5; } }
  if (o.y > RY1 - r) { o.y = RY1 - r; if (bounce) { o.vy *= -1; shake = 5; } }
  if (o.type === 'bouncer') shake = sh;
  if (bounce && o.boss && (o.vx !== vx || o.vy !== vy)) { ring(o, 8, 3, rand(0, 1)); sfx.enemyShot(); }
}
function pushOut(o, k) {
  const dx = o.x - k.x, dy = o.y - k.y, d = Math.hypot(dx, dy) || 1, m = o.r + k.r;
  if (d < m) { o.x = k.x + dx / d * m; o.y = k.y + dy / d * m; }
}

function dropPuddle(x, y, r) { if (room.puddles.length < 10) room.puddles.push({ x, y, r, life: 9, max: 9 }); }
function damageEnemy(e, dmg, kx, ky) {
  const kb = player.s.knock;
  if (e.shielded > 0) dmg *= 0.35;
  if (player.s.oneShot) dmg = e.boss && e.kind === 6 && e.phase < 2 ? Math.max(0, e.hp - e.maxHp * (e.phase === 0 ? 0.66 : 0.33)) + 1 : e.hp + 1;
  e.hp -= dmg; e.flash = 0.1; e.x += kx * (e.boss ? 0.3 : 3 * kb); e.y += ky * (e.boss ? 0.3 : 3 * kb);
  sfx.hit(); burst(e.x, e.y, 4, 0.6);
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; stats.kills++; colAdd(e.boss ? 'b' : 'e', e.boss ? String(e.kind) : e.type); sfx.kill(); shake = Math.max(shake, e.boss ? 20 : 4);
  burst(e.x, e.y, e.boss ? 80 : 16, e.boss ? 2 : 1);
  splats.push({ x: e.x, y: e.y, r: e.r * rand(1.2, 1.8), room, rot: rand(0, 6) });
  if (e.type === 'bomber') dropPuddle(e.x, e.y, 46);
  if (e.boss || e.mini || Math.random() < (e.elite ? 0.9 : 0.28)) { const n = e.boss ? 5 : e.mini || e.elite ? 2 : 1; for (let i = 0; i < n; i++) { const p = freeSpot(e.x + rand(-20, 20), e.y + rand(-20, 20), 8); pickups.push({ kind: 'drop', x: p.x, y: p.y, r: 8 }); } }
  if (e.type === 'splitter' && e.scale > 0.55) for (let i = 0; i < 2; i++) { const c = makeEnemy('splitter', e.x + rand(-10, 10), e.y + rand(-10, 10), e.scale * 0.6); c.spawn = 0; c.vx = rand(-4, 4); c.vy = rand(-4, 4); enemies.push(c); }
  const s = player.s;
  if (s.leech && !e.boss && ++player.leechN >= Math.ceil(14 / s.leech)) { player.leechN = 0; if (player.hp < player.maxHp) { player.hp++; floatText(L('half'), player.x, player.y - 24); } }
  if (s.explode && !e.boss) { burst(e.x, e.y, 14, 1.4); for (const o of enemies) if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 80 + o.r) damageEnemy(o, s.dmg * 1.5, 0, 0); }
  if (e.boss) {
    enemies.forEach((o) => { if (!o.dead && o !== e) { o.dead = true; burst(o.x, o.y, 10, 1); } });
    tears = tears.filter((t) => !t.enemy);
    if (e.kind === 6 && floor === 7) { endTimer = 2.2; banner = { text: L('inkStill'), sub: '', t: 2.2 }; return; }
    const ip = freeSpot(RCX - 90, RCY, 18); pickups.push(makeItemPickup(ip.x, ip.y));
    const tp = freeSpot(RCX + 90, RCY, 26); pickups.push({ kind: 'trapdoor', x: tp.x, y: tp.y, r: 26 });
    banner = { text: L('bossDefeated'), sub: L('takeItem'), t: 2.5 };
  }
}

// ---------- particles ----------
let splats = [], splitTears = [];
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
  const base = Math.atan2(dy, dx); player.aim = base; player.aimT = time;
  const dmg = s.dmg * (s.fullHp && player.hp >= player.maxHp ? 1.5 : 1);
  const fire = (a) => { const crit = Math.random() < s.crit; tears.push({ x: player.x, y: player.y, vx: Math.cos(a) * s.shotSpeed + player.vx * 0.3, vy: Math.sin(a) * s.shotSpeed + player.vy * 0.3, r: s.size * (crit ? 1.4 : 1), dmg: dmg * (crit ? 2.5 : 1), crit, travel: 0, range: s.range, pierce: s.pierce, homing: s.homing, spectral: s.spectral, bounces: s.bounce ? 2 : 0, wavy: s.wavy, wt: 0, split: s.split, hit: new Set() }); };
  for (let i = 0; i < s.multi; i++) fire(base + (i - (s.multi - 1) / 2) * 0.16);
  if (s.back) { if (s.backMulti) for (let i = 0; i < s.multi; i++) fire(base + Math.PI + (i - (s.multi - 1) / 2) * 0.16); else fire(base + Math.PI); }
  sfx.shoot();
}

function hurtPlayer(amount = 1) {
  if (player.inv > 0) return;
  if (player.shieldUp) { player.shieldUp = false; player.inv = 1; burst(player.x, player.y, 20, 1); sfx.hit(); floatText(L('blocked'), player.x, player.y - 30); return; }
  player.hp -= amount; player.inv = 1.1; shake = 10; sfx.hurt(); burst(player.x, player.y, 14, 1);
  if (player.hp <= 0) { player.hp = 0; state = 'dead'; stats.end = performance.now(); sfx.boss(); }
}

function updatePlayer(dt) {
  let mx = 0, my = 0;
  if (keys.has('a')) mx--; if (keys.has('d')) mx++;
  if (keys.has('w')) my--; if (keys.has('s')) my++;
  const inPud = room.puddles.some((q) => Math.hypot(player.x - q.x, player.y - q.y) < q.r);
  const l = Math.hypot(mx, my) || 1, sp = player.s.speed * (inPud && !player.s.noPuddle ? 0.55 : 1) * (floor === 5 && !stats.won ? 0.85 : 1);
  player.vx += (mx / l * sp - player.vx) * 0.22; player.vy += (my / l * sp - player.vy) * 0.22;
  player.x += player.vx * dt * 60; player.y += player.vy * dt * 60;
  if (mx > 0) player.face = 1; else if (mx < 0) player.face = -1;
  // doors: allow walking through an open doorway into the neighbour room
  const open = room.cleared;
  for (const [dir, nb] of Object.entries(room.n)) {
    const d = doorPos(dir);
    const inGap = dir === 'n' || dir === 's' ? Math.abs(player.x - d.x) < DOOR - player.r * 0.3 : Math.abs(player.y - d.y) < DOOR - player.r * 0.3;
    if (!open || !inGap || doorHidden(dir)) continue;
    if ((dir === 'n' && player.y < RY0 + 4) || (dir === 's' && player.y > RY1 - 4) || (dir === 'w' && player.x < RX0 + 4) || (dir === 'e' && player.x > RX1 - 4)) { sfx.door(); enterRoom(nb, OPP[dir]); return; }
    // let the player step into the door gap
    if (dir === 'n' && player.y < RY0 + player.r) { player.y = Math.max(player.y, RY0 - 2); continue; }
  }
  const inDoorGap = (dir) => {
    if (!open || !room.n[dir] || doorHidden(dir)) return false;
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
  if (room.rocks.some((k) => Math.hypot(player.x - k.x, player.y - k.y) < k.r + player.r - 2)) { const p = freeSpot(player.x, player.y, player.r, { noPick: true }); player.x = p.x; player.y = p.y; }
  player.cool -= dt * 60; player.inv = Math.max(0, player.inv - dt);
  for (const q of room.puddles) q.life -= dt; room.puddles = room.puddles.filter((q) => q.life > 0);
  shoot();
}

// ---------- main update ----------
function updateHelpers(dt) {
  const s = player.s;
  // orbitals
  player.orbs.length = s.orbitals;
  for (let i = 0; i < s.orbitals; i++) {
    const a = time * 2.6 + i * Math.PI * 2 / s.orbitals, o = player.orbs[i] = { x: player.x + Math.cos(a) * 46, y: player.y + Math.sin(a) * 46, r: 8 };
    for (const e of enemies) if (!e.dead && e.spawn <= 0 && !e.ghost && dist(o, e) < o.r + e.r) { e.hp -= 9 * s.orbDmg * dt; e.flash = 0.05; }
    for (const t of tears) if (t.enemy && dist(o, t) < o.r + t.r) t.dead = true;
  }
  // familiars
  while (player.fams.length < s.familiars) player.fams.push({ x: player.x, y: player.y, cool: 30 });
  let lead = player;
  for (const f of player.fams) {
    const dx = lead.x - f.x, dy = lead.y - f.y, l = Math.hypot(dx, dy);
    if (l > 30) { f.x += dx / l * (l - 30) * 0.15; f.y += dy / l * (l - 30) * 0.15; }
    lead = f; f.cool -= dt * 60;
    if (f.cool <= 0) {
      let best = null, bd = 420; for (const e of enemies) { const d = dist(f, e); if (!e.dead && !e.ghost && e.spawn <= 0 && d < bd) { bd = d; best = e; } }
      if (best) { f.cool = 40; const a = Math.atan2(best.y - f.y, best.x - f.x); tears.push({ x: f.x, y: f.y, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, r: 4, dmg: 2 + s.dmg * 0.3 + s.famDmg, travel: 0, range: 420, hit: new Set(), bounces: 0 }); }
    }
  }
  // aura
  if (s.aura) for (const e of enemies) if (!e.dead && e.spawn <= 0 && !e.ghost && dist(e, player) < 75 + e.r) e.hp -= s.aura * dt;
  for (const e of enemies) if (e.hp <= 0 && !e.dead) killEnemy(e);
}

function update(dt) {
  time += dt;
  flash = Math.max(0, flash - dt * 2);
  if (state === 'cutscene') { updateCut(dt); return; }
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (meets.length && state === 'play') { meets[0].t -= dt; if (meets[0].t <= 0) meets.shift(); }
  fade = Math.max(0, fade - dt * 4);
  shake = Math.max(0, shake - dt * 40);
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  particles = particles.filter((p) => p.life > 0);
  if (state !== 'play') return;

  if (endTimer > 0) { endTimer -= dt; if (endTimer <= 0) { stats.end = performance.now(); stats.won = true; playCut('ending', () => { state = 'end'; }); return; } }
  updatePlayer(dt);
  if (state !== 'play') return;
  if (room.thorns && room.thorns.some((k) => Math.hypot(player.x - k.x, player.y - k.y) < k.r + player.r - 8)) hurtPlayer(1);
  if (room.pz && !room.pz.done) pzUpdate(dt);
  if (floor >= 2 && !stats.won && Math.random() < 0.03 + Math.min(7, floor) * 0.015) particles.push({ x: player.x + player.face * 4 + pick([-7, 7]), y: player.y - 4, vx: rand(-0.2, 0.2), vy: 1.5, life: 0.6, max: 0.6, r: floor >= 4 ? 3 : 2.2, c: '#fff' });
  for (const e of enemies) {
    updateEnemy(e, dt);
    if (e.spawn <= 0 && !e.ghost && !e.air && dist(e, player) < e.r + player.r - 3) hurtPlayer(e.boss && floor > 2 ? 2 : 1);
  }
  for (const t of tears) {
    if (t.homing && !t.enemy) {
      let best = null, bd = 260;
      for (const e of enemies) { const d = dist(t, e); if (!e.dead && d < bd && !t.hit.has(e)) { bd = d; best = e; } }
      if (best) { const sp = Math.hypot(t.vx, t.vy), a = Math.atan2(best.y - t.y, best.x - t.x), ca = Math.atan2(t.vy, t.vx); let da = a - ca; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; const na = ca + clamp(da, -0.12, 0.12); t.vx = Math.cos(na) * sp; t.vy = Math.sin(na) * sp; }
    }
    t.x += t.vx * dt * 60; t.y += t.vy * dt * 60;
    if (!t.enemy && room.pz && !room.pz.done && pzTear(t)) { t.dead = true; continue; }
    if (t.wavy) { t.wt += dt; const l = Math.hypot(t.vx, t.vy) || 1, w = Math.cos(t.wt * 14) * 2.2; t.x += -t.vy / l * w; t.y += t.vx / l * w; }
    if (t.enemy) {
      t.life -= dt;
      if (dist(t, player) < t.r + player.r - 4) { t.dead = true; hurtPlayer(1); }
    } else {
      t.travel += Math.hypot(t.vx, t.vy) * dt * 60;
      if (t.travel > t.range) t.dead = true;
      for (const e of enemies) {
        if (e.dead || e.spawn > 0 || e.ghost || t.hit.has(e)) continue;
        if (dist(t, e) < t.r + e.r) {
          const l = Math.hypot(t.vx, t.vy) || 1, s = player.s;
          if (s.slow) e.slow = Math.max(e.slow || 0, s.slow);
          if (s.poison) { e.poison = 3; e.poisonDmg = s.poison; }
          if (t.crit) floatText(L('crit'), e.x, e.y - e.r - 6);
          damageEnemy(e, t.dmg, t.vx / l, t.vy / l); t.hit.add(e);
          if (t.split) { const a = Math.atan2(t.vy, t.vx); for (const da of [-0.7, 0.7]) splitTears.push({ x: t.x, y: t.y, vx: Math.cos(a + da) * l, vy: Math.sin(a + da) * l, r: t.r * 0.6, dmg: t.dmg * 0.5, travel: 0, range: 160, hit: new Set(t.hit), bounces: 0 }); }
          if (!t.pierce) { t.dead = true; break; }
        }
      }
    }
    if (!t.enemy && !t.dead) for (const dir of Object.keys(room.n)) if (doorHidden(dir)) { const dp = doorPos(dir); if (Math.hypot(t.x - dp.x, t.y - dp.y) < 34) { t.dead = true; const nb = room.n[dir]; nb.crack++; shake = 3; sfx.hit(); burst(dp.x, dp.y, 8, 0.8); if (nb.crack >= 3) { nb.hidden = false; nb.seen = true; sfx.secret(); shake = 10; burst(dp.x, dp.y, 30, 1.4); } } }
    if (!t.enemy && t.bounces > 0 && !t.dead) {
      if (t.x < RX0 || t.x > RX1) { t.vx *= -1; t.x = clamp(t.x, RX0, RX1); t.bounces--; }
      if (t.y < RY0 || t.y > RY1) { t.vy *= -1; t.y = clamp(t.y, RY0, RY1); t.bounces--; }
    }
    if (t.x < RX0 - 1 || t.x > RX1 + 1 || t.y < RY0 - 1 || t.y > RY1 + 1 || (t.enemy && t.life <= 0)) t.dead = true;
    if (!t.spectral) for (const k of room.rocks) if (Math.hypot(t.x - k.x, t.y - k.y) < k.r + t.r * 0.5) t.dead = true;
    if (t.dead) burst(t.x, t.y, 4, 0.5);
  }
  tears = tears.filter((t) => !t.dead);
  if (splitTears.length) { tears.push(...splitTears); splitTears = []; }
  updateHelpers(dt);
  tears = tears.filter((t) => !t.dead);
  enemies = enemies.filter((e) => !e.dead);

  if (!room.cleared && enemies.length === 0 && room.wavesLeft > 0) {
    room.wavesLeft--; spawnWave(room, { challenge: room.type === 'challenge', wave: true }); banner = { text: L('wave'), sub: '', t: 1.3 }; sfx.boss();
  }
  if (!room.cleared && enemies.length === 0) {
    room.cleared = true; sfx.door(); shake = 3;
    if (room.type === 'challenge') { const p = freeSpot(RCX, RCY, 18); pickups.push(makeItemPickup(p.x, p.y)); banner = { text: L('trialDone'), sub: '', t: 1.8 }; }
    if (room.type === 'normal' && Math.random() < 0.3 + (player.hp < player.maxHp / 2 ? 0.2 : 0)) { const p = freeSpot(RCX, RCY, 12); pickups.push({ kind: 'heart', x: p.x, y: p.y, r: 12, bob: 0 }); }
    if (player.s.regen && Math.random() < player.s.regen && player.hp < player.maxHp) { player.hp++; floatText(L('half'), player.x, player.y - 24); }
  }
  for (const p of pickups) {
    if (p.warn > 0) p.warn -= dt;
    if (dist(p, player) > p.r + player.r) continue;
    if (p.kind === 'drop') { player.drops++; p.taken = true; audio.tone(1200, 0.06, 'sine', 0.05); continue; }
    if (p.kind === 'heart' && player.hp >= player.maxHp) continue;
    if (p.price) { if (player.drops < p.price) { if (!(p.warn > 0)) { p.warn = 1.5; floatText(L('need', p.price), p.x, p.y - 30); } continue; } player.drops -= p.price; p.price = 0; }
    if (p.trade) { if (player.maxHp <= 2) { if (!(p.warn > 0)) { p.warn = 1.5; floatText(L('noHeart'), p.x, p.y - 30); } continue; } player.maxHp -= 2; player.hp = Math.min(player.hp, player.maxHp); sfx.hurt(); p.trade = false; }
    if (p.kind === 'heart' && player.hp < player.maxHp) { player.hp = Math.min(player.maxHp, player.hp + 2); p.taken = true; sfx.heart(); floatText(L('heart'), p.x, p.y); }
    else if (p.kind === 'item') {
      p.item.apply(player.s, player); player.items.push(p.item); stats.items++; p.taken = true; sfx.item(); burst(p.x, p.y, 30, 1.3);
      banner = { text: itemName(p.item), sub: itemDesc(p.item), fl: itemFl(p.item), t: 3 }; colAdd('i', p.item.id); checkSynergies();
    } else if (p.kind === 'trapdoor') { sfx.door(); const f = floor; pickups = room.pickups = pickups.filter((o) => !o.taken); if (f <= 6) playCut('f' + f, nextFloor); else nextFloor(); return; }
  }
  pickups = room.pickups = pickups.filter((p) => !p.taken);
  for (const f of floatTexts) { f.y -= dt * 30; f.t -= dt; }
  floatTexts = floatTexts.filter((f) => f.t > 0);
}
function floatText(text, x, y) { floatTexts.push({ text, x, y, t: 1 }); }

function debugBoss(n) {
  floor = n - 1; nextFloor();
  const b = map.rooms.find((r) => r.type === 'boss');
  for (const r of map.rooms) r.seen = true;
  enterRoom(b, null); player.x = RCX; player.y = RY1 - 60;
}

// ---------- story ----------

function cutMotif(id, i) { const m = CUT_M[id]; if (typeof m === 'string') return m; let r = m['0']; for (const k of Object.keys(m)) if (i >= +k) r = m[k]; return r; }
function playCut(id, after) { cut = { id, m: cutMotif(id, 0), i: 0, chars: 0, t: 0, after, get lines() { return CUTS_TXT[lang][id]; } }; state = 'cutscene'; keys.clear(); mouse.down = false; }
function updateCut(dt) {
  cut.t += dt; const L = cut.lines[cut.i], before = Math.floor(cut.chars);
  cut.chars = Math.min(L.length, cut.chars + dt * 38);
  if (Math.floor(cut.chars) !== before && L[before] !== ' ' && before % 2 === 0) sfx.type();
}
function advanceCut() {
  if (!cut) return;
  if (cut.chars < cut.lines[cut.i].length) { cut.chars = cut.lines[cut.i].length; return; }
  if (++cut.i >= cut.lines.length) endCut(); else { cut.chars = 0; const m = cutMotif(cut.id, cut.i); if (m !== cut.m) { cut.m = m; cut.t = 0; } }
}
function endCut() { const f = cut && cut.after; cut = null; state = 'play'; keys.clear(); if (f) f(); }

function child(x, y, s = 1, dark = false) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = dark ? '#000' : '#e8e8e8'; if (dark) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 12; } ctx.beginPath(); ctx.moveTo(-16, 40); ctx.lineTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(16, 40); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -14, 15, 0, 7); ctx.fill(); ctx.strokeStyle = dark ? '#ccc' : '#000'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
function drawMotif(m, t) {
  ctx.save(); ctx.globalAlpha = Math.min(1, t / 1.2); ctx.translate(W / 2, 210);
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 3; ctx.fillStyle = '#0a0a0a';
  const sw = Math.sin(t * 1.5);
  switch (m) {
    case 'pool': ctx.beginPath(); ctx.ellipse(60, 70, 120 + sw * 4, 26, 0, 0, 7); ctx.fillStyle = '#000'; ctx.fill(); ctx.stroke(); child(-90, 20); break;
    case 'cradle': ctx.save(); ctx.rotate(sw * 0.12); ctx.beginPath(); ctx.arc(0, 0, 80, 0.15, Math.PI - 0.15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(80, 0); ctx.stroke(); ctx.restore(); ctx.beginPath(); ctx.moveTo(-60, 85); ctx.quadraticCurveTo(0, 105, 60, 85); ctx.stroke(); break;
    case 'jar': ctx.strokeRect(-45, -10, 90, 100); ctx.beginPath(); ctx.moveTo(-45, -10); ctx.lineTo(-35, -25); ctx.lineTo(35, -25); ctx.lineTo(45, -10); ctx.stroke(); for (let i = 0; i < 4; i++) { const x = -27 + i * 18; ctx.beginPath(); ctx.moveTo(x, 90); ctx.quadraticCurveTo(x + sw * 4, 40, x + 6, 10 + i * 6); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 6, 6 + i * 6, 6, 0, 7); ctx.fillStyle = '#666'; ctx.fill(); } break;
    case 'corridor': for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 220, -80); ctx.lineTo(s * 30, -20); ctx.lineTo(s * 30, 30); ctx.lineTo(s * 220, 100); ctx.stroke(); } ctx.strokeRect(-30, -20, 60, 50); ctx.globalAlpha *= 0.4 + 0.3 * Math.abs(sw); ctx.fillStyle = '#fff'; ctx.fillRect(-26, -16, 52, 42); break;
    case 'window': ctx.strokeRect(-90, -70, 180, 160); ctx.beginPath(); ctx.moveTo(0, -70); ctx.lineTo(0, 90); ctx.moveTo(-90, 10); ctx.lineTo(90, 10); ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#888'; for (let i = 0; i < 24; i++) { const x = -85 + (i * 37) % 170, y = -70 + ((i * 53 + t * 140) % 160); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 10); ctx.stroke(); } child(0, 150, 0.7); break;
    case 'chair': ctx.beginPath(); ctx.moveTo(-140, 30); ctx.lineTo(140, 30); ctx.moveTo(-120, 30); ctx.lineTo(-120, 100); ctx.moveTo(120, 30); ctx.lineTo(120, 100); ctx.stroke(); for (const x of [-90, -30, 30, 90]) { ctx.beginPath(); ctx.ellipse(x, 22, 16, 5, 0, 0, 7); ctx.stroke(); } ctx.strokeRect(170, -30, 40, 60); ctx.beginPath(); ctx.moveTo(170, 30); ctx.lineTo(170, 100); ctx.moveTo(210, 30); ctx.lineTo(210, 100); ctx.stroke(); break;
    case 'candle': ctx.strokeRect(-14, 0, 28, 90); ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.ellipse(sw * 2, -14, 7, 16 + sw * 2, 0, 0, 7); ctx.fill(); ctx.restore(); break;
    case 'mask': inkCircle(0, 20, 80, '#000', '#eee', 3, 0.15, t); for (const s of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(s * 28, 5, 9, 14, 0, 0, 7); ctx.fill(); } ctx.beginPath(); ctx.moveTo(-25, 60); ctx.quadraticCurveTo(0, 45, 25, 60); ctx.stroke(); break;
    case 'theo': { const fadeOut = cut && cut.i >= 9 ? Math.max(0, 1 - cut.t / 2) : 1; child(-70, 20, 1); ctx.save(); ctx.globalAlpha *= fadeOut; child(60, 42, 0.65, true); ctx.fillStyle = '#e8e8e8'; ctx.save(); ctx.translate(18, 40); ctx.rotate(-0.15 + sw * 0.03); ctx.fillRect(-16, -12, 32, 24); ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-10, 6); ctx.quadraticCurveTo(-2, -8, 4, 2); ctx.lineTo(10, -6); ctx.stroke(); ctx.restore(); ctx.restore(); break; }
    case 'sky': { drawRide(70, -60, 0.9); ctx.beginPath(); ctx.moveTo(-260, 90); ctx.lineTo(260, 90); ctx.stroke(); const k = Math.min(1, t / 6); ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { if (k < i / 4) break; const x = -180 + i * 120, y = -40 + (i % 2) * 30; ctx.beginPath(); ctx.arc(x, y, 22, Math.PI, 0); ctx.arc(x + 30, y, 16, Math.PI, 0); ctx.stroke(); } ctx.beginPath(); ctx.arc(170, -70, 26, 0, Math.PI * 2 * k); ctx.stroke(); child(-200, 50, 0.8); ctx.beginPath(); ctx.moveTo(-185, 52); ctx.lineTo(-150, 20 - sw * 6); ctx.stroke(); break; }
    case 'ada': { const n = cut && /^f\d$/.test(cut.id) ? +cut.id[1] + 1 : 1; ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.strokeRect(-150, -120, 300, 240); drawAda(0, 30, n, 3.4, { ay: 0.3 }); break; }
    case 'blank': case 'notepage': case 'ride': {
      ctx.save(); ctx.rotate(-0.03); ctx.fillStyle = '#e9e9e4'; ctx.fillRect(-170, -110, 340, 220); ctx.strokeStyle = '#b8b8b8'; ctx.lineWidth = 1; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(-160, -80 + i * 26); ctx.lineTo(160, -80 + i * 26); ctx.stroke(); } ctx.restore();
      if (m === 'notepage') { ctx.strokeStyle = '#222'; ctx.lineWidth = 2; const k = Math.min(1, t / 2.5); ctx.beginPath(); for (let x = -130; x < -130 + 220 * k; x += 6) ctx.lineTo(x, 60 + Math.sin(x * 0.7) * 4); ctx.stroke(); }
      if (m === 'ride') { ctx.globalAlpha = Math.min(1, t / 2); drawRide(0, 10, 1.3, t / 2); }
      break;
    }
    case 'dragon': ctx.fillStyle = '#e8e8e8'; ctx.save(); ctx.rotate(-0.05); ctx.fillRect(-120, -60, 240, 160); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-80, 50); ctx.quadraticCurveTo(-40, -10, 0, 30); ctx.quadraticCurveTo(40, 70, 70, 0); ctx.lineTo(90, -20); ctx.lineTo(75, 10); ctx.stroke(); for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-60 + i * 25, 20 - Math.sin(i) * 10); ctx.lineTo(-52 + i * 25, 5 - Math.sin(i) * 10); ctx.lineTo(-44 + i * 25, 22 - Math.sin(i) * 10); ctx.stroke(); } ctx.beginPath(); ctx.arc(78, -6, 3, 0, 7); ctx.fillStyle = '#111'; ctx.fill(); ctx.restore(); break;
  }
  ctx.restore();
}
function wrapText(text, maxW) {
  const words = text.split(' '), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}
function fitFont(text, maxW, size, style = '', family = 'Georgia') { let s = size; ctx.font = `${style} ${s}px ${family}, "Times New Roman", serif`; while (s > 10 && ctx.measureText(text).width > maxW) { s--; ctx.font = `${style} ${s}px ${family}, "Times New Roman", serif`; } }
function drawCut() {
  ctx.drawImage(grain, 0, 0); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  drawMotif(cut.m, cut.t);
  ctx.textAlign = 'center'; ctx.font = 'italic 21px Georgia, "Times New Roman", serif';
  let y = 392; const rows = [];
  for (let i = Math.max(0, cut.i - 1); i <= cut.i; i++) {
    const full = cut.lines[i], shown = i < cut.i ? full : full.slice(0, Math.floor(cut.chars));
    let used = 0; for (const ln of wrapText(full, 860)) { rows.push({ t: shown.slice(used, used + ln.length), c: i < cut.i ? '#6a6a6a' : '#f0f0f0' }); used += ln.length + 1; }
  }
  for (const r of rows.slice(-5)) { ctx.fillStyle = r.c; ctx.fillText(r.t, W / 2, y); y += 32; }
  ctx.font = '13px Georgia, "Times New Roman", serif'; ctx.fillStyle = '#666';
  ctx.fillText(L('cutHint'), W / 2, H - 28);
}


// ---------- title menu and collection ----------
let menuSel = 0, colSec = 0, colSel = 0;
const col = (() => { try { return Object.assign({ e: {}, b: {}, i: {} }, JSON.parse(localStorage.getItem('ink-col') || '{}')); } catch (err) { return { e: {}, b: {}, i: {} }; } })();
let colDirty = 0;
function colAdd(sec, key) { col[sec][key] = (col[sec][key] || 0) + 1; colDirty = 1; }
setInterval(() => { if (colDirty) { colDirty = 0; try { localStorage.setItem('ink-col', JSON.stringify(col)); } catch (err) {} } }, 1000);
addEventListener('beforeunload', () => { try { localStorage.setItem('ink-col', JSON.stringify(col)); } catch (err) {} });
const MENU = ['mStart', 'mCol', 'mLang'];
function menuDo(i) {
  if (i === 0) newRun();
  else if (i === 1) { state = 'collection'; colSel = 0; }
  else setLang(lang === 'en' ? 'ru' : 'en');
}
function menuRowY(i) { return H / 2 + 20 + i * 44; }
function drawTitle() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
  ctx.fillStyle = '#f2f2f2'; fitFont(L('title'), W - 60, 56, 'bold'); ctx.fillText(L('title'), W / 2, H / 2 - 110);
  ctx.fillStyle = '#9a9a9a'; ctx.font = 'italic 18px Georgia, "Times New Roman", serif'; ctx.fillText(L('subtitle'), W / 2, H / 2 - 70);
  MENU.forEach((k, i) => { const y = menuRowY(i), on = i === menuSel; ctx.font = (on ? 'bold ' : '') + '24px Georgia, "Times New Roman", serif'; ctx.fillStyle = on ? '#fff' : '#777'; ctx.fillText((on ? '›  ' : '') + L(k) + (on ? '  ‹' : ''), W / 2, y); });
  ctx.fillStyle = '#5a5a5a'; fitFont(L('menuHint'), W - 60, 13); ctx.fillText(L('menuHint'), W / 2, H - 40);
}
function menuClick(p) { for (let i = 0; i < MENU.length; i++) if (Math.abs(p.y - (menuRowY(i) - 8)) < 20 && Math.abs(p.x - W / 2) < 220) { menuSel = i; menuDo(i); return; } }
function colEntries() {
  if (colSec === 0) return POOL.map((t) => ({ kind: 'e', key: t, n: col.e[t] || 0 })).concat(BOSSES.map((b, i) => ({ kind: 'b', key: String(i), n: col.b[i] || 0 })));
  const list = ITEMS.map((it) => ({ kind: 'i', key: it.id, it, n: col.i[it.id] || 0 }));
  for (const it of [SECRET, STROKE]) if (col.i[it.id]) list.push({ kind: 'i', key: it.id, it, n: col.i[it.id] });
  return list;
}
const COLS = 7, CELL = 62, GX = 40, GY = 150;
function colPct(sec) { const s = colSec; colSec = sec; const l = colEntries().filter((x) => !(x.it && (x.it === SECRET || x.it === STROKE))); colSec = s; return Math.round(100 * l.filter((x) => x.n > 0).length / l.length); }
function drawIcon(en, x, y, sz) {
  ctx.save(); ctx.translate(x, y);
  if (!en.n) { inkCircle(0, 0, sz * 0.36, '#0a0a0a', '#3a3a3a', 2, 0.12, 1); ctx.fillStyle = '#555'; ctx.font = `bold ${Math.round(sz * 0.4)}px Georgia`; ctx.textAlign = 'center'; ctx.fillText('?', 0, sz * 0.14); ctx.restore(); return; }
  if (en.kind === 'i') { ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; inkCircle(0, 0, sz * 0.3, '#fff', '#000', 2, 0.15, 3); ctx.restore(); ctx.fillStyle = '#000'; ctx.font = `bold ${Math.round(sz * 0.32)}px Georgia`; ctx.textAlign = 'center'; ctx.fillText(itemName(en.it)[0], 0, sz * 0.11); ctx.restore(); return; }
  const isB = en.kind === 'b', d = isB ? { r: BOSSES[+en.key].r } : ENEMY[en.key], e = { type: isB ? 'boss' : en.key, boss: isB, kind: isB ? +en.key : 0, x: 0, y: 0, r: d.r, t: time, flash: 0, spawn: 0, state: 0, alpha: 1, phase: 0, scale: 1, hp: 1, maxHp: 1, h: 0 };
  const sc = Math.min(1, sz * 0.3 / (d.r * (isB ? 1.5 : 1.2))); ctx.scale(sc, sc); drawEnemy(e); ctx.restore(); ctx.globalAlpha = 1;
}
function drawCollection() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center';
  ctx.fillStyle = '#f2f2f2'; ctx.font = 'bold 34px Georgia, "Times New Roman", serif'; ctx.fillText(L('colTitle'), W / 2, 56);
  [L('colEnemies'), L('colItems')].forEach((t, i) => { const x = W / 2 + (i ? 130 : -130); ctx.font = (i === colSec ? 'bold ' : '') + '19px Georgia, "Times New Roman", serif'; ctx.fillStyle = i === colSec ? '#fff' : '#666'; ctx.fillText(`${t}  ·  ${L('complete', colPct(i))}`, x, 100); if (i === colSec) { ctx.fillRect(x - 110, 108, 220, 2); } });
  const list = colEntries(); colSel = clamp(colSel, 0, list.length - 1);
  list.forEach((en, i) => { const cx = GX + (i % COLS) * CELL + CELL / 2, cy = GY + Math.floor(i / COLS) * CELL + CELL / 2; ctx.strokeStyle = i === colSel ? '#fff' : '#2a2a2a'; ctx.lineWidth = i === colSel ? 2 : 1; ctx.strokeRect(cx - CELL / 2 + 3, cy - CELL / 2 + 3, CELL - 6, CELL - 6); drawIcon(en, cx, cy, CELL); });
  const en = list[colSel], px = GX + COLS * CELL + 30, pw = W - px - 30; ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(px, GY, pw, 380);
  drawIcon(en, px + pw / 2, GY + 70, 110);
  ctx.textAlign = 'center'; let y = GY + 160;
  const put = (t, size, style, color) => { ctx.fillStyle = color; ctx.font = `${style} ${size}px Georgia`; for (const ln of wrapText(t, pw - 30)) { ctx.fillText(ln, px + pw / 2, y); y += size + 8; } y += 6; };
  if (!en.n) { put(L('locked'), 22, 'bold', '#777'); put(L('lockedHint'), 15, 'italic', '#555'); }
  else if (en.kind === 'i') { put(itemName(en.it), 22, 'bold', '#fff'); put(itemDesc(en.it), 15, '', '#bbb'); put(itemFl(en.it), 15, 'italic', '#888'); put(L('picked', en.n), 14, '', '#666'); }
  else if (en.kind === 'b') { put(BOSS_TXT[lang][+en.key][0], 22, 'bold', '#fff'); put(L('boss') + ' · ' + BOSS_TXT[lang][+en.key][1], 15, '', '#bbb'); put(BOSS_FL[lang][+en.key], 15, 'italic', '#888'); put(L('killed', en.n), 14, '', '#666'); }
  else { put(enemyName(en.key), 22, 'bold', '#fff'); put(enemyFl(en.key), 15, 'italic', '#888'); put(L('killed', en.n), 14, '', '#666'); }
  ctx.fillStyle = '#5a5a5a'; fitFont(L('colHint'), W - 60, 13); ctx.textAlign = 'center'; ctx.fillText(L('colHint'), W / 2, H - 24);
}
function colKey(k) {
  const n = colEntries().length;
  if (k === 'escape' || k === 'backspace') { state = 'title'; return; }
  if (k === 'tab' || k === 'q' || k === 'e') { colSec = 1 - colSec; colSel = 0; return; }
  if (k === 'arrowleft' || k === 'a') colSel = Math.max(0, colSel - 1);
  if (k === 'arrowright' || k === 'd') colSel = Math.min(n - 1, colSel + 1);
  if (k === 'arrowup' || k === 'w') colSel = Math.max(0, colSel - COLS);
  if (k === 'arrowdown' || k === 's') colSel = Math.min(n - 1, colSel + COLS);
}
function colClick(p) {
  if (p.y > 80 && p.y < 115) { const s = p.x < W / 2 ? 0 : 1; if (s !== colSec) { colSec = s; colSel = 0; } return; }
  const i = Math.floor((p.x - GX) / CELL), j = Math.floor((p.y - GY) / CELL);
  if (i >= 0 && i < COLS && j >= 0) { const idx = j * COLS + i; if (idx < colEntries().length) colSel = idx; }
}

function onPress(k) {
  audio.init();
  if (k === 'm') { audio.muted = !audio.muted; localStorage.setItem('ink-muted', audio.muted ? '1' : '0'); return; }
  if (state === 'title') {
    cv.focus();
    if (k === 'arrowup' || k === 'w') menuSel = (menuSel + MENU.length - 1) % MENU.length;
    else if (k === 'arrowdown' || k === 's') menuSel = (menuSel + 1) % MENU.length;
    else if (k === 'enter' || k === ' ') menuDo(menuSel);
    else if (k === 'l') setLang(lang === 'en' ? 'ru' : 'en');
    return;
  }
  if (state === 'collection') return colKey(k);
  if (state === 'cutscene') { if (k === 'escape') endCut(); else if (k === 'enter' || k === ' ') advanceCut(); return; }
  if (state === 'end') { if (k === 'c') { state = 'play'; nextFloor(); } else if (k === 'enter' || k === ' ' || k === 'r') newRun(); return; }
  if (state === 'dead' && (k === 'enter' || k === ' ' || k === 'r')) return newRun();
  if (DEBUG && state === 'play') { if (k >= '1' && k <= '7') return debugBoss(+k); if (k === 'k') return enemies.forEach((e) => killEnemy(e)); }
  if (k === 'escape' || k === 'p') { if (state === 'play') state = 'pause'; else if (state === 'pause') state = 'play'; return; }
  if (state === 'pause' && k === 'r') return newRun();
  if (state === 'pause' && k === 'l') setLang(lang === 'en' ? 'ru' : 'en');
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
  if (room.note !== undefined) { ctx.save(); ctx.translate(RCX + 150, RY1 - 40); ctx.rotate(-0.04); ctx.font = 'italic 15px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(230,230,230,0.22)'; ctx.font = 'italic 16px "Comic Sans MS", "Segoe Print", cursive'; ctx.fillText(NOTES_TXT[lang][room.note], 0, 0); ctx.restore(); }
  for (const q of room.puddles) { ctx.globalAlpha = Math.min(1, q.life / 1.5) * 0.85; inkCircle(q.x, q.y, q.r, '#000', '#3a3a3a', 1.5, 0.12, q.x); ctx.globalAlpha = 1; }
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
    if (doorHidden(dir)) { ctx.save(); ctx.translate(d.x, d.y); if (!horiz) ctx.rotate(Math.PI / 2); ctx.strokeStyle = `rgba(200,200,200,${0.35 + nb.crack * 0.15})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-18, -8); ctx.lineTo(-4, 2); ctx.lineTo(-10, 12); ctx.moveTo(-4, 2); ctx.lineTo(10, -4); ctx.lineTo(20, 6); if (nb.crack > 0) { ctx.moveTo(10, -4); ctx.lineTo(14, -14); ctx.moveTo(-10, 12); ctx.lineTo(2, 18); } ctx.stroke(); ctx.restore(); continue; }
    ctx.save(); ctx.translate(d.x, d.y); if (!horiz) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#000'; ctx.fillRect(-DOOR, -22, DOOR * 2, 44);
    ctx.strokeStyle = nb.type === 'boss' ? '#fff' : '#bbb'; ctx.lineWidth = nb.type === 'boss' ? 5 : 3;
    ctx.strokeRect(-DOOR, -22, DOOR * 2, 44);
    if (!room.cleared) { ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-DOOR + 4, -18, DOOR * 2 - 8, 36); ctx.strokeStyle = '#888'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 14, -18); ctx.lineTo(i * 14, 18); ctx.stroke(); } }
    if (nb.type === 'boss') { ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.fillText('☠', 0, 6); }
    if (nb.type === 'challenge') { ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.fillText('✦', 0, 6); }
    if (nb.type === 'treasure') { ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.fillText('♛', 0, 6); }
    ctx.restore();
  }
  for (const k of room.rocks) { inkCircle(k.x, k.y + 4, k.r, '#000', null); inkCircle(k.x, k.y, k.r, '#4a4a4a', '#cfcfcf', 2, 0.12, k.x); ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(k.x - k.r * 0.4, k.y - k.r * 0.2); ctx.lineTo(k.x + k.r * 0.1, k.y + k.r * 0.3); ctx.stroke(); }
  if (room.thorns) for (const k of room.thorns) { ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 2; for (let i = 0; i < 9; i++) { const a = i * 0.7 + k.x; ctx.beginPath(); ctx.moveTo(k.x + Math.cos(a) * 6, k.y + Math.sin(a) * 6); ctx.lineTo(k.x + Math.cos(a) * k.r, k.y + Math.sin(a) * k.r * 0.7); ctx.stroke(); } inkCircle(k.x, k.y, 7, '#000', '#aaa', 1.5, 0.2, k.y); }
  if (room.pz) pzDraw();
  if (room.type === 'shop') { const x = RCX, y = RCY - 80, b = Math.sin(time * 2) * 2; inkCircle(x, y + 14 + b, 20, '#d0d0d0', '#000', 2.5, 0.05, 1); inkCircle(x, y - 12 + b, 16, '#e4e4e4', '#000', 2.5, 0.04, 2); for (const s of [-1, 1]) { ctx.save(); ctx.translate(x + s * 8, y - 36 + b); ctx.rotate(s * 0.25 + Math.sin(time * 1.5) * 0.05 * s); ctx.fillStyle = '#e4e4e4'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 16, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x + s * 6, y - 13 + b, 3.5, 0, 7); ctx.fill(); ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + s * 4, y - 13 + b); ctx.lineTo(x + s * 8, y - 13 + b); ctx.stroke(); } ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 5, y + 8 + b); ctx.lineTo(x + 5, y + 20 + b); ctx.stroke(); }
  if (room.type === 'trade') { ctx.fillStyle = '#151515'; ctx.fillRect(RCX - 40, RCY + 30, 80, 26); ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.strokeRect(RCX - 40, RCY + 30, 80, 26); }
  if (room.type === 'start' && floor === 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '20px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center';
    ctx.fillText(L('tut1'), RCX, RCY - 110); ctx.fillText(L('tut2'), RCX, RCY - 80); ctx.fillText(L('tut3'), RCX, RCY + 110);
  }
}

function drawPickups() {
  for (const p of pickups) {
    const bob = Math.sin(time * 3 + (p.bob || 0)) * 4;
    if (p.kind === 'item') {
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(p.x - 22, p.y + 8, 44, 18); ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.strokeRect(p.x - 22, p.y + 8, 44, 18);
      ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 18; inkCircle(p.x, p.y - 10 + bob, 13, '#fff', '#000', 2, 0.15, 3); ctx.restore();
      ctx.fillStyle = '#000'; ctx.font = 'bold 15px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.fillText(itemName(p.item)[0], p.x, p.y - 5 + bob);
    } else if (p.kind === 'heart') drawHeart(p.x, p.y + bob, 12, 1);
    else if (p.kind === 'drop') { ctx.save(); ctx.translate(p.x, p.y + bob * 0.5); ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(7, 2, 0, 7); ctx.quadraticCurveTo(-7, 2, 0, -8); ctx.fillStyle = '#000'; ctx.fill(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
    if (p.price) { ctx.fillStyle = '#ccc'; ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('◆ ' + p.price, p.x, p.y + 42); }
    if (p.trade) { drawHeart(p.x - 10, p.y + 44, 7, 0); ctx.fillStyle = '#ccc'; ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'left'; ctx.fillText('−1', p.x, p.y + 49); }
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
  ctx.globalAlpha = clamp(a, 0.15, 1) * (e.alpha === undefined ? 1 : Math.max(0.05, e.alpha));
  const body = e.flash > 0 ? '#fff' : '#0a0a0a', line = '#e6e6e6';
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.9, e.r * 0.9, e.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  const eyes = (sp = 0.35, er = 0.18) => { const tg = player && state !== 'collection' ? player : { x: e.x, y: e.y + 10 }, ang = Math.atan2(tg.y - e.y, tg.x - e.x); for (const s of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x + s * e.r * sp + Math.cos(ang) * 2, e.y - e.r * 0.15 + Math.sin(ang) * 2, e.r * er, 0, 7); ctx.fill(); } };
  switch (e.type) {
    case 'fly': {
      const w = Math.sin(time * 40) * 6; ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(e.x - 9, e.y - 6, 8, 4 + w * 0.3, -0.5, 0, 7); ctx.ellipse(e.x + 9, e.y - 6, 8, 4 - w * 0.3, 0.5, 0, 7); ctx.stroke();
      inkCircle(e.x, e.y, e.r, body, line, 2, 0.1, e.t); eyes(0.35, 0.2); break;
    }
    case 'chaser': inkCircle(e.x, e.y, e.r, body, line, 2.5, 0.12, e.t); eyes(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y + e.r * 0.35, e.r * 0.35, 0.2, Math.PI - 0.2); ctx.stroke(); break;
    case 'shooter': inkCircle(e.x, e.y, e.r, body, line, 2.5, 0.05, e.t); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; { const ang = Math.atan2((player && state !== 'collection' ? player.y : e.y + 10) - e.y, (player && state !== 'collection' ? player.x : e.x) - e.x); ctx.beginPath(); ctx.arc(e.x + Math.cos(ang) * 4, e.y + Math.sin(ang) * 4, e.r * 0.25, 0, 7); ctx.fill(); } break;
    case 'splitter': inkCircle(e.x, e.y, e.r, body, line, 2.5, 0.22, e.t * 3); eyes(0.3, 0.14); break;
    case 'dasher': {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.state ? e.aim : Math.atan2((player && state !== 'collection' ? player.y : e.y + 10) - e.y, (player && state !== 'collection' ? player.x : e.x) - e.x));
      ctx.beginPath(); ctx.moveTo(e.r * 1.3, 0); ctx.lineTo(-e.r, -e.r); ctx.lineTo(-e.r * 0.5, 0); ctx.lineTo(-e.r, e.r); ctx.closePath();
      ctx.fillStyle = e.state === 1 ? (Math.floor(time * 20) % 2 ? '#fff' : '#000') : body; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); break;
    }
    case 'turret': {
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(time);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? e.r * 0.6 : e.r; ctx.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } ctx.closePath();
      ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = line; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
      ctx.fillStyle = e.t > 2 ? '#fff' : '#666'; ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, 7); ctx.fill(); break;
    }
    case 'ghost': {
      ctx.beginPath(); ctx.arc(e.x, e.y - 3, e.r, Math.PI, 0); for (let i = 0; i <= 4; i++) ctx.lineTo(e.x + e.r - i * e.r / 2, e.y + e.r + (i % 2 ? -5 : 2) + Math.sin(time * 6 + i) * 2); ctx.closePath();
      ctx.fillStyle = e.flash > 0 ? '#fff' : 'rgba(215,215,215,0.85)'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = '#999'; ctx.beginPath(); ctx.moveTo(e.x, e.y - e.r - 2); ctx.lineTo(e.x, e.y - e.r - 14); ctx.stroke();
      for (const s of [-1, 1]) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(e.x + s * 5, e.y - 4, 2.5, 4, 0, 0, 7); ctx.fill(); } break;
    }
    case 'bomber': {
      inkCircle(e.x - e.r * 0.5, e.y + 2, e.r * 0.6, body, line, 2, 0.1, 1); inkCircle(e.x + e.r * 0.5, e.y + 2, e.r * 0.6, body, line, 2, 0.1, 2); inkCircle(e.x, e.y - e.r * 0.25, e.r * 0.75, body, line, 2.5, 0.1, e.t);
      ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(e.x + i * 8, e.y + e.r * 0.7); ctx.lineTo(e.x + i * 8 - 2, e.y + e.r * 0.7 + 6 + Math.sin(time * 8 + i) * 3); ctx.stroke(); }
      eyes(0.3, 0.13); break;
    }
    case 'spider': {
      const h = e.h || 0; if (e.state === 1) { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.tx, e.ty, e.r + 6, 0, 7); ctx.stroke(); }
      ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.6, w = Math.sin(time * 12 + i) * 2; ctx.beginPath(); ctx.moveTo(e.x, e.y - h); ctx.quadraticCurveTo(e.x + s * e.r * 1.2, e.y - h + a * e.r - 8, e.x + s * e.r * 1.8, e.y - h + a * e.r + w + 6); ctx.stroke(); }
      inkCircle(e.x, e.y - h, e.r, body, line, 2.5, 0.06, e.t); ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(e.x - 6 + i * 4, e.y - h - 3, 1.8, 0, 7); ctx.fill(); } break;
    }
    case 'sniper': {
      if (e.state === 1) { const lock = e.t > 0.65; ctx.strokeStyle = `rgba(255,255,255,${lock ? 0.75 : 0.18 + e.t * 0.3})`; ctx.lineWidth = lock ? 2 : 1; ctx.setLineDash(lock ? [] : [8, 6]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.aim) * 1200, e.y + Math.sin(e.aim) * 1200); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = body; ctx.strokeStyle = line; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(e.x - e.r, e.y + e.r); ctx.lineTo(e.x - e.r * 0.5, e.y - e.r * 0.4); ctx.lineTo(e.x + e.r * 0.5, e.y - e.r * 0.4); ctx.lineTo(e.x + e.r, e.y + e.r); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = e.state === 1 ? 16 : 4; ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(e.x, e.y - e.r * 0.6, e.r * 0.45, 0, 7); ctx.fill(); ctx.restore(); break;
    }
    case 'summoner': {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, 230, 0, 7); ctx.stroke();
      ctx.fillStyle = body; ctx.strokeStyle = line; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(e.x, e.y - e.r * 1.4); ctx.quadraticCurveTo(e.x + e.r * 1.2, e.y, e.x + e.r, e.y + e.r); ctx.lineTo(e.x - e.r, e.y + e.r); ctx.quadraticCurveTo(e.x - e.r * 1.2, e.y, e.x, e.y - e.r * 1.4); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e.x - 6, e.y - 2); ctx.lineTo(e.x + 6, e.y - 2); ctx.stroke();
      for (let i = 0; i < 3; i++) { const a = time * 2 + i * 2.1; ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * e.r * 1.6, e.y + Math.sin(a) * e.r * 1.6, 2.5, 0, 7); ctx.fill(); } break;
    }
    case 'bouncer': {
      inkCircle(e.x, e.y, e.r, body, line, 2.5, 0.03, 0); ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(time * 6); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.6, -0.6, 0.6); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, e.r * 0.6, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke(); ctx.restore(); break;
    }
    case 'boss': {
      drawBoss(e, body);
      if (e.kind === 4) { const ang = Math.atan2((player && state !== 'collection' ? player.y : e.y + 10) - e.y, (player && state !== 'collection' ? player.x : e.x) - e.x); for (const s of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x + s * 14 + Math.cos(ang) * 3, e.y + Math.sin(ang) * 3, 6, 0, 7); ctx.fill(); } }
      else { eyes(0.33, 0.15); if (e.kind === 6 && e.phase) for (let i = 0; i < e.phase * 2; i++) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x + Math.cos(i * 2.4 + time) * e.r * 0.55, e.y + Math.sin(i * 2.4 + time) * e.r * 0.55, 4, 0, 7); ctx.fill(); } }
      break;
    }
  }
  if (e.elite) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y - (e.h || 0), e.r + 6 + Math.sin(time * 5) * 1.5, 0, 7); ctx.stroke(); }
  if (e.shielded > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  if (!e.boss && e.hp < e.maxHp && e.spawn <= 0) { ctx.fillStyle = '#333'; ctx.fillRect(e.x - 14, e.y - e.r - 10, 28, 3); ctx.fillStyle = '#ddd'; ctx.fillRect(e.x - 14, e.y - e.r - 10, 28 * e.hp / e.maxHp, 3); }
  ctx.globalAlpha = 1;
}

function drawBoss(e, body) {
  if (e.pend) { const q = e.pend, k = 1 - q.t / 0.8; ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.15 + k * 0.5})`; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
    if (q.ring) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 20 + k * 40, 0, 7); ctx.stroke(); }
    else for (let i = 0; i < q.n; i++) { const a = q.ang + (i - (q.n - 1) / 2) * q.step; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * 320, e.y + Math.sin(a) * 320); ctx.stroke(); }
    ctx.restore(); }
  const pulse = 1 + Math.sin(time * 4) * 0.04, r = e.r;
  switch (e.kind) {
    case 0: { const f = Math.sin(time * 14) * 0.5; for (const s of [-1, 1]) { ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, 1); ctx.rotate(-0.3 + f * 0.4); ctx.beginPath(); ctx.ellipse(r * 0.9, -r * 0.2, r * 1.1, r * 0.6, 0.3, 0, 7); ctx.fillStyle = '#1c1c1c'; ctx.fill(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.beginPath(); ctx.arc(r * 0.9, -r * 0.2, r * 0.25, 0, 7); ctx.strokeStyle = '#888'; ctx.stroke(); ctx.restore(); } inkCircle(e.x, e.y, r * 0.65 * pulse, body, '#fff', 3, 0.1, e.t); break; }
    case 1: { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(time * 0.5); ctx.beginPath(); for (let i = 0; i < 24; i++) { const rr = i % 2 ? r * 1.35 : r * 0.95, a = i * Math.PI / 12; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = '#161616'; ctx.fill(); ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); inkCircle(e.x, e.y, r * 0.85, body, '#fff', 3, 0.12, e.t); break; }
    case 2: { ctx.fillStyle = body; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x - r * 0.8, e.y + r); ctx.lineTo(e.x - r * 0.5, e.y - r * 0.4); ctx.arc(e.x, e.y - r * 0.4, r * 0.5, Math.PI, 0); ctx.lineTo(e.x + r * 0.8, e.y + r); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(e.x - 3, e.y - r * 1.2, 6, 16); ctx.fillRect(e.x - 8, e.y - r * 1.2 + 5, 16, 6); break; }
    case 3: { ctx.strokeStyle = '#777'; ctx.lineWidth = 1.5; for (let i = 0; i < 7; i++) { const x = e.x - r + i * r / 3; ctx.beginPath(); ctx.moveTo(x, e.y + r * 0.4); ctx.lineTo(x - 2, e.y + r * 0.9 + Math.sin(time * 6 + i) * 8); ctx.stroke(); } inkCircle(e.x - r * 0.6, e.y + 4, r * 0.6, body, '#ddd', 2.5, 0.1, 1); inkCircle(e.x + r * 0.6, e.y + 4, r * 0.6, body, '#ddd', 2.5, 0.1, 2); inkCircle(e.x, e.y - r * 0.2, r * 0.8 * pulse, body, '#fff', 3, 0.1, e.t); break; }
    case 4: { ctx.fillStyle = body; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.fillRect(e.x - r, e.y - r * 0.7, r * 2, r * 1.6); ctx.strokeRect(e.x - r, e.y - r * 0.7, r * 2, r * 1.6); ctx.save(); ctx.translate(e.x - r, e.y - r * 0.7); ctx.rotate(-0.3 - Math.abs(Math.sin(time * 3)) * 0.4); ctx.fillStyle = '#222'; ctx.fillRect(0, -10, r * 2, 10); ctx.strokeRect(0, -10, r * 2, 10); ctx.restore(); break; }
    case 5: { ctx.save(); ctx.translate(e.x, e.y - r * 0.7); ctx.rotate(Math.sin(time * 2) * 0.15); ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.quadraticCurveTo(-r * 0.5, r * 0.9, -r * 1.1, r * 1.4); ctx.lineTo(r * 1.1, r * 1.4); ctx.quadraticCurveTo(r * 0.5, r * 0.9, r * 0.4, 0); ctx.arc(0, 0, r * 0.4, 0, Math.PI, true); ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.arc(Math.sin(time * 2.6) * r * 0.4, r * 1.55, r * 0.22, 0, 7); ctx.fill(); ctx.restore(); break; }
    case 6: { ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 10 + e.phase * 10; inkCircle(e.x, e.y, r * pulse, body, '#fff', 4, 0.18 + e.phase * 0.08, e.t); ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 3 + e.phase * 2; i++) { const s = time * (i % 2 ? 1 : -1) + i; ctx.beginPath(); ctx.arc(e.x, e.y, r * (1.2 + i * 0.18), s, s + Math.PI * 1.2); ctx.stroke(); } break; }
  }
}

function drawHelpers() {
  for (const o of player.orbs) if (o) { inkCircle(o.x, o.y, o.r, '#f0f0f0', '#000', 2, 0.15, 5); }
  for (const f of player.fams) { inkCircle(f.x, f.y, 9, '#050505', '#ccc', 2, 0.1, 7); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(f.x, f.y - 1, 2.5, 0, 7); ctx.fill(); }
  if (player.s.aura) { ctx.strokeStyle = `rgba(255,255,255,${0.08 + Math.sin(time * 3) * 0.03})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(player.x, player.y, 75, 0, 7); ctx.stroke(); }
  if (player.shieldUp) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(player.x, player.y - 2, 24, 0, 7); ctx.stroke(); }
}

// Ada's look changes per floor: f2+ tear streaks, f4 soaked hair, f5 hunched, f6 veil, f7 glowing cracks; after the win a green scarf and a smile
function drawAda(x, y, f, sc, o = {}) {
  const ax = o.ax || 0, ay = o.ay || 0, won = !!o.won, hunch = f >= 5 && !won;
  ctx.save(); ctx.translate(x, y - (o.bob || 0)); ctx.scale(sc, sc);
  const hx = hunch ? ax * 2 : 0, H0 = hunch ? -3 : -10, wet = f >= 4 && !won;
  if (f >= 6 && !won) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(hx - 23, 21); ctx.quadraticCurveTo(hx - 27, H0 - 25, hx, H0 - 25); ctx.quadraticCurveTo(hx + 27, H0 - 25, hx + 23, 21); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#eee'; ctx.lineWidth = 1.6; ctx.stroke(); }
  ctx.fillStyle = wet ? '#a8a8a8' : '#d4d4d4'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5; ctx.beginPath();
  if (hunch) { ctx.moveTo(-13, 18); ctx.quadraticCurveTo(-14, 2, 0, 0); ctx.quadraticCurveTo(14, 2, 13, 18); } else { ctx.moveTo(-11, 18); ctx.lineTo(-7, -2); ctx.lineTo(7, -2); ctx.lineTo(11, 18); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(hx, H0, 15, 0, 7); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke(); ctx.fillStyle = wet ? '#e2e2e2' : '#fafafa'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#000'; ctx.stroke();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx, H0 - 3, 15, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(hx, H0 - 9, hx - 14, H0 - 6); ctx.fill();
  if (wet) { ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.4; for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + k * 13, H0 - 6); ctx.quadraticCurveTo(hx + k * 18, H0 + 6, hx + k * 14, H0 + 17); ctx.stroke(); ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.arc(hx + k * 14, H0 + 19 + ((time * 1.3 + k) % 1) * 6, 1.5, 0, 7); ctx.fill(); } }
  if (ay >= 0) {
    const ey = H0 + 1 + ay * 2 + (hunch ? 2 : 0);
    for (const k of [-1, 1]) {
      const ex = hx + k * 5.5 + ax * 3;
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ex, ey, 3, hunch ? 2.4 : 4.5, 0, 0, 7); ctx.fill();
      if (won || f < 2) continue;
      const len = f === 2 ? 7 : f === 3 ? 12 : 17;
      ctx.beginPath(); ctx.moveTo(ex, ey + 3); ctx.quadraticCurveTo(ex + k * 1.5, ey + 3 + len / 2, ex, ey + 3 + len);
      ctx.strokeStyle = '#000'; ctx.lineWidth = f >= 4 ? 4.6 : 3.6; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = f >= 4 ? 2.6 : 1.8; ctx.stroke();
      const dp = (time * 1.6 + k * 0.5) % 1; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(ex, ey + 4 + len + dp * 9, f >= 4 ? 2.4 : 1.9, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.6; ctx.beginPath(); const mx = hx + ax * 3;
    if (won) ctx.arc(mx, H0 + 5, 4.5, 0.25, Math.PI - 0.25); else { const my = H0 + 9 + (hunch ? 2 : 0), d = f >= 3 ? 1.5 : 0; ctx.moveTo(mx - 3, my + d); ctx.quadraticCurveTo(mx, my - d * 1.5, mx + 3, my + d); }
    ctx.stroke();
  }
  if (f >= 6 && !won) { ctx.fillStyle = 'rgba(0,0,0,0.94)'; ctx.beginPath(); ctx.moveTo(hx - 19, H0 + 7); ctx.quadraticCurveTo(hx - 20, H0 - 23, hx, H0 - 22); ctx.quadraticCurveTo(hx + 20, H0 - 23, hx + 19, H0 + 7); ctx.quadraticCurveTo(hx + 12, H0 - 8, hx, H0 - 8); ctx.quadraticCurveTo(hx - 12, H0 - 8, hx - 19, H0 + 7); ctx.fill(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.2; ctx.stroke(); }
  if (f >= 7 && !won) { ctx.save(); ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - 3, H0 - 15); ctx.lineTo(hx + 1, H0 - 9); ctx.lineTo(hx - 4, H0 - 4); ctx.moveTo(hx + 11, H0 - 4); ctx.lineTo(hx + 7, H0 + 2); ctx.lineTo(hx + 10, H0 + 6); ctx.moveTo(6, 3); ctx.lineTo(2, 9); ctx.lineTo(6, 15); ctx.moveTo(-8, 6); ctx.lineTo(-4, 12); ctx.lineTo(-7, 17); ctx.stroke(); ctx.restore(); }
  if (won) { ctx.strokeStyle = '#6fbf73'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-9, 1); ctx.quadraticCurveTo(0, 5, 9, 1); ctx.lineTo(12, 10); ctx.stroke(); }
  ctx.restore();
}
function drawRide(x, y, s, k = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round';
  ctx.strokeStyle = '#6fbf73'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-90, 10); ctx.quadraticCurveTo(-40, 30 + Math.sin(time * 2) * 4, 20, 10); ctx.quadraticCurveTo(60, -5, 80, -30); ctx.stroke();
  ctx.beginPath(); ctx.arc(88, -36, 11, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-90, 10); ctx.lineTo(-110, 0); ctx.stroke();
  const wf = Math.sin(time * 3) * 12; ctx.beginPath(); ctx.moveTo(-10, 12); ctx.lineTo(-30, -40 - wf); ctx.lineTo(20, 4); ctx.stroke();
  if (k > 0.3) { child(-30, -22, 0.45); child(0, -18, 0.38); }
  ctx.restore();
}
function drawPlayer() {
  if (player.inv > 0 && Math.floor(player.inv * 15) % 2) return;
  const p = player, f = stats.won ? 0 : Math.min(7, floor), bob = Math.abs(Math.sin(time * (f >= 5 ? 7 : 10))) * (Math.hypot(p.vx, p.vy) > 0.5 ? 2 : 0);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 22, 16, 5, 0, 0, 7); ctx.fill();
  let ax = p.face, ay = 0;
  if (keys.has('arrowup')) { ax = 0; ay = -1; } else if (keys.has('arrowdown')) { ax = 0; ay = 1; }
  drawAda(p.x, p.y - 2, f, 1.3, { bob, ax, ay, won: stats.won });
}

function drawTears() {
  const tf = stats.won ? 1 : Math.min(7, floor), sh = 240 - (tf - 1) * 17, tearShade = `rgb(${sh},${sh},${sh})`, tearScale = 1 + (tf - 1) * 0.04, tearLw = 1.5 + (tf - 1) * 0.35;
  for (const t of tears) {
    if (t.enemy) { inkCircle(t.x, t.y, t.r, '#000', '#fff', 2, 0.1, t.x); }
    else { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(t.x, t.y + 10, t.r * 0.8, 0, 7); ctx.fill(); ctx.fillStyle = t.spectral ? 'rgba(255,255,255,0.55)' : tearShade; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * tearScale, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = tearLw; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.3, 0, 7); ctx.fill(); }
  }
}

function drawHUD() {
  ctx.fillStyle = '#060606'; ctx.fillRect(0, 0, W, HUD); ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(0, HUD - 0.5); ctx.lineTo(W, HUD - 0.5); ctx.stroke();
  for (let i = 0; i < player.maxHp / 2; i++) { const v = player.hp - i * 2; drawHeart(24 + i * 26, 22, 10, v >= 2 ? 1 : v === 1 ? 0.5 : 0); }
  const s = player.s; ctx.fillStyle = '#9a9a9a'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
  ctx.fillText(L('hud', s), 16, 50);
  ctx.fillStyle = '#ddd'; ctx.font = 'bold 16px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.fillText(L('FLOOR', floor), W / 2, 26);
  ctx.font = '11px Georgia, "Times New Roman", serif'; ctx.fillStyle = '#777'; { const t = player.items.map(itemName).slice(-3).join(' · ') || L('noItems'); fitFont(t, 420, 11); ctx.fillText(t, W / 2, 46); }
  if (audio.muted) { ctx.fillStyle = '#666'; ctx.textAlign = 'left'; ctx.fillText(L('muted'), W / 2 + 80, 26); }
  ctx.fillStyle = '#ccc'; ctx.font = 'bold 14px Georgia, serif'; ctx.textAlign = 'left'; ctx.fillText('◆ ' + player.drops, Math.max(24 + player.maxHp / 2 * 26, 120) + 10, 27);
  drawMinimap();
  const boss = enemies.find((e) => e.boss);
  if (boss) { const bw = 360; ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - bw / 2, H - 34, bw, 12); ctx.fillStyle = '#eee'; ctx.fillRect(W / 2 - bw / 2, H - 34, bw * Math.max(0, boss.hp) / boss.maxHp, 12); ctx.strokeStyle = '#888'; ctx.strokeRect(W / 2 - bw / 2, H - 34, bw, 12); ctx.fillStyle = '#bbb'; ctx.font = '12px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.fillText(bossName(), W / 2, H - 40); }
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
    if (r.type !== 'normal' && r.type !== 'start') { ctx.fillStyle = r === room ? '#000' : '#fff'; ctx.font = '9px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.fillText({ boss: '☠', challenge: '✦', treasure: '♛', shop: '◆', memory: '○', puzzle: 'i', trade: '♥', secret: '?' }[r.type] || '', x + c / 2, y + c * 0.62); }
  }
  void ox;
}

function drawCenterText(title, lines, alpha = 0.78) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#f2f2f2'; fitFont(title, W - 60, 56, 'bold'); ctx.fillText(title, W / 2, H / 2 - 70);
  ctx.font = '18px Georgia, "Times New Roman", serif'; ctx.fillStyle = '#aaa';
  lines.forEach((l, i) => { fitFont(l, W - 60, 18); ctx.fillStyle = '#aaa'; ctx.fillText(l, W / 2, H / 2 - 10 + i * 30); });
}

function render() {
  ctx.save();
  if (shake > 0) ctx.translate(rand(-shake, shake) * 0.5, rand(-shake, shake) * 0.5);
  if (state === 'title' || state === 'collection') {
    ctx.drawImage(grain, 0, 0);
    for (let i = 0; i < 6; i++) inkCircle(W / 2 + Math.cos(time * 0.3 + i) * 300, H / 2 + Math.sin(time * 0.4 + i * 2) * 180, 30 + i * 6, 'rgba(0,0,0,0.6)', '#333', 2, 0.2, i);
    ctx.restore();
    if (state === 'title') drawTitle(); else drawCollection();
    return;
  }
  if (state === 'cutscene') { ctx.restore(); drawCut(); return; }
  drawRoom(); drawPickups();
  for (const e of enemies) drawEnemy(e);
  drawPlayer(); drawHelpers(); drawTears();
  for (const p of particles) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ddd'; ctx.font = '14px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center';
  for (const f of floatTexts) { ctx.globalAlpha = f.t; ctx.fillText(f.text, f.x, f.y); } ctx.globalAlpha = 1;
  if (room.pz) pzDrawOver();
  if (floor === 3 && !stats.won && !(room.pz && room.pz.k === 3 && !room.pz.done)) { const fl = Math.sin(time * 13) * Math.sin(time * 3.1) > 0.7 ? 0.82 : room.type === 'boss' ? 0.3 : 0.5; const g = ctx.createRadialGradient(player.x, player.y, 90, player.x, player.y, 330); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${fl})`); ctx.fillStyle = g; ctx.fillRect(0, HUD, W, H - HUD); }
  if (floor === 4 && !stats.won) { ctx.strokeStyle = 'rgba(200,200,200,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 40; i++) { const x = (i * 97 + time * 60) % W, y = HUD + (i * 131 + time * 520) % (H - HUD); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); } ctx.stroke(); }
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, HUD, W, H - HUD); }
  ctx.restore();
  drawHUD();
  if (banner) { ctx.globalAlpha = Math.min(1, banner.t); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, H / 2 - 150, W, banner.fl ? 100 : 74); if (banner.fl) { fitFont(banner.fl, W - 40, 14, 'italic'); ctx.fillStyle = '#7a7a7a'; ctx.textAlign = 'center'; ctx.fillText(banner.fl, W / 2, H / 2 - 62); } ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; fitFont(banner.text, W - 40, 30, 'bold'); ctx.fillText(banner.text, W / 2, H / 2 - 112); fitFont(banner.sub, W - 40, 16, 'italic'); ctx.fillStyle = '#aaa'; ctx.fillText(banner.sub, W / 2, H / 2 - 88); ctx.globalAlpha = 1; }
  if (meets.length) { const m = meets[0], nm = enemyName(m.type), fl = enemyFl(m.type); ctx.globalAlpha = Math.min(1, m.t * 2); ctx.textAlign = 'left'; ctx.font = 'italic 13px Georgia, "Times New Roman", serif'; const bw = Math.min(W - 2 * RX0 - 12, Math.max(260, ctx.measureText(fl).width + 24)); ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(RX0 + 6, RY1 - 54, bw, 46); ctx.fillStyle = '#eee'; ctx.font = 'bold 15px Georgia, "Times New Roman", serif'; ctx.fillText(nm, RX0 + 16, RY1 - 34); ctx.fillStyle = '#8a8a8a'; fitFont(fl, bw - 20, 13, 'italic'); ctx.fillText(fl, RX0 + 16, RY1 - 16); ctx.globalAlpha = 1; }
  if (state === 'pause') drawCenterText(L('paused'), [L('pauseHint'), '', L('items') + (player.items.map(itemName).join(', ') || L('none'))]);
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
  if (state === 'end') {
    const secs = Math.round(((stats.end || performance.now()) - stats.start) / 1000);
    drawCenterText(L('theEnd'), [L('endLine'), L('stats', stats.kills, stats.rooms, stats.items) + '   ' + L('time', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`), '', L('credits'), '', L('endHint')], 0.88);
  }
  if (state === 'dead') {
    const secs = Math.round(((stats.end || performance.now()) - stats.start) / 1000);
    drawCenterText(L('dead'), [L('reached', stats.floor), L('stats', stats.kills, stats.rooms, stats.items), L('time', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`), '', L('deadHint')]);
  }
}

// ---------- loop (fixed-step simulation, rAF rendering) ----------
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  try { while (acc >= STEP) { update(STEP); acc -= STEP; } render(); } catch (err) { acc = 0; console.error(err); }
  requestAnimationFrame(frame);
}
particles = [];
requestAnimationFrame(frame);

// Small hook for automated smoke tests
window.__ink = { get state() { return state; }, get floor() { return floor; }, get room() { return room; }, get map() { return map; }, get enemies() { return enemies; }, get player() { return player; }, get pickups() { return pickups; }, get cut() { return cut; }, get lang() { return lang; }, get stats() { return stats; }, tears: () => tears, setLang, col, get menuSel() { return menuSel; }, colKey, menuDo,
  newRun, nextFloor, enterRoom, killEnemy, damage: (e) => damageEnemy(e, player.s.dmg, 0, 0), makeEnemy, freeSpot, playCut, advanceCut, endCut, debugBoss, ITEMS, BOSSES, makeItemPickup, killAll: () => enemies.forEach((e) => killEnemy(e)) };
