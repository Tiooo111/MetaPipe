import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const WORKFLOW_DIRS = ['pipes', 'packs'];

export function isSafePackId(packId) {
  return /^[a-zA-Z0-9._-]+$/.test(packId || '');
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function resolveWorkflowPath(packId) {
  if (!isSafePackId(packId)) return null;

  for (const baseDir of WORKFLOW_DIRS) {
    const p = path.resolve(baseDir, packId, 'workflow.yaml');
    if (await fileExists(p)) return p;
  }
  return null;
}

export async function listPacks() {
  const names = new Set();

  for (const baseDir of WORKFLOW_DIRS) {
    const base = path.resolve(baseDir);
    let dirs = [];
    try {
      dirs = await fs.readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const wf = path.join(base, d.name, 'workflow.yaml');
      if (await fileExists(wf)) names.add(d.name);
    }
  }

  return [...names].sort();
}

function parseRunnerOutput(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    return JSON.parse(s >= 0 && e > s ? text.slice(s, e + 1) : '{}');
  }
}

export async function runPack(packId, opts = {}) {
  if (!isSafePackId(packId)) {
    throw new Error(`invalid_pack_id:${packId}`);
  }

  const workflow = await resolveWorkflowPath(packId);
  if (!workflow) {
    throw new Error(`workflow_not_found:${packId}`);
  }

  const args = ['engine/wf-runner.js', '--workflow', workflow];

  if (opts.runDir) args.push('--run-dir', String(opts.runDir));
  if (opts.resumeRunDir) args.push('--resume-run-dir', String(opts.resumeRunDir));
  if (Number.isFinite(opts.maxSteps)) args.push('--max-steps', String(opts.maxSteps));
  if (opts.dryRun) args.push('--dry-run');
  if (opts.injectDeviation) args.push('--inject-deviation', String(opts.injectDeviation));

  const { stdout, stderr } = await execFileP('node', args, {
    cwd: process.cwd(),
    timeout: 10 * 60 * 1000,
  });

  return {
    ...parseRunnerOutput(stdout),
    stderr: String(stderr || ''),
  };
}
