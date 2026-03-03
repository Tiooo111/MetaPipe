#!/usr/bin/env node
import http from 'node:http';
import { URL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { runPack } from './wf-core.js';

const PORT = Number(process.env.WF_API_PORT || 8787);

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && u.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'wf-api', port: PORT });
    }

    if (req.method === 'GET' && u.pathname === '/openapi.yaml') {
      const p = path.resolve('engine', 'openapi.yaml');
      const body = await fs.readFile(p, 'utf-8');
      res.writeHead(200, { 'content-type': 'application/yaml; charset=utf-8' });
      res.end(body);
      return;
    }

    if (req.method === 'POST' && (u.pathname.startsWith('/workflows/') || u.pathname.startsWith('/pipes/'))) {
      const m = u.pathname.match(/^\/(?:workflows|pipes)\/([^/]+)\/run$/);
      if (!m) return json(res, 404, { ok: false, error: 'not_found' });

      const pipeId = m[1];
      const body = await readJsonBody(req);
      const out = await runPack(pipeId, body);
      return json(res, 200, { ok: true, pipeId, result: out });
    }

    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e?.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(JSON.stringify({ ok: true, service: 'wf-api', port: PORT }));
});
