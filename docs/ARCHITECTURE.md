# MetaPipe Architecture

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

### 2) Workflow Pack (`packs/<pack-id>/`)
- `workflow.yaml`: orchestration graph + policy
- `roles.yaml`: role definition + executor defaults
- `tasks.yaml`: task breakdown
- `contracts/`: validation rules and schemas
- `templates/`: deterministic content templates
- `scripts/`: optional script executors

### 3) Business Pipe (`pipes/<pipe-id>/`)
- Domain-specific implementations built using MetaPipe
- Example: scholar radar pipeline

## Execution Model

1. Load pack + roles + contracts
2. Execute entry node
3. For each node:
   - task: run executor and validate outputs
   - gate: evaluate checks
   - router: route by deviation type
4. Persist state/events after each step
5. Produce final report + artifacts

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
