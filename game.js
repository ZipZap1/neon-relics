const state = {
  credits: 120,
  energy: 0,
  multiplier: 1,
  overdriveUntil: 0,
  packCost: 50,
  cards: [],
  upgrades: [
    { id: 'reactor', name: 'Quanten-Reaktor', desc: '+25% Produktion aller Relikte.', level: 0, baseCost: 180, effect: 0.25 },
    { id: 'lens', name: 'Prisma-Linse', desc: '+15% Chance auf seltene Karten.', level: 0, baseCost: 260, effect: 0.15 },
    { id: 'forge', name: 'Fusions-Schmiede', desc: 'Karten-Upgrades werden 10% stärker.', level: 0, baseCost: 420, effect: 0.10 },
  ]
};

const relics = [
  { name: 'Aether Core', rarity: 'common', power: 2, text: 'Ein stabiler Kern aus kaltem Neonlicht.' },
  { name: 'Pulse Shard', rarity: 'common', power: 3, text: 'Pulsiert ruhig und produziert konstante Credits.' },
  { name: 'Vanta Sigil', rarity: 'rare', power: 7, text: 'Ein dunkles Siegel mit türkisfarbener Resonanz.' },
  { name: 'Chrome Lotus', rarity: 'rare', power: 9, text: 'Öffnet sich bei jedem Produktionszyklus.' },
  { name: 'Nova Crown', rarity: 'epic', power: 18, text: 'Eine Krone aus überladener Sternenenergie.' },
  { name: 'Dream Engine', rarity: 'epic', power: 22, text: 'Verwandelt Schlafdaten in Credits. Frag nicht.' },
  { name: 'Solar Wraith', rarity: 'legendary', power: 55, text: 'Ein legendäres Relikt, das Raumlicht verbrennt.' },
  { name: 'Godspark Array', rarity: 'legendary', power: 72, text: 'Eine Maschine, die Maschinen träumen lässt.' },
];

const rarityWeight = { common: 70, rare: 23, epic: 6, legendary: 1 };
const rarityLabel = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
const rarityBonus = { common: 1, rare: 1.7, epic: 3.1, legendary: 7 };

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
  packReveal: document.querySelector('#packReveal'),
  revealedCard: document.querySelector('#revealedCard'),
  collectBtn: document.querySelector('#collectBtn'),
  template: document.querySelector('#cardTemplate'),
  canvas: document.querySelector('#fxCanvas'),
};

let pendingCard = null;
let last = performance.now();
let particles = [];
const ctx = els.canvas.getContext('2d');

function resizeCanvas() {
  els.canvas.width = innerWidth * devicePixelRatio;
  els.canvas.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener('resize', resizeCanvas);
resizeCanvas();

function format(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 10_000) return Math.floor(n).toLocaleString('de-DE');
  if (n >= 1000) return n.toFixed(0).toLocaleString('de-DE');
  return n.toFixed(n < 100 ? 1 : 0);
}

function totalCps() {
  const reactor = 1 + getUpgrade('reactor').level * getUpgrade('reactor').effect;
  const forge = 1 + getUpgrade('forge').level * 0.05;
  return state.cards.reduce((sum, card) => sum + card.power * rarityBonus[card.rarity] * card.level * forge, 0) * reactor * currentMultiplier();
}

function currentMultiplier() {
  return performance.now() < state.overdriveUntil ? 3 : state.multiplier;
}

function getUpgrade(id) { return state.upgrades.find(u => u.id === id); }
function upgradeCost(upgrade) { return Math.floor(upgrade.baseCost * Math.pow(1.82, upgrade.level)); }
function cardUpgradeCost(card) { return Math.floor(80 * rarityBonus[card.rarity] * Math.pow(1.65, card.level - 1)); }

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
  return { ...base, id: crypto.randomUUID(), level: 1 };
}

function createCardElement(card, reveal = false) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.classList.add(card.rarity);
  if (reveal) node.classList.add('reveal');
  node.querySelector('.rarity-chip').textContent = rarityLabel[card.rarity];
  node.querySelector('h3').textContent = card.name;
  node.querySelector('p').textContent = card.text;
  node.querySelector('.power').textContent = `⚡ ${format(card.power * card.level * rarityBonus[card.rarity])}/s`;
  const btn = node.querySelector('.upgrade-card');
  btn.textContent = `Upgrade ${format(cardUpgradeCost(card))}`;
  btn.addEventListener('click', () => upgradeCard(card.id, node));
  node.addEventListener('pointermove', (e) => tiltCard(e, node));
  node.addEventListener('pointerleave', () => node.style.transform = '');
  return node;
}

function tiltCard(e, node) {
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
    empty.style.color = 'var(--muted)';
    empty.style.padding = '32px';
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
      burst(innerWidth * .2, innerHeight * .42, upgrade.id === 'lens' ? '#ff3ef2' : '#25f4ff', 34);
      renderUpgrades(); updateHud();
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
  document.querySelectorAll('.upgrade').forEach((node, idx) => node.querySelector('button').disabled = state.credits < upgradeCost(state.upgrades[idx]));
}

function openPack() {
  if (state.credits < state.packCost) return;
  state.credits -= state.packCost;
  state.packCost = Math.floor(state.packCost * 1.18 + 12);
  pendingCard = pickRelic();
  els.revealedCard.replaceWith(createCardElement(pendingCard, true));
  els.revealedCard = document.querySelector('.relic-card.reveal');
  els.packReveal.classList.remove('hidden');
  burst(innerWidth / 2, innerHeight / 2, colorFor(pendingCard.rarity), pendingCard.rarity === 'legendary' ? 150 : 72);
  updateHud();
}

function collectPending() {
  if (!pendingCard) return;
  state.cards.unshift(pendingCard);
  state.energy += 12 * rarityBonus[pendingCard.rarity];
  burst(innerWidth / 2, innerHeight / 2, colorFor(pendingCard.rarity), 45);
  pendingCard = null;
  els.packReveal.classList.add('hidden');
  renderCards(); renderUpgrades(); updateHud();
}

function upgradeCard(id, node) {
  const card = state.cards.find(c => c.id === id);
  const cost = cardUpgradeCost(card);
  if (state.credits < cost) return;
  state.credits -= cost;
  card.level++;
  card.power *= 1.18;
  const r = node.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, colorFor(card.rarity), 34);
  renderCards(); renderUpgrades(); updateHud();
}

function activateOverdrive() {
  if (state.energy < 100 || performance.now() < state.overdriveUntil) return;
  state.energy -= 100;
  state.overdriveUntil = performance.now() + 15000;
  burst(innerWidth / 2, 120, '#49ffb2', 110);
  updateHud();
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
  const cps = totalCps();
  state.credits += cps * dt;
  state.energy += state.cards.length ? dt * 0.8 * currentMultiplier() : 0;
  renderParticles(dt);
  updateHud();
  requestAnimationFrame(tick);
}

els.openPackBtn.addEventListener('click', openPack);
els.collectBtn.addEventListener('click', collectPending);
els.overdriveBtn.addEventListener('click', activateOverdrive);
els.packReveal.addEventListener('click', e => { if (e.target.classList.contains('reveal-backdrop')) collectPending(); });

state.cards.push({ ...relics[0], id: crypto.randomUUID(), level: 1 });
state.cards.push({ ...relics[2], id: crypto.randomUUID(), level: 1 });
renderCards();
renderUpgrades();
updateHud();
requestAnimationFrame(tick);
setTimeout(() => burst(innerWidth / 2, 160, '#25f4ff', 80), 500);
