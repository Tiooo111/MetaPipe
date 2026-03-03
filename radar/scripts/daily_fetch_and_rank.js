import fs from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import {
  readJson,
  writeJson,
  ymdInTz,
  parseArxivId,
  extractGithubRepo
} from './lib.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CONFIG_DIR = path.join(ROOT, 'config');
const DATA_DIR = path.join(ROOT, 'data');
const OUTPUT_DIR = path.join(ROOT, 'output');

function buildArxivQuery(categories, maxResults) {
  const catQ = categories.map((c) => `cat:${c}`).join(' OR ');
  const search_query = `(${catQ})`;
  const url = new URL('https://export.arxiv.org/api/query');
  url.searchParams.set('search_query', search_query);
  url.searchParams.set('sortBy', 'submittedDate');
  url.searchParams.set('sortOrder', 'descending');
  url.searchParams.set('start', '0');
  url.searchParams.set('max_results', String(maxResults));
  return url.toString();
}

async function loadGithubCache() {
  try {
    const p = path.join(DATA_DIR, 'github_cache.json');
    const s = await fs.readFile(p, 'utf-8');
    return JSON.parse(s);
  } catch {
    return {};
  }
}

async function saveGithubCache(cache) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const p = path.join(DATA_DIR, 'github_cache.json');
  await fs.writeFile(p, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
}

async function fetchGithubStars(repo, tokenEnv, cache) {
  const key = `${repo.owner}/${repo.repo}`;
  const cached = cache[key];
  const now = Date.now();
  if (cached && now - cached.updatedAt < 24 * 3600 * 1000) {
    return cached.stars;
  }

  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'scholar-radar'
  };
  const token = process.env[tokenEnv];
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}`, { headers });
  if (!res.ok) {
    cache[key] = { stars: cached?.stars ?? 0, updatedAt: now, error: `http_${res.status}` };
    return cache[key].stars;
  }
  const j = await res.json();
  const stars = Number(j.stargazers_count || 0);
  cache[key] = { stars, updatedAt: now };
  return stars;
}

function norm(s) {
  return String(s || '').toLowerCase();
}

function keywordScore(text, keywords) {
  const t = norm(text);
  let score = 0;
  for (const kw of keywords) {
    const k = norm(kw);
    if (!k) continue;
    if (t.includes(k)) score += 1;
  }
  return score;
}

function computeTags(text, tagsMap) {
  const t = norm(text);
  const tags = [];
  for (const [tag, kws] of Object.entries(tagsMap || {})) {
    for (const kw of kws) {
      if (t.includes(norm(kw))) {
        tags.push(tag);
        break;
      }
    }
  }
  return tags;
}

async function main() {
  const settings = await readJson(path.join(CONFIG_DIR, 'settings.json'));
  const watch = await readJson(path.join(CONFIG_DIR, 'watchlist.json'));
  const keywords = await readJson(path.join(CONFIG_DIR, 'keywords.json'));

  const tz = settings.timezone || 'Asia/Shanghai';
  const now = new Date();
  const todayYmd = ymdInTz(now, tz);

  const url = buildArxivQuery(settings.daily.categories, settings.daily.maxResults);
  const atom = await fetch(url).then((r) => r.text());

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });

  const doc = parser.parse(atom);
  const entries = doc?.feed?.entry ? (Array.isArray(doc.feed.entry) ? doc.feed.entry : [doc.feed.entry]) : [];

  const authorWatch = new Set((watch.authors || []).map((x) => String(x).trim()).filter(Boolean));

  const ghCache = await loadGithubCache();

  const papers = [];

  for (const e of entries) {
    const arxivId = parseArxivId(e.id);
    if (!arxivId) continue;

    const title = String(e.title || '').replace(/\s+/g, ' ').trim();
    const summary = String(e.summary || '').replace(/\s+/g, ' ').trim();
    const published = new Date(e.published);
    const updated = new Date(e.updated);

    const pubYmd = ymdInTz(published, tz);
    if (pubYmd !== todayYmd) continue;

    const authorsRaw = e.author ? (Array.isArray(e.author) ? e.author : [e.author]) : [];
    const authors = authorsRaw.map((a) => String(a.name || '').trim()).filter(Boolean);

    const links = e.link ? (Array.isArray(e.link) ? e.link : [e.link]) : [];
    const absUrl = String(e.id);
    const pdfUrl = links.find((l) => l['@_type'] === 'application/pdf')?.['@_href'] ?? `https://arxiv.org/pdf/${arxivId}.pdf`;

    const textForTags = `${title}\n${summary}`;
    const tags = computeTags(textForTags, keywords.tags);

    let score = 0;

    const titlePos = keywordScore(title, keywords.positive || []);
    const absPos = keywordScore(summary, keywords.positive || []);
    const neg = keywordScore(textForTags, keywords.negative || []);

    score += titlePos * 6;
    score += absPos * 2;
    score -= neg * 4;

    const watchHit = authors.some((a) => authorWatch.has(a));
    if (watchHit) score += 50;

    const gh = extractGithubRepo(textForTags);
    let ghStars = 0;
    if (settings.signals?.github?.enabled && gh) {
      ghStars = await fetchGithubStars(gh, settings.signals.github.tokenEnv || 'GITHUB_TOKEN', ghCache);
      score += Math.log10(ghStars + 1) * 10;
    }

    papers.push({
      arxivId,
      title,
      authors,
      published: e.published,
      updated: e.updated,
      absUrl,
      pdfUrl,
      abstract: summary,
      tags,
      signals: {
        watchHit,
        github: gh ? { ...gh, stars: ghStars } : null
      },
      score
    });
  }

  papers.sort((a, b) => b.score - a.score);

  const topN = settings.daily.topN;
  const selected = papers.filter((p) => p.score >= settings.daily.minScore).slice(0, topN);

  await saveGithubCache(ghCache);

  const outDir = path.join(OUTPUT_DIR, 'daily');
  const candidatesPath = path.join(outDir, `${todayYmd}.candidates.json`);
  const selectedPath = path.join(outDir, `${todayYmd}.selected.json`);

  await writeJson(candidatesPath, { generatedAt: now.toISOString(), tz, date: todayYmd, count: papers.length, papers });
  await writeJson(selectedPath, { generatedAt: now.toISOString(), tz, date: todayYmd, count: selected.length, papers: selected });

  console.log(JSON.stringify({ date: todayYmd, candidatesPath, selectedPath, count: selected.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
