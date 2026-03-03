import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, ymdInTz } from './lib.js';

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buf);
}

async function main() {
  const args = process.argv.slice(2);
  const inIdx = args.indexOf('--in');
  const outIdx = args.indexOf('--outdir');
  if (inIdx === -1 || outIdx === -1) {
    console.error('Usage: node download_pdfs.js --in <selected.json> --outdir <dir>');
    process.exit(2);
  }
  const inPath = args[inIdx + 1];
  const outDir = args[outIdx + 1];

  const j = await readJson(inPath);
  const papers = j.papers || [];

  await ensureDir(outDir);

  const results = [];
  for (const p of papers) {
    const filename = `${p.arxivId}.pdf`.replace(/[^A-Za-z0-9_.-]/g, '_');
    const outPath = path.join(outDir, filename);
    try {
      await download(p.pdfUrl, outPath);
      results.push({ arxivId: p.arxivId, ok: true, path: outPath });
    } catch (e) {
      results.push({ arxivId: p.arxivId, ok: false, error: String(e) });
    }
  }

  console.log(JSON.stringify({ downloaded: results.filter((r) => r.ok).length, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
