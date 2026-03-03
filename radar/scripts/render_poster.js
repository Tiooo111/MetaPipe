import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readJson, firstSentence, wrapText } from './lib.js';

const execFileP = promisify(execFile);

function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sectionLines(text, maxChars, maxLines) {
  return wrapText(String(text || '').trim(), maxChars).slice(0, maxLines);
}

function buildCardModels(papers) {
  return papers.map((p, i) => {
    const idx = String(i + 1).padStart(2, '0');
    const title = `${idx}. ${p.title || 'Untitled'}`;
    const titleLines = wrapText(title, 36).slice(0, 2);

    const tags = Array.isArray(p.tags) && p.tags.length ? p.tags.join(', ') : '—';
    const metaBase = `${p.arxivId || ''}  ·  ${tags}`.trim();
    const metaLines = wrapText(metaBase, 62).slice(0, 2);

    const badges = [];
    if (p.signals?.watchHit) badges.push('WATCHLIST');
    if (p.signals?.hfTrending?.rank) badges.push(`HF TREND #${p.signals.hfTrending.rank}`);
    if (p.signals?.github?.stars) badges.push(`⭐ ${p.signals.github.stars}`);
    const badgeLine = badges.join('   ·   ');

    const fallbackSummary = (p.summaryZh || p.summary || firstSentence(p.abstract) || '').trim();
    const authorView = p.authorView || `作者视角：${fallbackSummary}`;
    const expertReview = p.expertReview || '顶级AI评审：问题设置和实验设计有参考价值，建议关注泛化与复现成本。';
    const scholarTakeaway = p.scholarTakeaway || '学者即插即用：先复用关键模块做 A/B；未来启发：沿泛化与效率方向迭代。';

    const authorLines = sectionLines(authorView, 52, 2);
    const reviewLines = sectionLines(expertReview, 52, 2);
    const takeawayLines = sectionLines(scholarTakeaway, 52, 3);

    const topPad = 30;
    const bottomPad = 26;
    const titleH = titleLines.length * 38;
    const metaH = Math.max(1, metaLines.length) * 24;
    const badgeH = badgeLine ? 30 : 0;

    const sectionH = (lines) => 30 + Math.max(1, lines.length) * 28 + 8;

    const height =
      topPad +
      titleH + 10 +
      metaH +
      (badgeH ? badgeH + 6 : 0) +
      sectionH(authorLines) +
      sectionH(reviewLines) +
      sectionH(takeawayLines) +
      bottomPad;

    return {
      ...p,
      idx,
      titleLines,
      metaLines,
      badgeLine,
      authorLines,
      reviewLines,
      takeawayLines,
      cardHeight: Math.max(380, height)
    };
  });
}

function mkSvg({ width, minHeight, fontFamily, title, subtitle, footer, papers }) {
  const marginX = 44;
  const top = 44;
  const headerH = 210;
  const gap = 26;
  const footerH = 80;
  const cardW = width - marginX * 2;

  const cards = buildCardModels(papers);
  const cardsTotalH = cards.reduce((acc, c) => acc + c.cardHeight, 0) + Math.max(0, cards.length - 1) * gap;

  const computedHeight = top + headerH + 24 + cardsTotalH + footerH + 30;
  const height = Math.max(minHeight || 1920, computedHeight);

  const headerTitle = title || 'Scholar Radar';
  const headerSubtitle = subtitle || `Top ${cards.length} · signals: watchlist + broad scan + trending`;
  const footerText = footer || '三板块：作者视角 / 顶级AI评审 / 学者即插即用+未来启发';

  let svg = '';
  svg += `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;

  svg += `<defs>`;
  svg += `<linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">`;
  svg += `<stop offset="0%" stop-color="#eef3ff"/>`;
  svg += `<stop offset="55%" stop-color="#f7f9ff"/>`;
  svg += `<stop offset="100%" stop-color="#fcfdff"/>`;
  svg += `</linearGradient>`;

  svg += `<linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">`;
  svg += `<stop offset="0%" stop-color="#2563eb"/>`;
  svg += `<stop offset="100%" stop-color="#7c3aed"/>`;
  svg += `</linearGradient>`;

  svg += `<linearGradient id="accentGrad" x1="0" y1="0" x2="0" y2="1">`;
  svg += `<stop offset="0%" stop-color="#60a5fa"/>`;
  svg += `<stop offset="100%" stop-color="#8b5cf6"/>`;
  svg += `</linearGradient>`;

  svg += `<filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">`;
  svg += `<feDropShadow dx="0" dy="7" stdDeviation="8" flood-color="#0f172a" flood-opacity="0.13"/>`;
  svg += `</filter>`;
  svg += `</defs>`;

  // Background
  svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#bgGrad)"/>`;
  svg += `<circle cx="${width - 90}" cy="90" r="120" fill="#93c5fd" opacity="0.22"/>`;
  svg += `<circle cx="120" cy="${Math.max(200, height - 120)}" r="140" fill="#c4b5fd" opacity="0.18"/>`;

  // Header panel
  svg += `<rect x="${marginX}" y="${top}" width="${cardW}" height="${headerH}" rx="30" fill="url(#heroGrad)" filter="url(#shadow)"/>`;
  svg += `<text x="${marginX + 30}" y="${top + 78}" font-family="${esc(fontFamily)}" font-size="50" font-weight="800" fill="#ffffff">${esc(headerTitle)}</text>`;
  svg += `<text x="${marginX + 30}" y="${top + 122}" font-family="${esc(fontFamily)}" font-size="26" font-weight="500" fill="#e0e7ff">${esc(headerSubtitle)}</text>`;
  svg += `<text x="${marginX + 30}" y="${top + 166}" font-family="${esc(fontFamily)}" font-size="22" font-weight="600" fill="#dbeafe">三板块：作者视角｜顶级AI评审｜学者即插即用+未来启发</text>`;
  svg += `<text x="${marginX + 30}" y="${top + 196}" font-family="${esc(fontFamily)}" font-size="20" font-weight="500" fill="#dbeafe">单列长图 · 大间距排版 · 避免文字重叠</text>`;

  const drawSection = (x, y, label, color, lines) => {
    let ty = y;
    svg += `<text x="${x}" y="${ty}" font-family="${esc(fontFamily)}" font-size="23" font-weight="800" fill="${color}">${esc(label)}</text>`;
    ty += 30;
    for (const line of lines) {
      svg += `<text x="${x}" y="${ty}" font-family="${esc(fontFamily)}" font-size="24" font-weight="500" fill="#1f2937">${esc(line)}</text>`;
      ty += 28;
    }
    return ty + 8;
  };

  let y = top + headerH + 24;
  for (const p of cards) {
    const x = marginX;
    const h = p.cardHeight;

    // Card
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="${h}" rx="26" fill="#ffffff" stroke="#dbe3ff" stroke-width="2" filter="url(#shadow)"/>`;
    svg += `<rect x="${x}" y="${y}" width="12" height="${h}" rx="26" fill="url(#accentGrad)"/>`;

    let ty = y + 50;
    for (const line of p.titleLines) {
      svg += `<text x="${x + 34}" y="${ty}" font-family="${esc(fontFamily)}" font-size="34" font-weight="800" fill="#0f172a">${esc(line)}</text>`;
      ty += 38;
    }

    ty += 2;
    for (const line of p.metaLines) {
      svg += `<text x="${x + 34}" y="${ty}" font-family="${esc(fontFamily)}" font-size="22" font-weight="500" fill="#334155">${esc(line)}</text>`;
      ty += 24;
    }

    if (p.badgeLine) {
      ty += 8;
      svg += `<text x="${x + 34}" y="${ty}" font-family="${esc(fontFamily)}" font-size="21" font-weight="700" fill="#4f46e5">${esc(p.badgeLine)}</text>`;
      ty += 26;
    }

    ty += 8;
    ty = drawSection(x + 34, ty, '作者视角', '#1d4ed8', p.authorLines);
    ty = drawSection(x + 34, ty, '顶级AI评审', '#7c2d12', p.reviewLines);
    ty = drawSection(x + 34, ty, '学者即插即用 + 未来启发', '#065f46', p.takeawayLines);

    y += h + gap;
  }

  svg += `<text x="${marginX}" y="${height - 24}" font-family="${esc(fontFamily)}" font-size="18" fill="#475569">${esc(footerText)}</text>`;

  svg += `</svg>`;
  return { svg, height };
}

async function main() {
  const args = process.argv.slice(2);
  const inIdx = args.indexOf('--in');
  const outIdx = args.indexOf('--out');

  if (inIdx === -1 || outIdx === -1) {
    console.error('Usage: node render_poster.js --in <enriched.json> --out <poster.png>');
    process.exit(2);
  }

  const inPath = args[inIdx + 1];
  const outPath = args[outIdx + 1];

  const enriched = await readJson(inPath);
  const settingsPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'config', 'settings.json');
  const settings = await readJson(settingsPath);

  const width = settings.poster.width || 1080;
  const minHeight = settings.poster.height || 1920;
  const fontFamily = settings.poster.fontFamily || 'WenQuanYi Zen Hei';
  const date = enriched.date || 'unknown';
  const papers = enriched.papers || [];

  const title = enriched.title || `Scholar Radar · ${date} · Motion + HOI`;
  const subtitle = enriched.subtitle || `Top ${papers.length} · signals: watchlist + broad scan + trending`;

  const { svg, height } = mkSvg({ width, minHeight, fontFamily, title, subtitle, footer: enriched.footer, papers });
  const tmpSvg = outPath.replace(/\.png$/i, '.svg');

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(tmpSvg, svg, 'utf-8');

  // Rasterize SVG to PNG
  await execFileP('convert', ['-density', '120', tmpSvg, outPath]);

  console.log(JSON.stringify({ ok: true, outPath, svgPath: tmpSvg, count: papers.length, width, height }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
