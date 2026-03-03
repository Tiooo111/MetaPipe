# Project Structure Guide

OpenPipe is organized around a framework runtime plus reusable pipes.

## Top-level

- `engine/` — runtime and invocation surfaces
- `pipes/` — pipe implementations (meta + business)
- `packs/` — legacy/compatibility layer
- `docs/` — architecture and standards

## Naming Rules

- Pipe IDs: kebab-case (`metapipe`, `scholar-radar`)
- Role names: kebab-case (`requirements-analyst`)
- Artifact names: snake_case or fixed names from contracts

## Pipe Folder Contract

```text
pipes/<pipe-id>/
├─ workflow.yaml
├─ roles.yaml
├─ tasks.yaml
├─ contracts/
├─ templates/
├─ scripts/        # optional
├─ examples/
└─ README.md
```

## Business Pipe Contract (domain-heavy)

```text
pipes/<pipe-id>/
├─ config/
├─ scripts/
├─ output/
├─ papers/         # optional domain artifacts
└─ README.md
```

## Backward Compatibility

Legacy paths can be preserved with symlinks during migration windows.
Current compatibility links:
- `radar/ -> pipes/scholar-radar`

## What NOT to commit

- Runtime `.runs/`
- local secrets or local-only configs
- user workspace persona/runtime files (AGENTS/SOUL/USER/etc)
