# scholar-radar

Automation scaffolding for the `scholar` agent:

- Fetch daily arXiv papers (broad scan) in motion generation + HOI-related areas.
- Boost results by author/lab watchlists and trending signals (GitHub stars).
- Produce a **single vertical poster image** (1080×1920).
- Download PDFs for selected TopN.

## Quick test (inside the container)

```bash
cd /home/node/.openclaw/workspace-scholar/pipes/scholar-radar
node scripts/fetch_and_rank.js --kind daily
node scripts/enrich_selected.js --in output/daily/$(date +%F).selected.json --out output/daily/$(date +%F).enriched.json --kind daily
node scripts/render_poster.js --in output/daily/$(date +%F).enriched.json --out output/daily/$(date +%F).poster.png
```

Or run the full pipeline + WhatsApp send:

```bash
node scripts/run_job.js daily
```

## Config

- `config/settings.json`
- `config/watchlist.json`
- `config/keywords.json`

## Output

- `output/daily/YYYY-MM-DD.selected.json`
- `output/daily/YYYY-MM-DD.candidates.json`

## Notes

Rendering uses ImageMagick `convert` and the system CJK font `WenQuanYi Zen Hei`.
