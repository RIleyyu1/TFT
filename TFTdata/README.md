# TFT Data Collector

Collects high-elo Teamfight Tactics match data from the Riot Games API for data visualization analysis.

Targets Challenger / Grandmaster / Master tier players on the NA server, extracting comps, traits, items, augments, and placement data.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your Riot API key
```

### Getting a Riot API Key

1. Go to [Riot Developer Portal](https://developer.riotgames.com/)
2. Sign in with your Riot account
3. Generate a **Development API Key** on the dashboard

> **Important:** Development keys expire every **24 hours**. You'll need to regenerate the key each session. For long-running collection, apply for a Production key.

## Usage

```bash
# Collect 1000 matches from all three tiers (default)
python main.py

# Collect from specific tiers only
python main.py --tiers challenger grandmaster

# Set a custom match count
python main.py --match-count 500

# Resume a previous collection
python main.py --resume

# Download Data Dragon static data (champion/item/trait name mappings)
python main.py --download-static

# Process existing raw data without collecting new matches
python main.py --process-only
```

### CLI Parameters

| Parameter | Default | Description |
|---|---|---|
| `--tiers` | challenger grandmaster master | Ranked tiers to pull seed players from |
| `--region` | na1 | Platform region (na1, euw1, kr) |
| `--match-count` | 1000 | Number of unique matches to collect |
| `--output-dir` | ./data | Output directory |
| `--resume` | off | Resume from previously collected data |
| `--download-static` | off | Download Data Dragon static data |
| `--process-only` | off | Skip collection, only process raw data |

## Output Files

All outputs go to `./data/processed/`:

| File | Description |
|---|---|
| `matches.csv` | One row per match — ID, datetime, length, version, set number |
| `participants.csv` | One row per player per match (8 per match) — placement, level, gold, damage, etc. |
| `units.csv` | One row per champion on a player's board — character, star level, cost, items |
| `traits.csv` | One row per active trait per player — name, units, activation tier |
| `augments.csv` | One row per augment selected (3 per player) — name and pick order |
| `summary_stats.json` | Aggregate stats — total matches, date range |

Raw match JSON files are saved in `./data/raw/`.

## Rate Limits

The collector implements a sliding-window rate limiter:
- **20 requests/second** and **100 requests/2 minutes** (Development key limits)
- Automatic retry on 429 (rate limited) with `Retry-After` header
- Exponential back-off on 5xx server errors

Collecting 1000 matches typically takes 30–60 minutes with a Development key.

## Project Structure

```
├── config.py          # Configuration from .env
├── collector.py       # Core API collection logic
├── rate_limiter.py    # Rate limit enforcement
├── data_processor.py  # Raw JSON → CSV/JSON transformation
├── main.py            # CLI entry point
├── .env.example       # Environment variable template
├── requirements.txt   # Python dependencies
└── data/
    ├── raw/           # Raw match JSON files
    └── processed/     # Clean CSV and JSON outputs
```
