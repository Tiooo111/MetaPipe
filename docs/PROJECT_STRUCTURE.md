# Project Structure Guide

This repository is organized by **framework capability**, not by one-off scripts.

## Top-level

- `engine/` — framework runtime and invocation surfaces
- `packs/` — reusable workflow packs (including Meta pack)
- `pipes/` — concrete business pipes built on MetaPipe
- `docs/` — architecture, structure, design docs

## Naming Rules

- Pack IDs: kebab-case (`workflow-pack-generator`)
- Pipe IDs: kebab-case (`scholar-radar`)
- Role names: kebab-case (`requirements-analyst`)
- Artifact names: snake_case or fixed pack names

## Pack Folder Contract

Each pack should contain:

```text
packs/<pack-id>/
├─ workflow.yaml
├─ roles.yaml
├─ tasks.yaml
├─ contracts/
├─ templates/
├─ scripts/        # optional
├─ examples/
└─ README.md
```

## Pipe Folder Contract

```text
pipes/<pipe-id>/
├─ config/
├─ scripts/
├─ output/
├─ papers/         # optional, domain artifacts
└─ README.md
```

## Backward Compatibility

Legacy paths should be preserved with symlinks during migration windows.
For now:
- `radar/ -> pipes/scholar-radar`

## What NOT to commit

- Runtime `.runs/`
- local secrets or local-only configs
- user workspace persona files (AGENTS/SOUL/USER/etc)
