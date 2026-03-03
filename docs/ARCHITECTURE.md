# OpenPipe Architecture

## Layers

### 1) Runtime Engine (`engine/`)
- `wf-runner.js`: workflow execution core
- `wf-cli.js`: CLI surface
- `wf-api.js`: REST API surface
- `wf-rpc-stdio.js`: stdio JSON-RPC surface
- `wf-mcp-server.js`: MCP tool surface
- `wf-core.js`: shared run/list utilities

Responsibilities:
- Node execution (task/gate/router)
- Retry/timeout/backoff policy
- Contract validation (rules + schema)
- Checkpoint/resume
- Event/audit output
- Executor plugin routing (`template`, `shell`, `script`, `llm`)

### 2) Pipes (`pipes/<pipe-id>/`)
- `workflow.yaml`: orchestration graph + policy
- `roles.yaml`: role definition + executor defaults
- `tasks.yaml`: task breakdown
- `contracts/`: validation rules and schemas
- `templates/`: deterministic content templates
- `scripts/`: optional script executors

Primary pipes:
- `metapipe` (meta generator)
- `scholar-radar` (example business pipe)

### 3) Compatibility Layer (`packs/`)
- Reserved for legacy/compatibility migration

## Execution Model

1. Resolve pipe workflow
2. Load roles + contracts
3. Execute entry node
4. For each node:
   - task: run executor and validate outputs
   - gate: evaluate checks
   - router: route by deviation type
5. Persist state/events after each step
6. Produce final report + artifacts

## Deviation Loop

Deviations are classified and routed back to designated stages/roles:
- requirements mismatch -> requirements stage
- architecture mismatch -> design stage
- implementation bug -> build stage
- verification gap -> verify stage

## Invocation Surfaces

- CLI (`wf`)
- REST (`/workflows/:packId/run`)
- StdIO RPC (`list_workflows`, `run_workflow`)
- MCP tools (`list_workflows`, `run_workflow`)
