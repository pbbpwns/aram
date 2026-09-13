const state = { sort: 'pick', query: '' };
const data = window.ARAM_DATA;
const content = document.querySelector('#content');
const quickRead = document.querySelector('#quick-read');
const searchInput = document.querySelector('#search');
const championSelect = document.querySelector('#champion');
const championName = document.querySelector('#champion-name');
const championPortrait = document.querySelector('#champion-portrait');
const sourceLink = document.querySelector('#source-link');
const themeToggle = document.querySelector('#theme-toggle');
let currentSlug = location.hash.slice(1) || 'gangplank';
if (!data.champions[currentSlug]) currentSlug = data.champions.gangplank ? 'gangplank' : Object.keys(data.champions)[0];
let current = data.champions[currentSlug];

function percentage(value) { return `${Number(value).toFixed(1)}%`; }
function championPortraitSrc(name) {
  const imageIds = { "Bel'Veth": 'Belveth', "Cho'Gath": 'Chogath', "K'Sante": 'KSante', "Kha'Zix": 'Khazix', "Kog'Maw": 'KogMaw', "Rek'Sai": 'RekSai', "Vel'Koz": 'Velkoz', 'Nunu & Willump': 'Nunu', Wukong: 'MonkeyKing' };
  const imageId = imageIds[name] || name.replace(/[^a-z]/gi, '');
  return imageSrc(`https://opgg-static.akamaized.net/meta/images/lol/latest/champion/${imageId}.png`);
}
function setTheme(isLight) {
  document.body.classList.toggle('is-light', isLight);
  themeToggle.checked = isLight;
  themeToggle.closest('.theme-toggle').title = isLight ? 'Use dark mode' : 'Use light mode';
  themeToggle.setAttribute('aria-label', isLight ? 'Use dark mode' : 'Use light mode');
  document.querySelector('meta[name="theme-color"]').content = isLight ? '#f4f1e8' : '#111315';
}
function imageSrc(url) {
  if (!url || !url.includes('opgg-static.akamaized.net') || url.includes('?')) return url;
  return `${url}?image=q_auto:good,f_png,w_64,h_64&v=1618`;
}
function itemIcon(item) { return `<img class="item-icon" src="${imageSrc(item.image_url)}" alt="${item.name}" loading="lazy">`; }
function pickRate(entry) { return Number(entry.pick_rate ?? entry.popular ?? 0); }
function winRate(entry) { return Number(entry.win_rate ?? entry.performance ?? 0); }
function itemName(entry) { return entry.metaItem?.name || entry.name || 'Unknown'; }
function itemImage(entry) { return imageSrc(entry.metaItem?.image_url || entry.largeIcon || entry.image_url); }

function renderMetricRow(entry, rank, name = itemName(entry), image = itemImage(entry)) {
  const detail = entry.play ? `${Number(entry.play).toLocaleString()} games` : entry.desc?.replace(/<[^>]*>/g, '') || 'Augment';
  const pickLabel = entry.popular !== undefined ? 'Popular' : 'Pick';
  const winLabel = entry.performance !== undefined ? 'Score' : 'Win';
  return `<article class="recommendation"><div class="rank">${rank + 1}</div><img class="item-icon" src="${image}" alt="${name}" loading="lazy"><div class="recommendation-name"><strong>${name}</strong><span>${detail}</span></div><div class="metric"><span>${pickLabel}</span><strong>${percentage(pickRate(entry))}</strong></div><div class="metric metric-win"><span>${winLabel}</span><strong>${percentage(winRate(entry))}</strong></div></article>`;
}

function renderQuickRead(list) {
  const popular = [...list].sort((a, b) => pickRate(b) - pickRate(a))[0];
  const strongest = [...list].filter((entry) => !entry.play || Number(entry.play) >= 10).sort((a, b) => winRate(b) - winRate(a))[0];
  quickRead.innerHTML = `<div class="quick-label">Quick read</div><div class="quick-choice"><span>${popular.popular !== undefined ? 'Most popular' : 'Most played'}</span><strong>${itemName(popular)}</strong><em>${percentage(pickRate(popular))}</em></div><div class="quick-choice"><span>${strongest.performance !== undefined ? 'Top performance' : 'Best win rate'}</span><strong>${itemName(strongest)}</strong><em>${percentage(winRate(strongest))}</em></div><small>Updated ${new Date(data.generatedAt).toLocaleString()}</small>`;
}

function renderAugments() {
  const augments = current.augments.filter((entry) => typeof entry?.name === 'string');
  const ranked = [...augments].sort((a, b) => state.sort === 'pick' ? pickRate(b) - pickRate(a) : winRate(b) - winRate(a));
  const list = ranked.filter((entry) => entry.name.toLowerCase().includes(state.query));
  return `<section class="data-section augments-section"><div class="section-title">Augments <span>Popular / Score</span></div>${list.map((entry) => renderMetricRow(entry, ranked.indexOf(entry))).join('') || document.querySelector('#empty-state').innerHTML}</section>`;
}

function arrow() { return '<span class="build-arrow" aria-hidden="true">›</span>'; }
function buildRow(build, rank) {
  const icons = build.metaBuildItems.map(itemIcon).join(arrow());
  const names = build.metaBuildItems.map((item) => item.name).join(' · ');
  return `<article class="build-row"><div class="rank">${rank + 1}</div><div class="build-icons">${icons}</div><div class="build-metrics"><span>${names}</span><strong>${percentage(build.pick_rate)} pick</strong><em>${percentage(build.win_rate)} win</em></div></article>`;
}

function renderItems() {
  const coreBuilds = [...current.items.coreBuilds].sort((a, b) => b.pick_rate - a.pick_rate);
  const boots = [...current.items.boots].sort((a, b) => b.pick_rate - a.pick_rate);
  return `<div class="items-column"><section class="data-section"><div class="section-title">Core builds <span>Pick / Win</span></div>${coreBuilds.map(buildRow).join('') || document.querySelector('#empty-state').innerHTML}</section><section class="data-section boots"><div class="section-title">Boots <span>Pick / Win</span></div>${boots.map((entry, index) => renderMetricRow(entry, index)).join('') || document.querySelector('#empty-state').innerHTML}</section></div>`;
}

function renderSkills() {
  const abilities = Object.fromEntries(current.skills.abilities.map((skill) => [skill.key, skill]));
  return `<section class="data-section"><div class="section-title">Skill order <span>Top 5</span></div>${current.skills.orders.map((order, index) => `<article class="skill-build"><div class="rank">${index + 1}</div><div class="build-icons">${order.map((key) => `${itemIcon(abilities[key])}<b class="ability-key">${key}</b>`).join(arrow())}</div><div class="build-metrics"><strong>${order.join(' › ')}</strong><span>${order.map((key) => abilities[key].name).join(' · ')}</span></div></article>`).join('')}</section>`;
}

function render() {
  const augments = current.augments.filter((entry) => typeof entry?.name === 'string');
  renderQuickRead(augments);
  content.innerHTML = `<div class="build-column">${renderAugments()}</div><div class="build-column">${renderSkills()}</div><div class="build-column">${renderItems()}</div>`;
}

document.querySelectorAll('.sort').forEach((button) => button.addEventListener('click', () => { state.sort = button.dataset.sort; document.querySelectorAll('.sort').forEach((sort) => sort.classList.toggle('is-active', sort === button)); render(); }));
searchInput.addEventListener('input', (event) => { state.query = event.target.value.trim().toLowerCase(); render(); });
setTheme(localStorage.getItem('aram-theme') === 'light');
requestAnimationFrame(() => document.body.classList.add('theme-ready'));
themeToggle.addEventListener('change', () => {
  setTheme(themeToggle.checked);
  localStorage.setItem('aram-theme', themeToggle.checked ? 'light' : 'dark');
});
data.catalog.forEach(({ name, slug }) => { championSelect.add(new Option(name, slug, false, slug === currentSlug)); });
championSelect.addEventListener('change', () => {
  currentSlug = championSelect.value;
  current = data.champions[currentSlug];
  championName.textContent = current.name;
  championPortrait.src = championPortraitSrc(current.name);
  championPortrait.alt = `${current.name} portrait`;
  document.title = `${current.name} ARAM: Mayhem Desk`;
  sourceLink.href = `https://op.gg/lol/modes/aram-mayhem/${currentSlug}/augments`;
  location.hash = currentSlug;
  searchInput.value = '';
  state.query = '';
  render();
});
championName.textContent = current.name;
championPortrait.src = championPortraitSrc(current.name);
championPortrait.alt = `${current.name} portrait`;
document.title = `${current.name} ARAM: Mayhem Desk`;
sourceLink.href = `https://op.gg/lol/modes/aram-mayhem/${currentSlug}/augments`;
render();
