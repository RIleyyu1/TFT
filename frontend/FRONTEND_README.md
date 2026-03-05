# TFT Set 16 — Interactive Data Visualization (Frontend Handoff)

## Project Overview

This is a **Data Visualization** course final project. We've already collected **1,000 high-elo TFT matches** (Challenger/Grandmaster/Master, NA server) from the Riot Games API, and completed exploratory data analysis. Your job is to build the **interactive frontend** using **d3.js**.

The story we want to tell: **"The Set 16 meta revolves around Swain, but not all Swain comps are created equal."** Users should be able to explore champion relationships, discover the 7 meta compositions, and understand what separates winners from losers.

### Course Requirements
- Must use **d3.js** as the primary visualization library (no nvd3, no chart wrappers)
- Other UI libraries (React, Svelte, Material UI, etc.) are allowed
- Must be hosted on **GitHub Pages**
- Must include an embedded **2-minute screencast** on the page
- Process Book (PDF) and data should be linked from the site

---

## Data Files

All files are in `data/processed/`. Already cleaned and ready to use.

### matches.csv (1,000 rows)
Each row = one match.

| Column | Type | Description |
|--------|------|-------------|
| match_id | string | Unique match identifier |
| game_datetime | string | ISO timestamp |
| game_length | float | Duration in seconds |
| game_version | string | Patch version |
| tft_set_number | int | Always 16 |

### participants.csv (7,986 rows)
Each row = one player in one match (8 per match, some missing).

| Column | Type | Description |
|--------|------|-------------|
| match_id | string | Links to matches.csv |
| puuid | string | Player unique ID |
| placement | int | Final rank 1-8 (1 = first place) |
| level | int | Player level at end of game |
| last_round | int | Last round survived |
| time_eliminated | float | Seconds survived |
| players_eliminated | int | How many opponents this player knocked out |
| total_damage_to_players | int | Total damage dealt to other players |
| gold_left | int | Gold remaining at end |

### units.csv (70,414 rows)
Each row = one champion on a player's board at end of game.

| Column | Type | Description |
|--------|------|-------------|
| match_id | string | Links to matches.csv |
| puuid | string | Links to participants.csv |
| character_id | string | Champion ID with prefix, e.g. `TFT16_Swain` |
| tier | int | Star level (1, 2, or 3) |
| rarity | int | Cost tier (0=1-cost, 1=2-cost, 2=3-cost, 4=5-cost, 6=7-cost, 7=8-cost, 9=10-cost) |
| items | string | JSON array of item IDs, e.g. `['TFT_Item_GuinsoosRageblade', ...]` |

**Important:** Strip the `TFT16_` prefix from `character_id` and `TFT_Item_` / `TFT16_Item_` from items for display.

### traits.csv (88,317 rows)
Each row = one trait on a player's board.

| Column | Type | Description |
|--------|------|-------------|
| match_id | string | Links to matches.csv |
| puuid | string | Links to participants.csv |
| name | string | Trait ID with prefix, e.g. `TFT16_Juggernaut` |
| num_units | int | Number of units contributing to this trait |
| style | int | Activation tier: 0=inactive, 1=bronze, 2=silver, 3=gold, 4=prismatic |
| tier_current | int | Current breakpoint reached |
| tier_total | int | Total breakpoints available |

**Important:** Only rows with `style > 0` are actually activated.

---

## EDA Key Findings (What You Need to Know)

### Champion Landscape
- **141 unique champions**, but the Top 30 dominate the meta
- **Swain** is the most picked champion (46% pick rate), acts as a "hub" connecting multiple compositions
- **Shyvana** (41%) and **Lucian** (33%) are both highly picked AND have strong avg placements (~3.6-3.8)
- **Fiddlesticks** (~25% pick rate) is a hidden powerhouse with one of the best avg placements (~3.5)
- **Vi** is a trap — decent pick rate but worst avg placement (~5.0) among Top 20

### Cost = Power
The cost system in Set 16 is non-standard: 1/2/3/5/7/8/10-cost (not 1-5).
- 8-cost champions → avg placement **3.64** (best)
- 7-cost → **3.92**
- 1-cost → **4.77** (worst)
- 10-cost → **4.28** (not the best, likely due to special conditions)

### Top Traits
- **Juggernaut** is the most activated trait by far
- **Brawler** and **ShyvanaUnique** are #2 and #3
- **Soulbound** almost always reaches Style 3 (gold) — people commit to it fully
- **Targon** mostly stuck at Style 1 — it's just a splash trait

### Items
- **Guinsoo's Rageblade** is #1 used item (~3,900 times), mainly on Yunara and Kaisa
- **Redemption** is the top tank item, mainly on Wukong and RiftHerald
- Offensive items (IE, Jeweled Gauntlet) cluster on specific carries
- Defensive items (Red Buff, Spectral Gauntlet) spread across frontline tanks

### Correlations with Placement
| Stat | Correlation with Placement | Interpretation |
|------|---------------------------|----------------|
| total_damage_to_players | **-0.88** | Strongest predictor of winning |
| last_round | -0.84 | Surviving longer = better placement |
| time_eliminated | -0.82 | Same as above |
| players_eliminated | -0.70 | Knocking out opponents matters |
| level | -0.52 | Higher level helps but isn't everything |
| gold_left | **0.06** | Hoarding gold doesn't help |

### 7 Meta Compositions (from KMeans Clustering)

| Comp | Name Suggestion | Core Champions | Avg Placement | Top 4 Rate | Notes |
|------|----------------|---------------|---------------|------------|-------|
| 5 | **Ambessa Carry** | Ambessa, Swain, Bel'Veth, Fiddlesticks, Sion | **4.25** | **55.7%** | Best comp in the meta |
| 4 | **Void Monsters** | RiftHerald, Cho'Gath, Swain, Wukong, Volibear | 4.28 | 54.7% | Very strong, Void synergy |
| 6 | **Gunslinger/ADC** | Nautilus, MissFortune, Lucian, Shyvana, Kindred | 4.25 | 54.0% | Ranged carry focused |
| 1 | **Soulbound** | Wukong, Yunara, Sett, Shen, Kindred | 4.41 | 51.9% | Solid, trait-committed |
| 3 | **Sorcerers** | Loris, Seraphine, Braum, Orianna, Vi, Azir | 4.57 | 48.4% | Below average |
| 7 | **Flex/Transition** | Kennen, Kobuko, Wukong, Volibear | 4.60 | 47.4% | Lacks clear direction |
| 2 | **Loose Swain** | Swain, Vi, Neeko (no tight core) | **4.77** | **44.9%** | Worst — just "good stuff" pile |

The dendrogram shows Comp 4 and Comp 5 are closely related (both use Swain + expensive units). Comp 2 and Comp 7 are also similar (loose, no commitment).

---

## Visualization Design Spec

### Layout (3 linked views)

```
┌──────────────────────────────┬───────────────────────┐
│                              │   View B:             │
│   View A:                    │   Trait Activation     │
│   Champion Co-occurrence     │   Bar Chart            │
│   Force-Directed Network     │   (Top 15 traits,     │
│   Graph                      │    stacked by style)  │
│                              ├───────────────────────┤
│                              │   View C:             │
│                              │   Champion Detail     │
│                              │   Panel               │
│                              │   (items, placement   │
│                              │    dist, best pairs)  │
├──────────────────────────────┴───────────────────────┤
│   Global Filters: Cost slider [1-10] | Comp selector │
└──────────────────────────────────────────────────────┘
```

### View A — Champion Network Graph (Main View)

**What it shows:** How often champions appear together on the same board.

**Data prep (can do in JS at load time):**
1. Load `units.csv`, strip `TFT16_` prefix
2. Group by `(match_id, puuid)` to get each player's board
3. For Top 30 champions, compute pairwise co-occurrence rate (%)
4. Merge with `participants.csv` to get avg placement per champion

**Visual encoding:**
- **Nodes** = Top 30 champions
- **Node size** = pick rate (% of boards containing this champion)
- **Node color** = avg placement, diverging scale (green ≤ 4.0 = strong, red ≥ 5.0 = weak)
- **Edges** = co-occurrence rate between two champions
- **Edge thickness** = co-occurrence %, hide edges below 5% threshold
- **Edge opacity** = also maps to co-occurrence rate

**Interactions:**
- **Hover** on node → tooltip with: champion name, cost, pick rate, avg placement, top 3 items
- **Click** on node → highlight all connected champions (dim others to 20% opacity), update View B to show only traits relevant to this champion, update View C with champion details
- **Click** on background → reset all views
- **Drag** nodes to rearrange (d3-force)
- Use `d3.forceSimulation()` with `forceLink`, `forceManyBody`, `forceCenter`

**Champion icons:** Load from Data Dragon CDN:
```
https://ddragon.leagueoflegends.com/cdn/latest/img/tft-champion/TFT16_{ChampionName}.png
```
(Test this URL — may need to check exact path for Set 16)

### View B — Trait Bar Chart (Top Right)

**Default state:** Top 15 traits by activation frequency, horizontal bars stacked by style level.

**Visual encoding:**
- Horizontal stacked bar chart
- Colors per style: Style 1 = light blue, Style 2 = medium blue, Style 3 = dark blue, Style 4 = gold/orange
- Sorted by total activation count, descending

**Linked interaction:**
- When a champion is selected in View A → filter to only show traits that champion belongs to
- Animate the transition (bars slide out/in)

### View C — Champion Detail Panel (Bottom Right)

**Triggered by:** Clicking a champion node in View A.

**Default state (nothing selected):** Show a summary card — "Click a champion to explore" + overall meta stats (total matches, most popular comp, etc.)

**When a champion is selected, show:**

1. **Header:** Champion icon + name + cost
2. **Placement distribution:** Small histogram (8 bars for placement 1-8) for games where this champion was on the board
3. **Best items (Top 5):** Horizontal bar chart of most frequently equipped items on this champion
4. **Best partners (Top 5):** List of champions most often appearing on the same board, with their co-occurrence rate
5. **Win rate badge:** Top 4 rate % when this champion is played

### Global Controls

- **Champion cost filter:** Range slider or button group (1 / 2 / 3 / 5 / 7 / 8 / 10), toggles which cost tiers are visible in the network graph
- **Composition highlighter:** Dropdown or buttons for the 7 identified comps — selecting one highlights those champions in the network graph and shows comp stats

---

## Visual Design

### Color Palette (TFT-inspired dark theme)
```css
--bg-primary: #0a0e1a;        /* Dark navy background */
--bg-secondary: #111827;      /* Card/panel background */
--bg-tertiary: #1f2937;       /* Hover states */
--text-primary: #e5e7eb;      /* Main text */
--text-secondary: #9ca3af;    /* Secondary text */
--accent-gold: #c8aa6e;       /* TFT gold, for highlights/titles */
--accent-blue: #0ac8b9;       /* TFT teal, for links/interactive */
--border: #374151;            /* Subtle borders */

/* Placement color scale (for node coloring) */
--placement-good: #22c55e;    /* Green, avg placement ≤ 4.0 */
--placement-neutral: #eab308; /* Yellow, ~4.5 */
--placement-bad: #ef4444;     /* Red, avg placement ≥ 5.0 */

/* Trait style colors */
--style-1: #a8d8ea;           /* Bronze tier */
--style-2: #5eb3d4;           /* Silver tier */
--style-3: #2980b9;           /* Gold tier */
--style-4: #f39c12;           /* Prismatic tier */
```

### Typography
- Headings: `'Beaufort for LOL'` (if available) or `'Cinzel', serif` as fallback
- Body: `'Inter', 'Segoe UI', sans-serif`
- Data labels / numbers: `'JetBrains Mono', monospace`

### Tooltip Style
Dark semi-transparent background (`rgba(0,0,0,0.9)`), gold border, rounded corners. Show champion icon inline.

---

## Tech Stack

| Layer | Tool | Notes |
|-------|------|-------|
| Visualization | d3.js v7 | Required by course |
| Layout/UI | Plain HTML/CSS or lightweight framework | Your choice |
| Data loading | d3.csv / d3.json | Load CSVs at startup |
| Icons | Data Dragon CDN | Champion portraits |
| Hosting | GitHub Pages | Required by course |
| Screencast | Embedded YouTube/Vimeo | 2 min max |

### Suggested File Structure
```
index.html
css/
  style.css
js/
  main.js            # Entry point, data loading, layout
  networkGraph.js     # View A: force-directed graph
  traitChart.js       # View B: trait bar chart
  detailPanel.js      # View C: champion detail
  dataProcessor.js    # CSV parsing, co-occurrence matrix, aggregations
  utils.js            # Color scales, tooltips, formatters
data/
  processed/
    matches.csv
    participants.csv
    units.csv
    traits.csv
```

---

## Data Processing (in JS)

You'll need to compute these at load time from the raw CSVs:

### 1. Champion Stats
```javascript
// From units.csv + participants.csv
// For each champion: pick_count, pick_rate, avg_placement, top4_rate
```

### 2. Co-occurrence Matrix
```javascript
// Group units by (match_id, puuid) → get board (set of champions)
// For each pair of Top 30 champions, count how many boards contain both
// Normalize by total boards → co-occurrence rate (%)
// This becomes the edge data for the network graph
```

### 3. Item Stats per Champion
```javascript
// Parse the items JSON array in units.csv
// Group by (character_id, item) → count
// For each champion, rank items by frequency
```

### 4. Trait Stats
```javascript
// From traits.csv where style > 0
// Group by trait name → count per style level
// For linking: map champions → their traits (need static data or derive from data)
```

---

## Champion → Trait Mapping

The `traits.csv` doesn't directly tell you which champions have which traits, but you can derive it: if a champion appears on a board AND a trait is activated with `num_units > 0`, that champion likely contributes to that trait. A more reliable approach is to use the TFT static data from Data Dragon:

```
https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/tft-champion.json
```

This gives you each champion's trait list directly.

---

## Interaction Flow

```
User loads page
  → All 4 CSVs load
  → JS computes co-occurrence matrix, champion stats, trait stats
  → Network graph renders with all Top 30 champions
  → Trait chart shows global Top 15
  → Detail panel shows "Click a champion to explore"

User hovers champion node
  → Tooltip appears (name, cost, pick rate, avg placement, top items)

User clicks champion node (e.g., Swain)
  → Network: Swain + connected champions highlighted, others dim
  → Trait chart: transitions to show only Swain's traits
  → Detail panel: shows Swain's placement dist, best items, best partners

User clicks background
  → Everything resets to default state

User selects comp from dropdown (e.g., "Comp 5: Ambessa Carry")
  → Network: Ambessa, Swain, Bel'Veth, Fiddlesticks, Sion highlighted
  → Shows comp stats (avg placement 4.25, top4 rate 55.7%)
```

---

## Reference Images from EDA

The following charts are in the `eda_images/` folder for your reference. They show what the data looks like — your d3 visualizations should be interactive versions of these concepts:

| File | What It Shows |
|------|--------------|
| `cell6_fig1.png` | Top 20 champions: pick rate bars + avg placement line (dual axis) |
| `cell9_fig2.png` | Top 15 traits stacked by style level |
| `cell15_fig4.png` | Top 20 items by usage count |
| `cell16_fig5.png` | Item-champion affinity (which champions use which items) |
| `cell19_fig6.png` | **Champion co-occurrence heatmap** — this is the data behind your network graph |
| `cell22_fig7.png` | Correlation heatmap (stats vs placement) |
| `cell25_fig8.png` | KMeans cluster centers (7 comps × 30 champions) |
| `cell26_fig9.png` | Comp performance comparison (avg placement + top4 rate) |

---

## Deliverables Checklist

- [ ] Interactive website on GitHub Pages
- [ ] View A: Force-directed champion network graph with hover tooltips and click selection
- [ ] View B: Trait activation stacked bar chart, linked to View A
- [ ] View C: Champion detail panel with placement dist, items, partners
- [ ] Global filters: cost filter + composition selector
- [ ] Dark theme with TFT-inspired color palette
- [ ] Responsive layout
- [ ] 2-minute screencast embedded (YouTube/Vimeo)
- [ ] Process Book PDF linked from site
- [ ] Data files linked from site
- [ ] README with GitHub Pages URL

---

## Questions? 

Ping me if you need:
- The raw CSV files (in `data/processed/`)
- The EDA notebook (`tft_eda.ipynb`) with all charts
- The EDA chart images (`eda_images/`)
- Help with data processing logic
- Static data files from Data Dragon
