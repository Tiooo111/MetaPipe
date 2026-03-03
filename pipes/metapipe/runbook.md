# Runbook

## Invocation
- CLI: `wf run metapipe --dry-run`
- API: `POST /workflows/metapipe/run` (JSON body: `{ "dryRun": true }`)
- StdIO RPC / MCP: `run_workflow` with params like `{ "packId": "metapipe", "dryRun": true }`

## Stage Gates
1. Alignment gate must pass before Design.
2. Design gate must pass before Build.
3. Verification must produce deviation classification.
4. Orchestrator routes deviations by matrix and re-runs impacted stage.

## Failure Handling
- Retry policy: 2 retries per node.
- Persistent failure: emit `handoff.md` with unresolved blockers.
