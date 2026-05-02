const SAVE_KEY = 'neon-relics-save-v2';
const OFFLINE_CAP_SECONDS = 8 * 60 * 60;

const state = {
  credits: 120,
  energy: 0,
  multiplier: 1,
  overdriveUntil: 0,
  packCost: 50,
  soundEnabled: false,
  tutorialSeen: false,
  zone: 0,
  lastDailyChest: '',
  cards: [],
  upgrades: [
    { id: 'reactor', name: 'Quanten-Reaktor', desc: '+25% Produktion aller Relikte.', level: 0, baseCost: 180, effect: 0.25 },
    { id: 'lens', name: 'Prisma-Linse', desc: '+15% Chance auf seltene Karten.', level: 0, baseCost: 260, effect: 0.15 },
    { id: 'forge', name: 'Fusions-Schmiede', desc: 'Karten-Upgrades und Fusionen werden stärker.', level: 0, baseCost: 420, effect: 0.10 },
  ]
};

const relics = [
  { name: 'Aether Core', rarity: 'common', power: 2, text: 'Ein stabiler Kern aus kaltem Neonlicht.' },
  { name: 'Pulse Shard', rarity: 'common', power: 3, text: 'Pulsiert ruhig und produziert konstante Credits.' },
  { name: 'Glass Comet', rarity: 'common', power: 3.5, text: 'Ein Komet aus splitterndem Licht.' },
  { name: 'Vanta Sigil', rarity: 'rare', power: 7, text: 'Ein dunkles Siegel mit türkisfarbener Resonanz.' },
  { name: 'Chrome Lotus', rarity: 'rare', power: 9, text: 'Öffnet sich bei jedem Produktionszyklus.' },
  { name: 'Neon Mantis', rarity: 'rare', power: 10, text: 'Schneidet Leerlauf aus jeder Maschine.' },
  { name: 'Nova Crown', rarity: 'epic', power: 18, text: 'Eine Krone aus überladener Sternenenergie.' },
  { name: 'Dream Engine', rarity: 'epic', power: 22, text: 'Verwandelt Schlafdaten in Credits. Frag nicht.' },
  { name: 'Void Harp', rarity: 'epic', power: 26, text: 'Spielt Frequenzen, die Portale öffnen.' },
  { name: 'Solar Wraith', rarity: 'legendary', power: 55, text: 'Ein legendäres Relikt, das Raumlicht verbrennt.' },
  { name: 'Godspark Array', rarity: 'legendary', power: 72, text: 'Eine Maschine, die Maschinen träumen lässt.' },
  { name: 'Chrono Saint', rarity: 'legendary', power: 88, text: 'Faltet Sekunden zu funkelnden Dividenden.' },
];

const rarityWeight = { common: 70, rare: 23, epic: 6, legendary: 1 };
const rarityLabel = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
const rarityBonus = { common: 1, rare: 1.7, epic: 3.1, legendary: 7 };

const zones = [
  { name: 'Neon District', desc: 'Stabilisiere dein erstes Relikt-Netz.', goal: 20, reward: 250 },
  { name: 'Chrome Bazaar', desc: 'Schalte den Markt der leuchtenden Maschinen frei.', goal: 85, reward: 900 },
  { name: 'Vanta Arcade', desc: 'Bring die Schatten-Generatoren online.', goal: 240, reward: 2800 },
  { name: 'Solar Spire', desc: 'Skaliere deine Produktion bis in die oberen Türme.', goal: 720, reward: 8500 },
  { name: 'Godspark Gate', desc: 'Öffne das Tor für legendäre Reliktketten.', goal: 1800, reward: 26000 },
];

const els = {
  credits: document.querySelector('#credits'),
  energy: document.querySelector('#energy'),
  cps: document.querySelector('#cps'),
  collectionCount: document.querySelector('#collectionCount'),
  multiplier: document.querySelector('#multiplier'),
  overdriveText: document.querySelector('#overdriveText'),
  cards: document.querySelector('#cards'),
  upgrades: document.querySelector('#upgrades'),
  packCost: document.querySelector('#packCost'),
  openPackBtn: document.querySelector('#openPackBtn'),
  overdriveBtn: document.querySelector('#overdriveBtn'),
  soundBtn: document.querySelector('#soundBtn'),
  dailyChestBtn: document.querySelector('#dailyChestBtn'),
  zoneName: document.querySelector('#zoneName'),
  zoneDesc: document.querySelector('#zoneDesc'),
  zoneGoal: document.querySelector('#zoneGoal'),
  zoneProgressText: document.querySelector('#zoneProgressText'),
  zoneProgressBar: document.querySelector('#zoneProgressBar'),
  chestReveal: document.querySelector('#chestReveal'),
  chestTitle: document.querySelector('#chestTitle'),
  chestReward: document.querySelector('#chestReward'),
  chestCloseBtn: document.querySelector('#chestCloseBtn'),
  offlineBanner: document.querySelector('#offlineBanner'),
  tutorial: document.querySelector('#tutorial'),
  tutorialDoneBtn: document.querySelector('#tutorialDoneBtn'),
  toast: document.querySelector('#toast'),
  packReveal: document.querySelector('#packReveal'),
  revealedCard: document.querySelector('#revealedCard'),
  collectBtn: document.querySelector('#collectBtn'),
  template: document.querySelector('#cardTemplate'),
  canvas: document.querySelector('#fxCanvas'),
};

let pendingCard = null;
let last = performance.now();
let particles = [];
let saveTimer = 0;
let toastTimer = 0;
let audioCtx = null;
const ctx = els.canvas.getContext('2d');

function resizeCanvas() {
  els.canvas.width = innerWidth * devicePixelRatio;
  els.canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener('resize', resizeCanvas);
resizeCanvas();

function format(n) {
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 10_000) return Math.floor(n).toLocaleString('de-DE');
  if (n >= 1000) return n.toFixed(0).toLocaleString('de-DE');
  return n.toFixed(n < 100 ? 1 : 0);
}

function getUpgrade(id) { return state.upgrades.find(u => u.id === id); }
function upgradeCost(upgrade) { return Math.floor(upgrade.baseCost * Math.pow(1.82, upgrade.level)); }
function cardUpgradeCost(card) { return Math.floor(80 * rarityBonus[card.rarity] * Math.pow(1.65, card.level - 1)); }
function fuseCost(card) { return Math.floor(55 * rarityBonus[card.rarity] * Math.pow(1.52, card.fusion || 0)); }
function currentMultiplier() { return performance.now() < state.overdriveUntil ? 3 : state.multiplier; }

function cardProduction(card) {
  const forge = 1 + getUpgrade('forge').level * 0.05;
  const fusion = 1 + (card.fusion || 0) * (0.55 + getUpgrade('forge').level * 0.03);
  return card.power * rarityBonus[card.rarity] * card.level * forge * fusion;
}

function baseCps() {
  const reactor = 1 + getUpgrade('reactor').level * getUpgrade('reactor').effect;
  return state.cards.reduce((sum, card) => sum + cardProduction(card), 0) * reactor;
}

function totalCps() { return baseCps() * currentMultiplier(); }

function normalizeCard(card) {
  const base = relics.find(r => r.name === card.name) || relics[0];
  return {
    ...base,
    id: card.id || crypto.randomUUID(),
    level: Math.max(1, Number(card.level) || 1),
    power: Number(card.power) || base.power,
    copies: Math.max(0, Number(card.copies) || 0),
    fusion: Math.max(0, Number(card.fusion) || 0),
  };
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      state.cards.push({ ...relics[0], id: crypto.randomUUID(), level: 1, copies: 0, fusion: 0 });
      state.cards.push({ ...relics[3], id: crypto.randomUUID(), level: 1, copies: 0, fusion: 0 });
      return;
    }
    const save = JSON.parse(raw);
    state.credits = Number(save.credits) || state.credits;
    state.energy = Number(save.energy) || state.energy;
    state.packCost = Number(save.packCost) || state.packCost;
    state.soundEnabled = Boolean(save.soundEnabled);
    state.tutorialSeen = Boolean(save.tutorialSeen);
    state.zone = Math.max(0, Math.min(zones.length - 1, Number(save.zone) || 0));
    state.lastDailyChest = String(save.lastDailyChest || '');
    state.cards = Array.isArray(save.cards) ? save.cards.map(normalizeCard) : [];
    state.upgrades.forEach(upgrade => {
      const saved = save.upgrades?.find?.(u => u.id === upgrade.id);
      if (saved) upgrade.level = Math.max(0, Number(saved.level) || 0);
    });
    const elapsed = Math.min(OFFLINE_CAP_SECONDS, Math.max(0, (Date.now() - (Number(save.savedAt) || Date.now())) / 1000));
    if (elapsed > 20 && state.cards.length) {
      const earned = baseCps() * elapsed * 0.55;
      state.credits += earned;
      showOffline(earned, elapsed);
    }
    if (!state.cards.length) state.cards.push({ ...relics[0], id: crypto.randomUUID(), level: 1, copies: 0, fusion: 0 });
  } catch (err) {
    console.warn('Save konnte nicht geladen werden:', err);
    state.cards = [{ ...relics[0], id: crypto.randomUUID(), level: 1, copies: 0, fusion: 0 }];
  }
}

function saveGame() {
  const payload = {
    credits: state.credits,
    energy: state.energy,
    packCost: state.packCost,
    soundEnabled: state.soundEnabled,
    tutorialSeen: state.tutorialSeen,
    zone: state.zone,
    lastDailyChest: state.lastDailyChest,
    upgrades: state.upgrades.map(({ id, level }) => ({ id, level })),
    cards: state.cards.map(({ id, name, level, power, copies, fusion }) => ({ id, name, level, power, copies, fusion })),
    savedAt: Date.now(),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveGame, 250);
}

function showOffline(earned, elapsed) {
  const minutes = Math.floor(elapsed / 60);
  els.offlineBanner.textContent = `Offline-Fortschritt: +${format(earned)} Credits in ${minutes || '<1'} Min. gesammelt.`;
  els.offlineBanner.classList.remove('hidden');
  setTimeout(() => els.offlineBanner.classList.add('hidden'), 9000);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 2600);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function currentZone() {
  return zones[Math.min(state.zone, zones.length - 1)];
}

function updateZoneHud() {
  const zone = currentZone();
  const cps = baseCps();
  const progress = Math.min(1, cps / zone.goal);
  els.zoneName.textContent = `${state.zone + 1}. ${zone.name}`;
  els.zoneDesc.textContent = zone.desc;
  els.zoneGoal.textContent = `Ziel: ${format(zone.goal)} CPS`;
  els.zoneProgressText.textContent = `${Math.floor(progress * 100)}%`;
  els.zoneProgressBar.style.width = `${progress * 100}%`;
  els.dailyChestBtn.disabled = state.lastDailyChest === todayKey();
  els.dailyChestBtn.querySelector('span').textContent = state.lastDailyChest === todayKey() ? 'Chest abgeholt' : 'Daily Chest';
}

function checkZoneProgress() {
  const zone = currentZone();
  if (baseCps() < zone.goal || state.zone >= zones.length - 1) return;
  state.credits += zone.reward;
  state.energy += 35 + state.zone * 15;
  state.zone++;
  sound('legendary');
  burst(innerWidth / 2, 170, '#ffd166', 160);
  showToast(`Zone freigeschaltet: ${currentZone().name} · +${format(zone.reward)} Credits`);
  scheduleSave();
}

function openDailyChest() {
  const today = todayKey();
  if (state.lastDailyChest === today) return;
  const rewardCredits = Math.floor(350 + baseCps() * 90 + state.zone * 450);
  const rewardEnergy = 45 + state.zone * 10;
  state.credits += rewardCredits;
  state.energy += rewardEnergy;
  state.lastDailyChest = today;
  els.chestTitle.textContent = 'Daily Chest geöffnet';
  els.chestReward.textContent = `+${format(rewardCredits)} Credits · +${format(rewardEnergy)} Energie`;
  els.chestReveal.classList.remove('hidden');
  sound('legendary');
  burst(innerWidth / 2, innerHeight / 2, '#ffd166', 130);
  updateHud();
  scheduleSave();
}

function closeDailyChest() {
  els.chestReveal.classList.add('hidden');
}

function sound(type) {
  if (!state.soundEnabled) return;
  audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(type === 'legendary' ? 0.08 : 0.045, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  const notes = {
    click: [440], buy: [523, 659], pack: [392, 523, 784], fuse: [330, 660, 990], overdrive: [196, 392, 784], legendary: [523, 784, 1046, 1568]
  }[type] || [440];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = i % 2 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.055);
    osc.connect(gain);
    osc.start(now + i * 0.055);
    osc.stop(now + 0.42 + i * 0.03);
  });
}

function pickRelic() {
  const rareBoost = getUpgrade('lens').level * getUpgrade('lens').effect;
  const weights = {
    common: Math.max(38, rarityWeight.common - rareBoost * 45),
    rare: rarityWeight.rare + rareBoost * 24,
    epic: rarityWeight.epic + rareBoost * 14,
    legendary: rarityWeight.legendary + rareBoost * 7,
  };
  const pool = Object.entries(weights);
  const total = pool.reduce((s, [,w]) => s + w, 0);
  let roll = Math.random() * total;
  let rarity = 'common';
  for (const [r, w] of pool) {
    roll -= w;
    if (roll <= 0) { rarity = r; break; }
  }
  const options = relics.filter(r => r.rarity === rarity);
  const base = options[Math.floor(Math.random() * options.length)];
  return { ...base, id: crypto.randomUUID(), level: 1, copies: 0, fusion: 0 };
}

function createCardElement(card, reveal = false) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.classList.add(card.rarity);
  if (reveal) node.classList.add('reveal');
  node.querySelector('.rarity-chip').textContent = rarityLabel[card.rarity];
  node.querySelector('h3').textContent = card.name;
  node.querySelector('p').textContent = card.text;
  node.querySelector('.level').textContent = `Lvl ${card.level} · F${card.fusion || 0}`;
  node.querySelector('.copies').textContent = `Kopien ${card.copies || 0}/2`;
  node.querySelector('.power').textContent = `⚡ ${format(cardProduction(card))}/s`;
  const upgradeBtn = node.querySelector('.upgrade-card');
  upgradeBtn.textContent = `Upgrade ${format(cardUpgradeCost(card))}`;
  upgradeBtn.addEventListener('click', () => upgradeCard(card.id, node));
  const fuseBtn = node.querySelector('.fuse-card');
  fuseBtn.textContent = `Fusion ${format(fuseCost(card))}`;
  fuseBtn.disabled = (card.copies || 0) < 2 || state.credits < fuseCost(card);
  fuseBtn.addEventListener('click', () => fuseCard(card.id, node));
  node.addEventListener('pointermove', (e) => tiltCard(e, node));
  node.addEventListener('pointerleave', () => node.style.transform = '');
  return node;
}

function tiltCard(e, node) {
  if (matchMedia('(pointer: coarse)').matches) return;
  const r = node.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - .5;
  const y = (e.clientY - r.top) / r.height - .5;
  node.style.transform = `translateY(-8px) rotateX(${-y * 10}deg) rotateY(${x * 12}deg)`;
}

function renderCards() {
  els.cards.innerHTML = '';
  if (!state.cards.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'Öffne dein erstes Relikt, um die Maschine zu starten.';
    els.cards.append(empty);
    return;
  }
  state.cards.forEach(card => els.cards.append(createCardElement(card)));
}

function renderUpgrades() {
  els.upgrades.innerHTML = '';
  state.upgrades.forEach(upgrade => {
    const cost = upgradeCost(upgrade);
    const node = document.createElement('article');
    node.className = 'upgrade';
    node.innerHTML = `
      <div class="top"><strong>${upgrade.name}</strong><span>Lvl ${upgrade.level}</span></div>
      <p>${upgrade.desc}</p>
      <button class="btn ghost">Kaufen · ${format(cost)}</button>
    `;
    const btn = node.querySelector('button');
    btn.disabled = state.credits < cost;
    btn.addEventListener('click', () => {
      if (state.credits < cost) return;
      state.credits -= cost;
      upgrade.level++;
      sound('buy');
      burst(innerWidth * .2, innerHeight * .42, upgrade.id === 'lens' ? '#ff3ef2' : '#25f4ff', 34);
      renderUpgrades(); renderCards(); updateHud(); scheduleSave();
    });
    els.upgrades.append(node);
  });
}

function updateHud() {
  const cps = totalCps();
  els.credits.textContent = format(state.credits);
  els.energy.textContent = format(state.energy);
  els.cps.textContent = format(cps);
  els.collectionCount.textContent = state.cards.length;
  els.multiplier.textContent = currentMultiplier().toFixed(2) + '×';
  const remaining = Math.max(0, Math.ceil((state.overdriveUntil - performance.now()) / 1000));
  els.overdriveText.textContent = remaining ? `Overdrive ${remaining}s` : 'stabil';
  els.packCost.textContent = format(state.packCost);
  els.openPackBtn.disabled = state.credits < state.packCost;
  els.overdriveBtn.disabled = state.energy < 100 || performance.now() < state.overdriveUntil;
  els.soundBtn.querySelector('span').textContent = state.soundEnabled ? 'Sound an' : 'Sound aus';
  updateZoneHud();
  document.querySelectorAll('.upgrade').forEach((node, idx) => node.querySelector('button').disabled = state.credits < upgradeCost(state.upgrades[idx]));
  document.querySelectorAll('.relic-card:not(.reveal)').forEach((node, idx) => {
    const card = state.cards[idx];
    if (!card) return;
    const fuseBtn = node.querySelector('.fuse-card');
    if (fuseBtn) fuseBtn.disabled = (card.copies || 0) < 2 || state.credits < fuseCost(card);
  });
}

function openPack() {
  if (state.credits < state.packCost) return;
  state.credits -= state.packCost;
  state.packCost = Math.floor(state.packCost * 1.18 + 12);
  pendingCard = pickRelic();
  els.revealedCard.replaceWith(createCardElement(pendingCard, true));
  els.revealedCard = document.querySelector('.relic-card.reveal');
  els.packReveal.classList.remove('hidden');
  sound(pendingCard.rarity === 'legendary' ? 'legendary' : 'pack');
  burst(innerWidth / 2, innerHeight / 2, colorFor(pendingCard.rarity), pendingCard.rarity === 'legendary' ? 150 : 72);
  updateHud(); scheduleSave();
}

function collectPending() {
  if (!pendingCard) return;
  const existing = state.cards.find(card => card.name === pendingCard.name);
  if (existing) {
    existing.copies = (existing.copies || 0) + 1;
    existing.power *= 1.04;
    showToast(`Duplikat gesammelt: ${existing.name} (+1 Kopie)`);
  } else {
    state.cards.unshift(pendingCard);
    showToast(`${pendingCard.name} aufgenommen`);
  }
  state.energy += 12 * rarityBonus[pendingCard.rarity];
  burst(innerWidth / 2, innerHeight / 2, colorFor(pendingCard.rarity), 45);
  pendingCard = null;
  els.packReveal.classList.add('hidden');
  renderCards(); renderUpgrades(); updateHud(); scheduleSave();
}

function upgradeCard(id, node) {
  const card = state.cards.find(c => c.id === id);
  const cost = cardUpgradeCost(card);
  if (state.credits < cost) return;
  state.credits -= cost;
  card.level++;
  card.power *= 1.18;
  const r = node.getBoundingClientRect();
  sound('buy');
  burst(r.left + r.width / 2, r.top + r.height / 2, colorFor(card.rarity), 34);
  renderCards(); renderUpgrades(); updateHud(); scheduleSave();
}

function fuseCard(id, node) {
  const card = state.cards.find(c => c.id === id);
  const cost = fuseCost(card);
  if (!card || (card.copies || 0) < 2 || state.credits < cost) return;
  state.credits -= cost;
  card.copies -= 2;
  card.fusion = (card.fusion || 0) + 1;
  card.power *= 1.42;
  const r = node.getBoundingClientRect();
  sound('fuse');
  burst(r.left + r.width / 2, r.top + r.height / 2, colorFor(card.rarity), 95);
  showToast(`${card.name} fusioniert → F${card.fusion}`);
  renderCards(); renderUpgrades(); updateHud(); scheduleSave();
}

function activateOverdrive() {
  if (state.energy < 100 || performance.now() < state.overdriveUntil) return;
  state.energy -= 100;
  state.overdriveUntil = performance.now() + 15000;
  sound('overdrive');
  burst(innerWidth / 2, 120, '#49ffb2', 110);
  updateHud(); scheduleSave();
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  if (state.soundEnabled) sound('click');
  updateHud(); scheduleSave();
}

function colorFor(rarity) {
  return { common: '#7fc7ff', rare: '#25f4ff', epic: '#ff3ef2', legendary: '#ffd166' }[rarity];
}

function burst(x, y, color, amount = 40) {
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 7;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color, size: 2 + Math.random() * 5 });
  }
}

function renderParticles(dt) {
  ctx.clearRect(0,0,innerWidth,innerHeight);
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vy += 0.035 * dt * 60;
    p.life -= 0.018 * dt * 60;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.credits += totalCps() * dt;
  state.energy += state.cards.length ? dt * 0.8 * currentMultiplier() : 0;
  renderParticles(dt);
  checkZoneProgress();
  updateHud();
  requestAnimationFrame(tick);
}

els.openPackBtn.addEventListener('click', openPack);
els.collectBtn.addEventListener('click', collectPending);
els.overdriveBtn.addEventListener('click', activateOverdrive);
els.soundBtn.addEventListener('click', toggleSound);
els.dailyChestBtn.addEventListener('click', openDailyChest);
els.chestCloseBtn.addEventListener('click', closeDailyChest);
els.chestReveal.addEventListener('click', e => { if (e.target.classList.contains('reveal-backdrop')) closeDailyChest(); });
els.tutorialDoneBtn.addEventListener('click', () => {
  state.tutorialSeen = true;
  els.tutorial.classList.add('hidden');
  sound('click');
  scheduleSave();
});
els.packReveal.addEventListener('click', e => { if (e.target.classList.contains('reveal-backdrop')) collectPending(); });
addEventListener('beforeunload', saveGame);
setInterval(saveGame, 10000);

document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });

loadGame();
renderCards();
renderUpgrades();
updateHud();
if (!state.tutorialSeen) els.tutorial.classList.remove('hidden');
requestAnimationFrame(tick);
setTimeout(() => burst(innerWidth / 2, 160, '#25f4ff', 80), 500);
