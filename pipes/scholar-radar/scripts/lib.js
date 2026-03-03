import fs from 'node:fs/promises';
import path from 'node:path';

export async function readJson(p) {
  const s = await fs.readFile(p, 'utf-8');
  return JSON.parse(s);
}

export async function writeJson(p, obj) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

export function ymdInTz(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return dtf.format(date); // YYYY-MM-DD
}

export function parseArxivId(idUrl) {
  // e.g. http://arxiv.org/abs/2503.01234v2
  const m = String(idUrl).match(/arxiv\.org\/abs\/([^/]+)$/);
  return m ? m[1] : null;
}

export function baseArxivId(arxivId) {
  // 2603.02190v1 -> 2603.02190
  return String(arxivId || '').replace(/v\d+$/i, '');
}

export function firstSentence(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const m = s.match(/(.{20,300}?[\.。！？!?])\s/);
  return (m ? m[1] : s.slice(0, 220)).trim();
}

export function extractGithubRepo(text) {
  const s = String(text || '');
  const m = s.match(/https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], url: `https://github.com/${m[1]}/${m[2]}` };
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function wrapText(str, maxChars) {
  // Simple char-based wrapper that works okay for CJK.
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const out = [];
  let i = 0;
  while (i < s.length) {
    out.push(s.slice(i, i + maxChars));
    i += maxChars;
  }
  return out;
}
