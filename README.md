# MetaPipe

MetaPipe is a **unified framework for building and running Pipes**:

- Agent orchestration (multi-role)
- Workflow execution (state-machine / DAG style)
- Contract validation + deviation routing
- Publishing/integration surfaces (CLI, REST, stdio RPC, MCP)

It also ships with a **Meta Workflow Pack** (`workflow-pack-generator`) that can generate new workflow packs for other business tasks.

## Core Idea

MetaPipe separates concerns into 3 layers:

1. **Framework Runtime** (`engine/`)
   - Executes workflow packs
   - Handles retries/timeouts/backoff, checkpoint/resume, contract checks
   - Supports executor plugins (`template`, `shell`, `script`, `llm`)

2. **Workflow Packs** (`packs/`)
   - Pack-specific orchestration logic
   - Roles, contracts, templates, and routing rules

3. **Business Pipes** (`pipes/`)
   - Real task pipelines built on the framework
   - Example: `pipes/scholar-radar`

---

## Project Structure

```text
MetaPipe/
├─ engine/                       # Framework runtime (CLI/API/RPC/MCP + runner)
├─ packs/
│  └─ workflow-pack-generator/   # Meta pack: generate new workflow packs
├─ pipes/
│  └─ scholar-radar/             # Example business pipe
├─ docs/                         # Architecture + structure docs
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

List available packs:

```bash
npm run wf:list
```

Run meta pack:

```bash
npm run wf:run -- workflow-pack-generator --dry-run
```

Run via API:

```bash
npm run wf:api
curl http://127.0.0.1:8787/health
curl -X POST http://127.0.0.1:8787/workflows/workflow-pack-generator/run \
  -H 'content-type: application/json' \
  -d '{"dryRun": true}'
```

Run via MCP server:

```bash
npm run wf:mcp
```

---

## What MetaPipe Produces

A run writes a complete artifact set under `.runs/<run-id>/`, including:

- `execution_report.json`
- `execution_state.json` (resume checkpoint)
- `execution_events.jsonl` (timeline)
- Pack-declared artifacts (requirements/design/tasks/verification/manifest)

---

## Docs

- `docs/ARCHITECTURE.md`
- `docs/PROJECT_STRUCTURE.md`
- `engine/README.md`
- `packs/workflow-pack-generator/README.md`

---

## Roadmap (next)

- Executor registry + versioned plugin interface
- Richer role-specific LLM prompts and output schemas
- Built-in publisher adapters (GitHub/Notion/Slack/WhatsApp/etc)
- Pack scaffolding command (`wf scaffold <name>`)
