const catalogData = window.ARAM_CATALOG;
const championRecords = window.ARAM_CHAMPIONS || {};
const params = new URLSearchParams(location.search);
const state = { sort: params.get('sort') === 'win' ? 'win' : 'pick', query: params.get('augment') || '', topOnly: params.get('top') === '1', compact: params.get('density') === 'compact' };
const content = document.querySelector('#content');
const quickRead = document.querySelector('#quick-read');
const searchInput = document.querySelector('#search');
const championSelect = document.querySelector('#champion');
const championSearch = document.querySelector('#champion-search');
const recentChampions = document.querySelector('#recent-champions');
const championName = document.querySelector('#champion-name');
const championPortrait = document.querySelector('#champion-portrait');
const sourceLink = document.querySelector('#source-link');
const themeToggle = document.querySelector('#theme-toggle');
const searchShortcut = document.querySelector('#search-shortcut');
const statusBadge = document.querySelector('#status-badge');
const updatedAt = document.querySelector('#updated-at');
const topToggle = document.querySelector('#top-toggle');
const densityToggle = document.querySelector('#density-toggle');
const emptyState = document.querySelector('#empty-state').innerHTML;
let currentSlug = params.get('champion') || location.hash.slice(1) || 'gangplank';
if (!catalogData.catalog.some((entry) => entry.slug === currentSlug)) currentSlug = catalogData.catalog[0]?.slug;
let current = null;
let loadSequence = 0;

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function percentage(value) { return `${Number(value).toFixed(1)}%`; }
function imageSrc(url, size = 64) { if (!url || !url.includes('opgg-static.akamaized.net') || url.includes('?')) return url; return `${url}?image=q_auto:good,f_png,w_${size},h_${size}&v=1618`; }
function championPortraitSrc(name) { const imageIds = { "Bel'Veth": 'Belveth', "Cho'Gath": 'Chogath', "K'Sante": 'KSante', "Kha'Zix": 'Khazix', "Kog'Maw": 'KogMaw', "Rek'Sai": 'RekSai', "Vel'Koz": 'Velkoz', 'Nunu & Willump': 'Nunu', Wukong: 'MonkeyKing' }; const imageId = imageIds[name] || name.replace(/[^a-z]/gi, ''); return imageSrc(`https://opgg-static.akamaized.net/meta/images/lol/latest/champion/${imageId}.png`, 96); }
function iconMarkup(name, url) { const label = escapeHtml(name || 'Unavailable'); return `<span class="icon-frame"><img class="item-icon" src="${imageSrc(url) || ''}" alt="${label}" loading="lazy" onerror="this.onerror=null;this.hidden=true;this.nextElementSibling.hidden=false"><span class="icon-fallback" aria-hidden="true" hidden>?</span></span>`; }
function itemIcon(item) { return iconMarkup(item?.name, item?.image_url); }
function pickRate(entry) { return Number(entry.pick_rate ?? entry.popular ?? 0); }
function winRate(entry) { return Number(entry.win_rate ?? entry.performance ?? 0); }
function itemName(entry) { return entry.metaItem?.name || entry.name || 'Unknown'; }
function itemImage(entry) { return entry.metaItem?.image_url || entry.largeIcon || entry.image_url; }
function syncUrl() { const next = new URLSearchParams(); next.set('champion', currentSlug); if (state.sort === 'win') next.set('sort', 'win'); if (state.query) next.set('augment', state.query); if (state.topOnly) next.set('top', '1'); if (state.compact) next.set('density', 'compact'); const theme = document.body.classList.contains('is-light') ? 'light' : 'dark'; if (theme === 'light') next.set('theme', theme); history.replaceState(null, '', `${location.pathname}?${next.toString()}`); }
function relativeTime(iso) { const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)); if (minutes < 1) return 'just now'; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; return `${Math.floor(hours / 24)}d ago`; }
function setStatus(status = 'live') { statusBadge.textContent = status === 'error' ? 'Refresh failed' : status === 'cached' ? 'Cached' : 'Live'; statusBadge.className = `status-badge ${status}`; updatedAt.textContent = `Updated ${relativeTime(catalogData.generatedAt)}`; }
function setTheme(isLight) { document.body.classList.toggle('is-light', isLight); themeToggle.checked = isLight; themeToggle.closest('.theme-toggle').title = isLight ? 'Use dark mode' : 'Use light mode'; themeToggle.setAttribute('aria-label', isLight ? 'Use dark mode' : 'Use light mode'); document.querySelector('meta[name="theme-color"]').content = isLight ? '#f4f1e8' : '#111315'; }
function section(title, meta, body, className = '') { return `<section class="data-section ${className}" data-section="${title.toLowerCase().replace(/[^a-z]+/g, '-')}"><div class="section-title"><span class="section-heading">${title}</span><span class="section-meta">${meta}</span><button class="collapse-toggle" type="button" aria-expanded="true" aria-label="Collapse ${title}">−</button></div><div class="section-body">${body}</div></section>`; }
function renderMetricRow(entry, rank, name = itemName(entry), image = itemImage(entry)) { const detail = entry.play ? `${Number(entry.play).toLocaleString()} games` : entry.desc?.replace(/<[^>]*>/g, '') || 'Augment'; const pickLabel = entry.popular !== undefined ? 'Popular' : 'Pick'; const winLabel = entry.performance !== undefined ? 'Score' : 'Win'; return `<article class="recommendation"><div class="rank">${rank + 1}</div>${iconMarkup(name, image)}<div class="recommendation-name"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(detail)}</span></div><div class="metric"><span>${pickLabel}</span><strong>${percentage(pickRate(entry))}</strong></div><div class="metric metric-win"><span>${winLabel}</span><strong>${percentage(winRate(entry))}</strong></div></article>`; }
function renderQuickRead(list) { if (!list.length) { quickRead.innerHTML = '<div class="quick-label">Quick read</div><div class="quick-choice"><strong>No augment data available</strong></div>'; return; } const popular = [...list].sort((a, b) => pickRate(b) - pickRate(a))[0]; const strongest = [...list].filter((entry) => !entry.play || Number(entry.play) >= 10).sort((a, b) => winRate(b) - winRate(a))[0] || popular; quickRead.innerHTML = `<div class="quick-label">Quick read</div><div class="quick-choice"><span>${popular.popular !== undefined ? 'Most popular' : 'Most played'}</span><strong>${escapeHtml(itemName(popular))}</strong><em>${percentage(pickRate(popular))}</em></div><div class="quick-choice"><span>${strongest.performance !== undefined ? 'Top performance' : 'Best win rate'}</span><strong>${escapeHtml(itemName(strongest))}</strong><em>${percentage(winRate(strongest))}</em></div><small>${escapeHtml(`Updated ${relativeTime(catalogData.generatedAt)}`)}</small>`; }
function renderAugments() { const augments = current.augments.filter((entry) => typeof entry?.name === 'string'); const ranked = [...augments].sort((a, b) => state.sort === 'pick' ? pickRate(b) - pickRate(a) : winRate(b) - winRate(a)); const filtered = ranked.filter((entry) => entry.name.toLowerCase().includes(state.query)); const visible = state.topOnly ? filtered.slice(0, 10) : filtered; return section('Augments', `${visible.length}/${ranked.length}`, visible.map((entry) => renderMetricRow(entry, ranked.indexOf(entry))).join('') || emptyState, 'augments-section'); }
function arrow() { return '<span class="build-arrow" aria-hidden="true">›</span>'; }
function buildRow(build, rank) { const icons = (build.metaBuildItems || []).map(itemIcon).join(arrow()); const names = (build.metaBuildItems || []).map((item) => item.name).join(' · '); return `<article class="build-row"><div class="rank">${rank + 1}</div><div class="build-icons">${icons}</div><div class="build-metrics"><span>${escapeHtml(names)}</span><strong>${percentage(build.pick_rate)} pick</strong><em>${percentage(build.win_rate)} win</em></div></article>`; }
function renderItems() { const coreBuilds = [...(current.items?.coreBuilds || [])].sort((a, b) => b.pick_rate - a.pick_rate); const boots = [...(current.items?.boots || [])].sort((a, b) => b.pick_rate - a.pick_rate); const core = state.topOnly ? coreBuilds.slice(0, 5) : coreBuilds; const bootList = state.topOnly ? boots.slice(0, 3) : boots; return `<div class="items-column">${section('Core builds', `${core.length}/${coreBuilds.length}`, core.map(buildRow).join('') || emptyState)}${section('Boots', `${bootList.length}/${boots.length}`, bootList.map((entry, index) => renderMetricRow(entry, index)).join('') || emptyState, 'boots')}</div>`; }
function renderSkills() { const abilities = Object.fromEntries((current.skills?.abilities || []).map((skill) => [skill.key, skill])); const orders = (current.skills?.orders || []).slice(0, 5); const rows = orders.map((order, index) => `<article class="skill-build"><div class="rank">${index + 1}</div><div class="build-icons">${order.map((key) => `${itemIcon(abilities[key])}<b class="ability-key">${key}</b>`).join(arrow())}</div><div class="build-metrics"><strong>${escapeHtml(order.join(' › '))}</strong><span>${escapeHtml(order.map((key) => abilities[key]?.name || key).join(' · '))}</span></div></article>`).join(''); return section('Skill order', 'Top 5', rows || emptyState); }
function render() { const augments = current.augments.filter((entry) => typeof entry?.name === 'string'); document.body.classList.toggle('is-compact', state.compact); renderQuickRead(augments); content.innerHTML = `<div class="build-column">${renderAugments()}</div><div class="build-column">${renderSkills()}</div><div class="build-column">${renderItems()}</div>`; topToggle.checked = state.topOnly; densityToggle.checked = state.compact; setStatus('live'); }
function renderLoading() { quickRead.innerHTML = '<div class="quick-label">Loading</div><div class="quick-choice"><strong>Fetching latest champion data…</strong></div>'; content.innerHTML = '<div class="loading-state" role="status">Loading recommendations…</div>'; }
function renderError() { setStatus('error'); quickRead.innerHTML = '<div class="quick-label">Data unavailable</div><div class="quick-choice"><strong>Could not load this champion</strong><span>Try selecting another champion or reload the page.</span></div>'; content.innerHTML = '<div class="error-state" role="alert">Champion data failed to load. The rest of the catalog is still available.</div>'; }
function loadChampion(slug) { if (championRecords[slug]) return Promise.resolve(championRecords[slug]); return new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = `data/champions/${encodeURIComponent(slug)}.js`; script.dataset.champion = slug; script.onload = () => championRecords[slug] ? resolve(championRecords[slug]) : reject(new Error('Record missing')); script.onerror = () => reject(new Error('Record request failed')); document.head.appendChild(script); }); }
function recentList() { try { return JSON.parse(localStorage.getItem('aram-recent') || '[]'); } catch { return []; } }
function saveRecent(slug) { const next = [slug, ...recentList().filter((entry) => entry !== slug)].slice(0, 5); localStorage.setItem('aram-recent', JSON.stringify(next)); renderRecent(); }
function renderRecent() { const entries = recentList().map((slug) => catalogData.catalog.find((entry) => entry.slug === slug)).filter(Boolean); recentChampions.innerHTML = entries.length ? `<span class="recent-label">Recent</span>${entries.map((entry) => `<button class="recent-champion" type="button" data-slug="${entry.slug}" title="${escapeHtml(entry.name)}">${iconMarkup(entry.name, championPortraitSrc(entry.name))}<span>${escapeHtml(entry.name)}</span></button>`).join('')}` : ''; }
function renderChampionOptions(query = '') { const matches = catalogData.catalog.filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase())); championSelect.innerHTML = matches.map((entry) => `<option value="${entry.slug}" ${entry.slug === currentSlug ? 'selected' : ''}>${escapeHtml(entry.name)}</option>`).join(''); }
async function selectChampion(slug) { if (!catalogData.catalog.some((entry) => entry.slug === slug)) return; currentSlug = slug; syncUrl(); championSelect.value = slug; const entry = catalogData.catalog.find((item) => item.slug === slug); championName.textContent = entry.name; championPortrait.src = championPortraitSrc(entry.name); championPortrait.alt = `${entry.name} portrait`; sourceLink.href = `https://op.gg/lol/modes/aram-mayhem/${slug}/augments`; document.title = `${entry.name} ARAM: Mayhem Desk`; renderLoading(); const request = ++loadSequence; try { current = await loadChampion(slug); if (request !== loadSequence) return; saveRecent(slug); render(); } catch { if (request === loadSequence) renderError(); } }

championSearch.addEventListener('input', () => renderChampionOptions(championSearch.value));
championSelect.addEventListener('change', () => selectChampion(championSelect.value));
recentChampions.addEventListener('click', (event) => { const button = event.target.closest('[data-slug]'); if (button) selectChampion(button.dataset.slug); });
document.querySelectorAll('.sort').forEach((button) => button.addEventListener('click', () => { state.sort = button.dataset.sort; document.querySelectorAll('.sort').forEach((sort) => sort.classList.toggle('is-active', sort === button)); syncUrl(); if (current) render(); }));
searchInput.addEventListener('input', (event) => { state.query = event.target.value.trim().toLowerCase(); syncUrl(); if (current) render(); });
topToggle.addEventListener('change', () => { state.topOnly = topToggle.checked; syncUrl(); if (current) render(); });
densityToggle.addEventListener('change', () => { state.compact = densityToggle.checked; syncUrl(); if (current) render(); });
content.addEventListener('click', (event) => { const button = event.target.closest('.collapse-toggle'); if (!button) return; const sectionElement = button.closest('.data-section'); const collapsed = sectionElement.classList.toggle('is-collapsed'); button.setAttribute('aria-expanded', String(!collapsed)); button.textContent = collapsed ? '+' : '−'; });
function focusSearchShortcut(event) { if (!(event.metaKey || event.ctrlKey) || event.code !== 'KeyF') return; event.preventDefault(); event.stopImmediatePropagation(); searchInput.focus({ preventScroll: true }); searchInput.select(); }
window.addEventListener('keydown', focusSearchShortcut, { capture: true });
searchShortcut.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘F' : 'Ctrl F';
const urlTheme = params.get('theme');
setTheme(urlTheme ? urlTheme === 'light' : localStorage.getItem('aram-theme') === 'light');
themeToggle.addEventListener('change', () => { setTheme(themeToggle.checked); localStorage.setItem('aram-theme', themeToggle.checked ? 'light' : 'dark'); syncUrl(); });
requestAnimationFrame(() => document.body.classList.add('theme-ready'));
renderChampionOptions();
renderRecent();
searchInput.value = state.query;
selectChampion(currentSlug);
