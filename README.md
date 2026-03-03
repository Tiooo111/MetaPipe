# OpenPipe

OpenPipe is a **unified Pipe framework** for:

- multi-agent orchestration
- workflow/state-machine execution
- contract validation + deviation routing
- publishing/integration surfaces (CLI, REST, stdio RPC, MCP)

It includes a built-in meta pipe named **MetaPipe** (`pipes/metapipe`) that generates new pipes for other business tasks.

## Core Layers

1. **Framework Runtime** (`engine/`)
   - runner + policy engine (retry/timeout/backoff)
   - checkpoint/resume
   - contract validation
   - executor plugins (`template`, `shell`, `script`, `llm`)

2. **Pipes** (`pipes/`)
   - `metapipe/` (meta generator pipe)
   - `scholar-radar/` (business example)

3. **Docs** (`docs/`)
   - architecture and structure conventions

---

## Project Structure

```text
OpenPipe/
├─ engine/                 # Runtime and invocation surfaces
├─ pipes/
│  ├─ metapipe/            # Meta pipe: generate new pipes
│  └─ scholar-radar/       # Example business pipe
├─ packs/                  # Reserved for compatibility/legacy
├─ docs/
├─ package.json
└─ README.md
```

> Compatibility note: legacy path `radar/` is kept as a symlink to `pipes/scholar-radar`.

---

## Quick Start

```bash
cd /home/node/.openclaw/workspace-scholar
npm install
```

List workflows:

```bash
npm run wf:list
```

Run MetaPipe:

```bash
npm run wf:run -- metapipe --dry-run
```

REST call:

```bash
npm run wf:api
curl -X POST http://127.0.0.1:8787/workflows/metapipe/run \
  -H 'content-type: application/json' \
  -d '{"dryRun": true}'
```

MCP server:

```bash
npm run wf:mcp
```

---

## Produced Run Artifacts

Each run writes under `.runs/<run-id>/`:

- `execution_report.json`
- `execution_state.json` (checkpoint)
- `execution_events.jsonl` (timeline)
- declared workflow artifacts

---

## Docs

- `docs/ARCHITECTURE.md`
- `docs/PROJECT_STRUCTURE.md`
- `engine/README.md`
- `pipes/metapipe/README.md`

---

## Next Milestones

- Executor registry + versioned plugin API
- Built-in publisher adapters
- Pipe scaffolding command (`wf scaffold <pipe-id>`)
