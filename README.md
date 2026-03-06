# TFT Set 16 Meta Analysis — Interactive Data Visualization

**Live Site:** `https://github.com/RIleyyu1/TFT/frontend/index.html`  
**Screencast:** `https://www.youtube.com/watch?v=xxx` *(update after recording)*

---

## Overview and Motivation

Teamfight Tactics (TFT) is Riot Games' auto-battler where eight players compete by building champion compositions on a shared board. Each game involves hundreds of micro-decisions — which champions to buy, what items to build, which traits to activate — and results in a final placement from 1st to 8th. With millions of matches played daily, the game generates rich structured data, yet most players rely on tier lists and gut instinct rather than data-driven analysis.

This project provides an interactive visual exploration of the TFT Set 16 competitive meta, based on 1,000 high-elo matches (Challenger, Grandmaster, and Master tier) collected from the NA server via Riot Games' official API. Our goal is to answer three central questions:

1. **What does the meta look like?** Which champions dominate, how do they relate to each other, and what compositions emerge from the data?
2. **What separates winners from losers?** Which stats, items, and trait combinations most strongly predict a top-4 finish?
3. **Are all popular strategies equally effective?** Swain appears in nearly half of all games — but do all Swain-based compositions perform the same?

---


### What Is Our Code vs. Libraries
- **Our code:** Everything in `TFTdata/` (Python pipeline + EDA), everything in `frontend/js/` and `frontend/css/`, and `index.html`
- **Libraries:** d3.js v7 (loaded via CDN)
- **External assets:** Champion icons from Riot's [Data Dragon](https://ddragon.leagueoflegends.com/) CDN

---

## Data

### Source
All match data was collected from the [Riot Games Developer API](https://developer.riotgames.com/) using TFT-specific endpoints (TFT-League-v1, TFT-Summoner-v1, TFT-Match-v1).

### Collection Process
1. **Seed players:** Retrieved all Challenger / Grandmaster / Master tier players from the NA server via the League API
2. **Match history:** For each player (sorted by LP descending), fetched recent match IDs via the Match API (`americas` routing)
3. **Match details:** For each unique match ID, fetched full game data including all 8 participants' compositions, traits, items, and performance stats
4. **Rate limiting:** Token-bucket rate limiter respecting 20 req/sec and 100 req/2min, with exponential backoff on 429/5xx responses
5. **Deduplication & resume:** Matches are deduplicated across players; the pipeline supports checkpoint-based resume

The collection pipeline is in `TFTdata/` and can be run via:
```bash
cd TFTdata
pip install -r requirements.txt
python main.py --tiers challenger grandmaster master --match-count 1000
```
Requires a Riot API key in `.env` (see `.env.example`).

### Processed Data

All cleaned data lives in `TFTdata/data/processed/` (copied to `frontend/data/` for the website):

| File | Rows | Description |
|------|------|-------------|
| `matches.csv` | 1,000 | One row per match — timestamp, duration, patch version |
| `participants.csv` | 7,986 | One row per player per match — placement (1-8), level, damage, gold, rounds survived |
| `units.csv` | 70,414 | One row per champion on a player's final board — star level, cost, equipped items |
| `traits.csv` | 88,317 | One row per trait on a player's board — activation tier (style 0-4), unit count |

---

## Exploratory Data Analysis

Full EDA is in `TFTdata/tft_eda.ipynb` (with executed outputs in `tft_eda_after.ipynb`). Key findings:

**Champion meta:** Swain dominates with a 46% pick rate, serving as a hub connecting multiple compositions. Shyvana (41%) and Lucian (33%) are also highly picked. Fiddlesticks (~25%) is a hidden powerhouse with the best average placement among popular champions (~3.5), while Vi is a popular but underperforming trap pick (~5.0 avg).

**Cost = power:** Set 16's cost tiers (1/2/3/5/7/8/10) show a clear trend — 8-cost champions average placement 3.64 (best), while 1-cost champions average 4.77 (worst).

**Winning factors:** Total damage to players has the strongest correlation with placement (r = -0.88), followed by last round survived (-0.84). Gold remaining has near-zero correlation (0.06) — hoarding gold does not help.

**7 meta compositions** identified via KMeans clustering on champion co-occurrence:

| Comp | Core Champions | Top 4 Rate | Strength |
|------|---------------|------------|----------|
| Ambessa Carry | Ambessa, Swain, Bel'Veth, Fiddlesticks | 55.7% | Strongest |
| Void Monsters | RiftHerald, Cho'Gath, Swain, Wukong | 54.7% | Strong |
| Gunslinger | Nautilus, MissFortune, Lucian, Shyvana | 54.0% | Strong |
| Soulbound | Wukong, Yunara, Sett, Shen | 51.9% | Above average |
| Sorcerers | Loris, Seraphine, Braum, Orianna | 48.4% | Below average |
| Flex | Kennen, Kobuko, Wukong, Volibear | 47.4% |  |
| Loose Swain | Swain, Vi, Neeko (no tight core) | 44.9% |  |

**Trait structure:** Juggernaut is the most activated trait. Soulbound almost always reaches gold tier .


---

## Visualization Design

### Three Linked Views

**View A — Champion Co-occurrence Network Graph (main view)**  
Force-directed graph (`d3.forceSimulation`) of the Top 30 champions. Node size = pick rate, node color = average placement (green→red diverging scale), edge thickness = co-occurrence rate. Edges below 5% are hidden. Clicking a node highlights its neighborhood and updates Views B and C.

**View B — Trait Activation Bar Chart (top right)**  
Horizontal stacked bars showing Top 15 active traits, segmented by style level (bronze/silver/gold/prismatic). Linked to View A — selecting a champion filters to only its relevant traits.

**View C — Champion Detail Panel (bottom right)**  
On selection: placement distribution histogram, top 5 items, top 5 partner champions, and overall top-4 rate for the selected champion.

**Global Controls**  
Cost tier filter (toggles champion visibility in the graph) and composition selector (highlights one of the 7 meta compositions with aggregate stats).

### Design Rationale
Champion relationships are inherently graph-structured — traits create natural clusters, and co-occurrence reveals synergies and substitutions. The force layout spatially groups related champions without manual positioning. Linked views follow Shneiderman's mantra: overview first (network), zoom and filter (cost filter, comp selector), details on demand (detail panel).

---

## Non-Obvious Interface Features

- **Click a champion node** to activate linked views; **click the background** to reset all views
- **Hover any node** for a tooltip with champion stats and top 3 items
- **Drag nodes** to manually rearrange the force layout
- **Cost filter buttons** toggle visibility by cost tier — useful for isolating expensive carries
- **Composition selector** highlights a full meta comp and shows its aggregate win rate

---

## Evaluation

The visualization answers our three questions:

1. **Meta structure** is immediately visible — champions cluster by trait synergy in the network, with Swain clearly positioned as the central hub
2. **Winner predictors** are communicated through node color (green = strong placement), the detail panel (item recommendations, placement distributions), and the correlation insights from EDA

### Limitations and Future Work
- Data is a snapshot of one patch; a temporal view across patches would reveal meta evolution
- Augment data was unavailable due to a parsing issue; this dimension would enrich the analysis
- Clustering uses only Top 30 champion co-occurrence; incorporating items and traits could produce more nuanced composition definitions
- A backend server could enable real-time data updates while protecting the API key

---

## References

- Riot Games Developer API: https://developer.riotgames.com/
- Riot Games TFT API Documentation: https://developer.riotgames.com/docs/tft
- Data Dragon (static assets): https://ddragon.leagueoflegends.com/
- d3.js v7: https://d3js.org/
- d3-force documentation: https://github.com/d3/d3-force
- RiotWatcher Python library: https://riot-watcher.readthedocs.io/
- Hextechdocs (community API docs): https://hextechdocs.dev/
