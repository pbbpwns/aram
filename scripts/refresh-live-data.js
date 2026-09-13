const fs = require('fs');
const path = require('path');

const opggBase = 'https://op.gg/lol/modes/aram-mayhem';
const pages = ['augments', 'skills', 'items'];
const aliases = {
  'Aurelion Sol': 'aurelionsol',
  'Dr. Mundo': 'drmundo',
  'Jarvan IV': 'jarvaniv',
  'Lee Sin': 'leesin',
  'Master Yi': 'masteryi',
  'Miss Fortune': 'missfortune',
  'Nunu & Willump': 'nunu',
  'Renata Glasc': 'renata',
  'Tahm Kench': 'tahmkench',
  'Twisted Fate': 'twistedfate',
  Wukong: 'monkeyking',
  'Xin Zhao': 'xinzhao',
};

function nextPayloads(html) {
  const expression = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
  return [...html.matchAll(expression)].flatMap((match) => { try { return [JSON.parse(match[1])]; } catch { return []; } });
}

function extractArrays(payload) {
  const arrays = [];
  const marker = '"data":[';
  for (let start = 0; (start = payload.indexOf(marker, start)) !== -1; start += marker.length) {
    const arrayStart = start + marker.length - 1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = arrayStart; index < payload.length; index += 1) {
      const character = payload[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
      } else if (character === '"') inString = true;
      else if (character === '[') depth += 1;
      else if (character === ']' && --depth === 0) {
        try { arrays.push(JSON.parse(payload.slice(arrayStart, index + 1))); } catch { /* Continue scanning. */ }
        break;
      }
    }
  }
  return arrays;
}

function findList(candidates, property) { return candidates.find((list) => list.some((entry) => entry && property in entry)) || []; }
function slimItem(item) { return { name: item.name, image_url: item.image_url }; }
function slimMetric(entry) { return { pick_rate: entry.pick_rate, win_rate: entry.win_rate, play: entry.play }; }

function topSkillOrders(html) {
  const start = html.indexOf('Skill order');
  const section = html.slice(start, html.indexOf('All Skills', start));
  const keys = [...section.matchAll(/>([QWE])<\/strong>/g)].map((match) => match[1]);
  const orders = Array.from({ length: Math.floor(keys.length / 3) }, (_, index) => keys.slice(index * 3, index * 3 + 3));
  return orders.filter((order, index) => orders.findIndex((candidate) => candidate.join('') === order.join('')) === index).slice(0, 5);
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'aram-mayhem-catalog/1.0' } });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return response.text();
}

async function fetchChampion(slug, name) {
  const [augmentsHtml, skillsHtml, itemsHtml] = await Promise.all(pages.map((page) => fetchText(`${opggBase}/${slug}/${page}`)));
  const augmentCandidates = nextPayloads(augmentsHtml).flatMap(extractArrays);
  const skillCandidates = nextPayloads(skillsHtml).flatMap(extractArrays);
  const itemCandidates = nextPayloads(itemsHtml).flatMap(extractArrays);
  const augments = findList(augmentCandidates, 'performance').filter((entry) => typeof entry.name === 'string').map((entry) => ({ name: entry.name, largeIcon: entry.largeIcon, popular: entry.popular, performance: entry.performance, desc: entry.desc }));
  const abilities = findList(skillCandidates, 'max_rank').map((skill) => ({ key: skill.key, name: skill.name, image_url: skill.image_url }));
  const coreBuilds = findList(itemCandidates, 'metaBuildItems').map((entry) => ({ ...slimMetric(entry), metaBuildItems: entry.metaBuildItems.map(slimItem) }));
  const boots = findList(itemCandidates, 'metaItem').map((entry) => ({ ...slimMetric(entry), metaItem: slimItem(entry.metaItem) }));
  return { name, augments, skills: { abilities, orders: topSkillOrders(skillsHtml) }, items: { coreBuilds, boots } };
}

function slugFor(name) { return aliases[name] || name.toLowerCase().replace(/&/g, 'and').replace(/['.]/g, '').replace(/\s+/g, '-'); }

function previousCatalog() {
  try {
    const contents = fs.readFileSync(path.join(__dirname, '..', 'data', 'live.js'), 'utf8');
    const json = contents.slice(contents.indexOf('=') + 1).replace(/;\s*$/, '');
    return JSON.parse(json);
  } catch {
    return { champions: {} };
  }
}

async function championCatalog() {
  const versions = await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json();
  const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${versions[0]}/data/en_US/champion.json`);
  if (!response.ok) throw new Error(`Could not load champion catalog: ${response.status}`);
  const { data } = await response.json();
  return Object.values(data).map((champion) => ({ name: champion.name, slug: slugFor(champion.name) })).sort((a, b) => a.name.localeCompare(b.name));
}

async function mapWithConcurrency(values, limit, callback) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < values.length) {
      const value = values[index++];
      try { results.push(await callback(value)); } catch (error) { console.warn(`Skipped ${value.name}: ${error.message}`); }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function main() {
  const allChampions = process.argv.includes('--all');
  const requestedSlug = process.argv.find((value) => value.startsWith('--champion='))?.split('=')[1] || 'gangplank';
  const catalog = allChampions ? await championCatalog() : [{ name: requestedSlug[0].toUpperCase() + requestedSlug.slice(1), slug: requestedSlug }];
  const records = await mapWithConcurrency(catalog, allChampions ? 2 : 1, ({ slug, name }) => fetchChampion(slug, name));
  if (records.length === 0) throw new Error('No champion data was fetched; preserving the previous catalog.');
  const champions = { ...(allChampions ? previousCatalog().champions : {}), ...Object.fromEntries(records.map((record) => [slugFor(record.name), record])) };
  const output = { generatedAt: new Date().toISOString(), champions, catalog: catalog.filter(({ slug }) => champions[slug]) };
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'live.js'), `window.ARAM_DATA = ${JSON.stringify(output)};\n`);
  console.log(`Updated ${records.length}/${catalog.length} champions.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
