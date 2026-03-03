# scholar-radar

Automation scaffolding for the `scholar` agent:

- Fetch daily arXiv papers (broad scan) in motion generation + HOI-related areas.
- Boost results by author/lab watchlists and trending signals (GitHub stars).
- Produce a **single vertical poster image** (1080×1920).
- Download PDFs for selected TopN.

## Quick test (inside the container)

```bash
cd /home/node/.openclaw/workspace-scholar/radar
node scripts/daily_fetch_and_rank.js
# then enrich the selected JSON with `summaryZh` fields (manually / via agent)
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
