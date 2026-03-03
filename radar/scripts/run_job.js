import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readJson, ymdInTz } from './lib.js';

const execFileP = promisify(execFile);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const args = { kind: 'daily', dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!args.kind && !a.startsWith('-')) args.kind = a;
    else if (a === '--kind') args.kind = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force') args.force = true;
  }
  // positional: node run_job.js daily
  const pos = argv.find((x) => !x.startsWith('-'));
  if (pos && !['--kind', '--dry-run', '--force'].includes(pos)) args.kind = pos;
  return args;
}

async function loadLocalConfig() {
  const p = path.join(ROOT, 'config', 'local.json');
  if (!(await exists(p))) return null;
  return readJson(p);
}

async function runNode(script, args = []) {
  const p = path.join(ROOT, 'scripts', script);
  const { stdout, stderr } = await execFileP('node', [p, ...args], { cwd: ROOT, timeout: 15 * 60 * 1000 });
  return { stdout, stderr };
}

async function sendWhatsapp({ to, message, mediaPath, dryRun }) {
  if (dryRun) {
    return { ok: true, skipped: true, to, message, mediaPath };
  }

  const argv = ['message', 'send', '--channel', 'whatsapp', '--target', to, '--message', message];
  if (mediaPath) argv.push('--media', mediaPath);

  const { stdout, stderr } = await execFileP('openclaw', argv, { cwd: ROOT, timeout: 60 * 1000 });
  return { ok: true, stdout, stderr };
}


function shortText(s, max = 140) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function fmtList(papers, limit = 10) {
  const lines = [];
  const top = papers.slice(0, limit);
  for (let i = 0; i < top.length; i++) {
    const p = top[i];
    const idx = String(i + 1).padStart(2, '0');
    const sig = [];
    if (p.signals?.watchHit) sig.push('WATCH');
    if (p.signals?.hfTrending?.rank) sig.push(`HF#${p.signals.hfTrending.rank}`);
    if (p.signals?.github?.stars) sig.push(`⭐${p.signals.github.stars}`);
    const sigTxt = sig.length ? ` (${sig.join(', ')})` : '';

    lines.push(`${idx}. ${p.title}${sigTxt}`);
    lines.push(`链接: ${p.absUrl}`);
    lines.push(`作者陈述: ${shortText(p.authorView || p.summary, 110)}`);
    lines.push(`专家评议: ${shortText(p.expertReview, 110)}`);
    lines.push(`研究落地: ${shortText(p.scholarTakeaway, 130)}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const kind = String(args.kind || 'daily').toLowerCase();

  const local = await loadLocalConfig();
  const to = local?.delivery?.to || process.env.SCHOLAR_WHATSAPP_TARGET;
  if (!to) {
    console.error('Missing WhatsApp target. Set radar/config/local.json delivery.to or SCHOLAR_WHATSAPP_TARGET env.');
    process.exit(2);
  }

  const settings = await readJson(path.join(ROOT, 'config', 'settings.json'));
  const tz = settings.timezone || 'Asia/Shanghai';

  // Guard: monthly report only runs on the last day of month (unless --force).
  if (kind === 'monthly' && !args.force) {
    const now = new Date();
    const today = ymdInTz(now, tz);
    const tomorrow = ymdInTz(new Date(now.getTime() + 24 * 3600 * 1000), tz);
    if (today.slice(0, 7) === tomorrow.slice(0, 7)) {
      console.log(JSON.stringify({ ok: true, skipped: true, kind, reason: 'not_last_day_of_month', date: today, tz }, null, 2));
      return;
    }
  }

  // 1) Fetch + rank
  const r1 = await runNode('fetch_and_rank.js', ['--kind', kind]);
  const j1 = JSON.parse(r1.stdout.trim().split('\n').pop());

  const selectedPath = path.resolve(ROOT, j1.selectedPath);
  const selected = await readJson(selectedPath);

  // 2) Enrich (three-block description)
  const enrichedPath = selectedPath.replace(/\.selected\.json$/i, '.enriched.json');
  await runNode('enrich_selected.js', ['--in', selectedPath, '--out', enrichedPath, '--kind', kind]);
  const enriched = await readJson(enrichedPath);

  // 3) Render poster
  const posterPath = selectedPath.replace(/\.selected\.json$/i, '.poster.png');
  await runNode('render_poster.js', ['--in', enrichedPath, '--out', posterPath]);

  // 4) Download PDFs
  const papersDir = path.join(ROOT, 'papers', kind, selected.date || j1.date);
  await runNode('download_pdfs.js', ['--in', selectedPath, '--outdir', papersDir]);

  // 5) Send to WhatsApp
  // openclaw message send restricts local media paths to safe allowlisted roots.
  // Stage the poster into the main workspace to satisfy the allowlist.
  const stageRoot = '/home/node/.openclaw/workspace/media-out/scholar-radar';
  const stageDir = path.join(stageRoot, kind, enriched.date || selected.date || j1.date);
  await fs.mkdir(stageDir, { recursive: true });
  const stagedPoster = path.join(stageDir, path.basename(posterPath));
  await fs.copyFile(posterPath, stagedPoster);

  const caption = `${enriched?.title || `Scholar Radar · ${j1.date}`}\n${enriched?.subtitle || ''}\n一图流（精简高价值版）`.trim();
  await sendWhatsapp({ to, message: caption, mediaPath: stagedPoster, dryRun: args.dryRun });

  const listMsg = fmtList(enriched.papers || [], kind === 'daily' ? 8 : 10);
  if (listMsg) {
    await sendWhatsapp({ to, message: listMsg, mediaPath: null, dryRun: args.dryRun });
  }

  console.log(JSON.stringify({ ok: true, kind, to, selectedPath, enrichedPath, posterPath, papersDir, count: selected.count }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
