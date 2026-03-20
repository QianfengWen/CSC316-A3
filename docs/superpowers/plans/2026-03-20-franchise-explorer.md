# The Franchise Machine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive D3.js dashboard ("The Franchise Machine") that lets users explore ~16 movie franchises across revenue, ratings, and sequel progression via 4 linked panels with brushing, filtering, and narrative annotations.

**Architecture:** Static single-page app. `state.js` provides a central event bus that all panels subscribe to. Each panel (river, trajectory, dominance, profile) is a self-contained module that reads from shared state and renders into its own SVG/DOM container. Data is pre-fetched from TMDB into a static JSON file.

**Tech Stack:** D3.js v7 (CDN), vanilla HTML/CSS/JS, GitHub Pages deployment.

**Spec:** `docs/superpowers/specs/2026-03-20-franchise-explorer-design.md`

---

## File Structure

```
CSC316-A3/
  index.html              # App shell — layout grid, D3/script imports
  css/
    style.css             # Dark theme, panel grid, filter bar, animations
  js/
    state.js              # Event bus, shared state, debounced dispatch
    main.js               # Data loading, filter UI init, wires panels to state
    river.js              # Franchise swim-lane timeline with area pulses
    trajectory.js         # Sequel slope chart (rating by entry #)
    dominance.js          # Stacked area chart (revenue share by year)
    profile.js            # Franchise/movie detail card
    annotations.js        # Narrative insight bar with highlights
  data/
    franchises.json       # Pre-fetched TMDB data (~16 franchises)
    fetch_data.py         # Python script to build franchises.json from TMDB API
```

---

## Task 1: Data Pipeline — Fetch & Shape TMDB Data

**Files:**
- Create: `data/fetch_data.py`
- Create: `data/franchises.json`

- [ ] **Step 1: Create fetch_data.py**

This script fetches franchise data from TMDB API and outputs the JSON schema defined in the spec. Requires a TMDB API key (free at themoviedb.org).

```python
import requests
import json
import time
import os

API_KEY = os.environ.get("TMDB_API_KEY", "YOUR_KEY_HERE")
BASE = "https://api.themoviedb.org/3"

# Map of franchise name -> TMDB collection IDs (some franchises span multiple collections)
FRANCHISES = {
    "mcu": {
        "name": "Marvel Cinematic Universe",
        "color": "#e63232",
        "collection_ids": [529892, 131295, 284433, 531241, 623911, 618529, 453993, 912503],
        # MCU doesn't use a single collection — we'll search by keyword instead
        "search_terms": ["Marvel Cinematic Universe"],
        "use_keyword": True,
        "keyword_id": 180547
    },
    "star-wars": {
        "name": "Star Wars",
        "color": "#3c96ff",
        "collection_ids": [10],
        "use_keyword": False
    },
    "harry-potter": {
        "name": "Harry Potter",
        "color": "#a064ff",
        "collection_ids": [1241, 435259],  # HP + Fantastic Beasts
        "use_keyword": False
    },
    "james-bond": {
        "name": "James Bond",
        "color": "#00c896",
        "collection_ids": [645],
        "use_keyword": False
    },
    "fast-furious": {
        "name": "Fast & Furious",
        "color": "#ff6b35",
        "collection_ids": [9485],
        "use_keyword": False
    },
    "jurassic": {
        "name": "Jurassic Park / World",
        "color": "#4ecdc4",
        "collection_ids": [328, 531241],  # Jurassic Park + Jurassic World
        "use_keyword": False
    },
    "pirates": {
        "name": "Pirates of the Caribbean",
        "color": "#c9a227",
        "collection_ids": [295],
        "use_keyword": False
    },
    "lotr": {
        "name": "Lord of the Rings / Hobbit",
        "color": "#2ecc71",
        "collection_ids": [119, 121938],
        "use_keyword": False
    },
    "transformers": {
        "name": "Transformers",
        "color": "#b8d430",
        "collection_ids": [8650],
        "use_keyword": False
    },
    "mission-impossible": {
        "name": "Mission: Impossible",
        "color": "#f39c12",
        "collection_ids": [87359],
        "use_keyword": False
    },
    "spider-man": {
        "name": "Spider-Man",
        "color": "#ff4da6",
        "collection_ids": [556, 125574, 531241],
        "use_keyword": False,
        "series_map": {
            556: "raimi",
            125574: "webb",
            531241: "mcu"
        }
    },
    "batman": {
        "name": "Batman",
        "color": "#7eb8da",
        "collection_ids": [120794, 263, 948485],
        "use_keyword": False,
        "series_map": {
            120794: "burton-schumacher",
            263: "nolan",
            948485: "dceu"
        }
    },
    "dceu": {
        "name": "DC Extended Universe",
        "color": "#1a6bff",
        "collection_ids": [209131],
        "use_keyword": True,
        "keyword_id": 230429
    },
    "x-men": {
        "name": "X-Men",
        "color": "#9b59b6",
        "collection_ids": [748],
        "use_keyword": False
    },
    "toy-story": {
        "name": "Toy Story / Pixar Sequels",
        "color": "#f7dc6f",
        "collection_ids": [10194],
        "use_keyword": False
    },
    "indiana-jones": {
        "name": "Indiana Jones",
        "color": "#d4a574",
        "collection_ids": [84],
        "use_keyword": False
    },
}


def fetch_collection(collection_id):
    """Fetch all movies in a TMDB collection."""
    url = f"{BASE}/collection/{collection_id}"
    resp = requests.get(url, params={"api_key": API_KEY})
    resp.raise_for_status()
    return resp.json().get("parts", [])


def fetch_movie_details(movie_id):
    """Fetch full details for a single movie."""
    url = f"{BASE}/movie/{movie_id}"
    resp = requests.get(url, params={"api_key": API_KEY})
    resp.raise_for_status()
    return resp.json()


def fetch_keyword_movies(keyword_id):
    """Fetch movies by keyword ID (for MCU, DCEU)."""
    movies = []
    page = 1
    while True:
        url = f"{BASE}/keyword/{keyword_id}/movies"
        resp = requests.get(url, params={"api_key": API_KEY, "page": page})
        resp.raise_for_status()
        data = resp.json()
        movies.extend(data.get("results", []))
        if page >= data.get("total_pages", 1):
            break
        page += 1
        time.sleep(0.25)
    return movies


def build_franchise(fid, config):
    """Build a franchise object with all its movies."""
    seen_ids = set()
    raw_movies = []

    # Fetch from collections
    if not config.get("use_keyword"):
        for cid in config["collection_ids"]:
            try:
                parts = fetch_collection(cid)
                for m in parts:
                    if m["id"] not in seen_ids:
                        seen_ids.add(m["id"])
                        series = config.get("series_map", {}).get(cid, "main")
                        raw_movies.append((m, series))
                time.sleep(0.25)
            except Exception as e:
                print(f"  Warning: collection {cid} failed: {e}")
    else:
        keyword_movies = fetch_keyword_movies(config["keyword_id"])
        for m in keyword_movies:
            if m["id"] not in seen_ids:
                seen_ids.add(m["id"])
                raw_movies.append((m, "main"))

    # Fetch full details and build movie objects
    movies = []
    for m_basic, series in raw_movies:
        try:
            details = fetch_movie_details(m_basic["id"])
            time.sleep(0.25)

            release_date = details.get("release_date", "")
            if not release_date:
                continue

            year = int(release_date[:4])
            genres = [g["name"] for g in details.get("genres", [])]

            movies.append({
                "title": details["title"],
                "release_date": release_date,
                "year": year,
                "series": series,
                "budget": details.get("budget", 0),
                "revenue": details.get("revenue", 0),
                "vote_average": details.get("vote_average", 0),
                "vote_count": details.get("vote_count", 0),
                "runtime": details.get("runtime", 0),
                "genres": genres,
                "poster_path": details.get("poster_path"),
                "overview": details.get("overview", ""),
            })
        except Exception as e:
            print(f"  Warning: movie {m_basic.get('id')} failed: {e}")

    # Sort by release date
    movies.sort(key=lambda m: m["release_date"])

    # Assign entry_number per series
    series_counts = {}
    for movie in movies:
        s = movie["series"]
        series_counts[s] = series_counts.get(s, 0) + 1
        movie["entry_number"] = series_counts[s]

    return {
        "id": fid,
        "name": config["name"],
        "color": config["color"],
        "movies": movies,
    }


def build_annotations():
    """Return curated insight annotations."""
    return [
        {
            "text": "The MCU generated more box office revenue in Phase 3 alone than the entire Harry Potter franchise.",
            "highlights": {"franchise_ids": ["mcu", "harry-potter"], "year_range": [2016, 2019], "entry_numbers": []}
        },
        {
            "text": "James Bond has survived 6 different actors across 60+ years \u2014 the longest-running franchise.",
            "highlights": {"franchise_ids": ["james-bond"], "year_range": [], "entry_numbers": []}
        },
        {
            "text": "Sequel fatigue is real: across all franchises, entry #4 and beyond average lower ratings than entry #1.",
            "highlights": {"franchise_ids": [], "year_range": [], "entry_numbers": [4, 5, 6, 7, 8]}
        },
        {
            "text": "2019 was peak franchise: the majority of top-grossing films were franchise entries.",
            "highlights": {"franchise_ids": [], "year_range": [2019, 2019], "entry_numbers": []}
        },
        {
            "text": "The Fast & Furious franchise grew its revenue per entry for 7 straight sequels \u2014 defying the typical decline.",
            "highlights": {"franchise_ids": ["fast-furious"], "year_range": [], "entry_numbers": []}
        },
        {
            "text": "Christopher Nolan's Dark Knight trilogy averaged a 8.5 rating \u2014 the highest-rated Batman continuity.",
            "highlights": {"franchise_ids": ["batman"], "year_range": [2005, 2012], "entry_numbers": []}
        },
        {
            "text": "Spider-Man has been rebooted 3 times, each with a different lead actor and distinct rating trajectory.",
            "highlights": {"franchise_ids": ["spider-man"], "year_range": [], "entry_numbers": []}
        },
        {
            "text": "Toy Story maintained a 7.5+ rating across all 4 entries \u2014 one of the most consistent franchises in quality.",
            "highlights": {"franchise_ids": ["toy-story"], "year_range": [], "entry_numbers": []}
        },
    ]


def main():
    print("Fetching franchise data from TMDB...")
    franchises = []

    for fid, config in FRANCHISES.items():
        print(f"  Building {config['name']}...")
        franchise = build_franchise(fid, config)
        print(f"    -> {len(franchise['movies'])} movies")
        franchises.append(franchise)

    output = {
        "franchises": franchises,
        "annotations": build_annotations(),
    }

    out_path = os.path.join(os.path.dirname(__file__), "franchises.json")
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    total = sum(len(fr["movies"]) for fr in franchises)
    print(f"\nDone! {len(franchises)} franchises, {total} total movies -> {out_path}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Get TMDB API key and run the script**

```bash
# Sign up at https://www.themoviedb.org/settings/api for a free API key
export TMDB_API_KEY="your_key_here"
cd /home/wieeii/CSC316-A3
python3 data/fetch_data.py
```

Expected: `franchises.json` created with ~16 franchises and ~200-300 movies.

- [ ] **Step 3: Validate the output**

```bash
python3 -c "
import json
with open('data/franchises.json') as f:
    d = json.load(f)
print(f'{len(d[\"franchises\"])} franchises')
for fr in d['franchises']:
    print(f'  {fr[\"name\"]}: {len(fr[\"movies\"])} movies')
print(f'{len(d[\"annotations\"])} annotations')
"
```

- [ ] **Step 4: Manually review and fix data issues**

Check for: missing budgets/revenues, wrong movies included, duplicates across collections (e.g., MCU Spider-Man appearing in both MCU and Spider-Man franchises — deduplicate by removing from one). Adjust collection IDs or series mappings in the script as needed and re-run.

- [ ] **Step 5: Commit**

```bash
git add data/fetch_data.py data/franchises.json
git commit -m "feat: add TMDB data pipeline and franchise dataset"
```

---

## Task 2: Project Scaffold — HTML Shell, CSS Theme, State Manager

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/state.js`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Franchise Machine</title>
    <link rel="stylesheet" href="css/style.css">
    <script src="https://d3js.org/d3.v7.min.js"></script>
</head>
<body>
    <div class="app">
        <header class="app-header">
            <h1>The Franchise Machine</h1>
            <p class="subtitle">How Hollywood's Biggest Franchises Rise, Reign, and Fade</p>
        </header>

        <div class="filter-bar" id="filter-bar">
            <span class="filter-label">FILTERS</span>
            <div class="filter-group">
                <label>Genre</label>
                <select id="filter-genre" multiple></select>
            </div>
            <div class="filter-group filter-range">
                <label>Year Range</label>
                <div class="range-container">
                    <input type="range" id="filter-year-min" min="1970" max="2025" value="1970">
                    <input type="range" id="filter-year-max" min="1970" max="2025" value="2025">
                    <span id="year-range-label">1970 – 2025</span>
                </div>
            </div>
            <div class="filter-group">
                <label>Min Entries</label>
                <select id="filter-min-entries">
                    <option value="1">1+</option>
                    <option value="3" selected>3+</option>
                    <option value="5">5+</option>
                    <option value="8">8+</option>
                    <option value="10">10+</option>
                </select>
            </div>
            <div class="filter-group">
                <label>Metric</label>
                <select id="filter-metric">
                    <option value="vote_average" selected>Rating</option>
                    <option value="revenue">Revenue</option>
                    <option value="budget">Budget</option>
                </select>
            </div>
        </div>

        <div class="panels">
            <div class="panel panel-river" id="panel-river">
                <div class="panel-title">FRANCHISE RIVERS — Box Office Over Time</div>
                <div class="panel-content" id="river-container"></div>
            </div>
            <div class="panel panel-trajectory" id="panel-trajectory">
                <div class="panel-title">SEQUEL TRAJECTORY — Rating by Entry #</div>
                <div class="panel-content" id="trajectory-container"></div>
            </div>
            <div class="panel panel-dominance" id="panel-dominance">
                <div class="panel-title">FRANCHISE DOMINANCE — Box Office Share by Year</div>
                <div class="panel-content" id="dominance-container"></div>
            </div>
            <div class="panel panel-profile" id="panel-profile">
                <div class="panel-title">FRANCHISE PROFILE</div>
                <div class="panel-content" id="profile-container"></div>
            </div>
        </div>

        <div class="annotation-bar" id="annotation-bar">
            <span class="annotation-icon">&#9733;</span>
            <div class="annotation-text" id="annotation-text"></div>
            <div class="annotation-nav">
                <button id="annotation-prev">&#9668;</button>
                <button id="annotation-next">&#9658;</button>
            </div>
        </div>

        <footer class="app-footer">
            <p>Data source: <a href="https://www.themoviedb.org/" target="_blank">TMDB</a> | CSC316 Assignment 3 | Qianfeng Wen</p>
        </footer>
    </div>

    <div class="tooltip" id="tooltip"></div>

    <script src="js/state.js"></script>
    <script src="js/river.js"></script>
    <script src="js/trajectory.js"></script>
    <script src="js/dominance.js"></script>
    <script src="js/profile.js"></script>
    <script src="js/annotations.js"></script>
    <script src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create css/style.css**

```css
/* === Reset & Base === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
    --bg-primary: #1a1a2e;
    --bg-panel: #16213e;
    --accent: #f0c040;
    --text-primary: #e0e0e0;
    --text-secondary: #888888;
    --border: #333333;
    --font-stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body {
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-stack);
    min-height: 100vh;
    overflow-x: hidden;
}

/* === App Layout === */
.app {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
}

.app-header {
    text-align: center;
    padding: 20px 0 15px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 15px;
}

.app-header h1 {
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 2px;
    text-transform: uppercase;
}

.app-header .subtitle {
    font-size: 14px;
    color: var(--text-secondary);
    margin-top: 5px;
}

/* === Filter Bar === */
.filter-bar {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 12px 15px;
    background: var(--bg-panel);
    border-radius: 8px;
    margin-bottom: 15px;
    flex-wrap: wrap;
}

.filter-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    letter-spacing: 1px;
    text-transform: uppercase;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.filter-group label {
    font-size: 10px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.filter-group select,
.filter-group input[type="range"] {
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 12px;
    font-family: var(--font-stack);
    cursor: pointer;
}

.filter-group select:focus {
    outline: 1px solid var(--accent);
}

.filter-range {
    flex: 1;
    min-width: 200px;
}

.range-container {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
}

.range-container input[type="range"] {
    flex: 1;
    -webkit-appearance: none;
    height: 4px;
    background: var(--border);
    border: none;
    border-radius: 2px;
}

.range-container input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent);
    cursor: pointer;
}

#year-range-label {
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
}

/* === Panel Grid === */
.panels {
    display: grid;
    grid-template-columns: 3fr 2fr;
    grid-template-rows: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
    height: 600px;
}

.panel {
    background: var(--bg-panel);
    border-radius: 8px;
    padding: 15px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.panel-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 10px;
    flex-shrink: 0;
}

.panel-content {
    flex: 1;
    position: relative;
    min-height: 0;
}

.panel-river { grid-column: 1; grid-row: 1; }
.panel-trajectory { grid-column: 2; grid-row: 1; }
.panel-dominance { grid-column: 1; grid-row: 2; }
.panel-profile { grid-column: 2; grid-row: 2; }

/* === Annotation Bar === */
.annotation-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    background: rgba(240, 192, 64, 0.08);
    border: 1px solid rgba(240, 192, 64, 0.25);
    border-radius: 8px;
    margin-bottom: 15px;
}

.annotation-icon {
    font-size: 18px;
    color: var(--accent);
    flex-shrink: 0;
}

.annotation-text {
    flex: 1;
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.4;
}

.annotation-nav {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
}

.annotation-nav button {
    background: none;
    border: 1px solid rgba(240, 192, 64, 0.3);
    color: var(--accent);
    font-size: 14px;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
}

.annotation-nav button:hover {
    background: rgba(240, 192, 64, 0.15);
}

/* === Tooltip === */
.tooltip {
    position: absolute;
    pointer-events: none;
    background: rgba(22, 33, 62, 0.95);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 12px;
    color: var(--text-primary);
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.15s;
    max-width: 250px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.tooltip.visible { opacity: 1; }

.tooltip .tt-title {
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 4px;
}

.tooltip .tt-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 2px;
}

.tooltip .tt-label { color: var(--text-secondary); }
.tooltip .tt-value { font-weight: 600; }

/* === Footer === */
.app-footer {
    text-align: center;
    font-size: 11px;
    color: var(--text-secondary);
    padding: 10px 0;
}

.app-footer a {
    color: var(--accent);
    text-decoration: none;
}

/* === Animations === */
@keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(1.3); }
}

.pulse { animation: pulse 1s ease-in-out 2; }

.fade-dim {
    opacity: 0.1 !important;
    transition: opacity 0.2s ease;
}

/* === Profile Card Styles === */
.profile-franchise, .profile-movie {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    transition: transform 0.3s ease, opacity 0.3s ease;
}

.profile-name {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 4px;
}

.profile-years {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 15px;
}

.profile-stats {
    display: flex;
    gap: 25px;
    justify-content: center;
}

.profile-stat-value {
    font-size: 20px;
    font-weight: 700;
}

.profile-stat-label {
    font-size: 9px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.profile-poster {
    width: 100px;
    height: 150px;
    object-fit: cover;
    border-radius: 6px;
    margin-bottom: 10px;
}

.profile-poster-placeholder {
    width: 100px;
    height: 150px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    margin-bottom: 10px;
}

.profile-genres {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 8px;
}

.profile-genre-tag {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--border);
    color: var(--text-secondary);
}

.profile-back {
    margin-top: 10px;
    font-size: 11px;
    color: var(--accent);
    cursor: pointer;
    border: none;
    background: none;
    font-family: var(--font-stack);
}

.profile-back:hover { text-decoration: underline; }

.profile-empty {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    font-size: 13px;
    font-style: italic;
}
```

- [ ] **Step 3: Create js/state.js**

```javascript
/**
 * state.js — Central state manager and event bus.
 * All panels subscribe to state changes and re-render when relevant state updates.
 */
const State = (() => {
    const state = {
        data: null,               // Full dataset (franchises + annotations)
        filteredData: null,       // Franchises after applying filters
        brushRange: null,         // [yearStart, yearEnd] or null
        selectedFranchise: null,  // franchise id or null
        selectedMovie: null,      // movie object or null
        lockedFranchise: null,    // franchise id locked via click (not just hover)
        activeFilters: {
            genres: [],           // selected genre strings
            yearRange: [1970, 2025],
            minEntries: 3,
            metric: 'vote_average'
        },
        currentInsight: 0,        // index into annotations array
        highlightedAnnotation: null // current annotation highlight config or null
    };

    const listeners = {};
    let debounceTimer = null;

    function on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
    }

    function emit(event) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            (listeners[event] || []).forEach(cb => cb(state));
            (listeners['*'] || []).forEach(cb => cb(state, event));
        }, 50);
    }

    function set(key, value) {
        state[key] = value;
        emit('change');
    }

    function get(key) {
        return key ? state[key] : state;
    }

    function setFilter(filterKey, value) {
        state.activeFilters[filterKey] = value;
        applyFilters();
        emit('change');
    }

    function applyFilters() {
        if (!state.data) return;
        const { genres, yearRange, minEntries } = state.activeFilters;

        state.filteredData = state.data.franchises
            .map(franchise => {
                let movies = franchise.movies.filter(m => {
                    const inYear = m.year >= yearRange[0] && m.year <= yearRange[1];
                    const inGenre = genres.length === 0 ||
                        m.genres.some(g => genres.includes(g));
                    return inYear && inGenre;
                });
                return { ...franchise, movies };
            })
            .filter(franchise => franchise.movies.length >= minEntries);
    }

    function batch(updates) {
        Object.assign(state, updates);
        emit('change');
    }

    function clearSelections() {
        batch({
            selectedFranchise: null,
            selectedMovie: null,
            lockedFranchise: null,
            brushRange: null,
            highlightedAnnotation: null
        });
    }

    return { on, emit, set, get, setFilter, applyFilters, clearSelections, batch };
})();
```

- [ ] **Step 4: Verify scaffold loads in browser**

```bash
cd /home/wieeii/CSC316-A3
python3 -m http.server 8000
```

Open `http://localhost:8000` — should see dark themed layout with empty panels, filter bar, and annotation bar.

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css js/state.js
git commit -m "feat: add project scaffold — HTML shell, dark CSS theme, state manager"
```

---

## Task 3: Main.js — Data Loading, Filter Wiring, Panel Init

**Files:**
- Create: `js/main.js`

- [ ] **Step 1: Create js/main.js**

```javascript
/**
 * main.js — App initialization, data loading, filter UI wiring.
 */
(async function () {
    // Load data
    const data = await d3.json('data/franchises.json');
    State.set('data', data);
    State.applyFilters();
    State.emit('change');

    // === Populate genre filter ===
    const allGenres = new Set();
    data.franchises.forEach(f =>
        f.movies.forEach(m => m.genres.forEach(g => allGenres.add(g)))
    );
    const genreSelect = d3.select('#filter-genre');
    [...allGenres].sort().forEach(g => {
        genreSelect.append('option').attr('value', g).text(g);
    });

    // === Wire filter controls ===
    d3.select('#filter-genre').on('change', function () {
        const selected = Array.from(this.selectedOptions, o => o.value);
        State.setFilter('genres', selected);
    });

    d3.select('#filter-min-entries').on('change', function () {
        State.setFilter('minEntries', +this.value);
    });

    d3.select('#filter-metric').on('change', function () {
        State.setFilter('metric', this.value);
    });

    // Year range sliders
    const yearMin = d3.select('#filter-year-min');
    const yearMax = d3.select('#filter-year-max');
    const yearLabel = d3.select('#year-range-label');

    function updateYearRange() {
        let minVal = +yearMin.property('value');
        let maxVal = +yearMax.property('value');
        if (minVal > maxVal) {
            [minVal, maxVal] = [maxVal, minVal];
        }
        yearLabel.text(`${minVal} – ${maxVal}`);
        State.setFilter('yearRange', [minVal, maxVal]);
    }

    yearMin.on('input', updateYearRange);
    yearMax.on('input', updateYearRange);

    // === Tooltip helper (shared) ===
    const tooltip = d3.select('#tooltip');

    window.showTooltip = function (event, html) {
        tooltip
            .html(html)
            .classed('visible', true)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    };

    window.hideTooltip = function () {
        tooltip.classed('visible', false);
    };

    // === Format helpers (shared) ===
    window.fmt = {
        money: d3.format('$,.0f'),
        moneyShort: (v) => {
            if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
            if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
            return `$${d3.format(',')(v)}`;
        },
        rating: d3.format('.1f'),
        number: d3.format(','),
    };

    // === Initialize panels ===
    RiverChart.init('#river-container');
    TrajectoryChart.init('#trajectory-container');
    DominanceChart.init('#dominance-container');
    ProfileCard.init('#profile-container');
    AnnotationBar.init();

    // === Clear selections on background click ===
    d3.select('.panels').on('click', function (event) {
        if (event.target === this) {
            State.clearSelections();
        }
    });
})();
```

- [ ] **Step 2: Verify page loads without errors**

Open browser console — should see no errors (panels will be empty stubs until implemented).

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: add main.js — data loading, filter wiring, panel init stubs"
```

---

## Task 4: Franchise Rivers Panel

**Files:**
- Create: `js/river.js`

- [ ] **Step 1: Create js/river.js**

```javascript
/**
 * river.js — Franchise swim-lane timeline with revenue area pulses.
 * Each franchise gets a horizontal lane. Movies appear as dots within the lane.
 * A soft area fill under the dots encodes revenue, creating a "pulse" effect.
 */
const RiverChart = (() => {
    let svg, g, width, height, xScale, brush;
    const margin = { top: 10, right: 20, bottom: 30, left: 10 };
    const laneHeight = 32;
    const lanePadding = 4;

    function init(container) {
        const el = d3.select(container);
        const rect = el.node().getBoundingClientRect();
        width = rect.width - margin.left - margin.right;
        height = rect.height - margin.top - margin.bottom;

        svg = el.append('svg')
            .attr('width', rect.width)
            .attr('height', rect.height);

        g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // X-axis
        xScale = d3.scaleLinear().range([0, width]);
        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`);

        // Lane container (rendered first so brush overlay sits on top for event capture)
        g.append('g').attr('class', 'lanes');

        // Brush (appended after lanes so it sits on top in SVG z-order)
        brush = d3.brushX()
            .extent([[0, 0], [width, height]])
            .on('end', brushed);

        g.append('g')
            .attr('class', 'brush')
            .call(brush)
            .selectAll('.overlay')
            .style('pointer-events', 'all')
            .style('cursor', 'crosshair');

        State.on('change', update);
    }

    function brushed(event) {
        if (!event.selection) {
            State.set('brushRange', null);
            return;
        }
        const [x0, x1] = event.selection;
        const yearStart = Math.round(xScale.invert(x0));
        const yearEnd = Math.round(xScale.invert(x1));
        State.set('brushRange', [yearStart, yearEnd]);
    }

    function update(state) {
        const franchises = state.filteredData;
        if (!franchises) return;

        const { yearRange } = state.activeFilters;
        xScale.domain(yearRange);

        // Update x-axis
        g.select('.x-axis')
            .transition().duration(600)
            .call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(10))
            .selectAll('text').style('fill', '#888').style('font-size', '10px');
        g.select('.x-axis').selectAll('line, path').style('stroke', '#333');

        // Revenue scale (shared across all lanes for dot sizing)
        const allRevenues = franchises.flatMap(f => f.movies.map(m => m.revenue)).filter(r => r > 0);
        const revenueMax = d3.max(allRevenues) || 1;
        const revenueScale = d3.scaleLinear().domain([0, revenueMax]).range([2, laneHeight / 2 - 2]);
        const dotScale = d3.scaleSqrt().domain([0, d3.max(allRevenues) || 1]).range([3, 10]);
        const ratingOpacity = d3.scaleLinear().domain([4, 9]).range([0.4, 1]).clamp(true);

        // Bind franchise lanes
        const lanes = g.select('.lanes')
            .selectAll('.lane')
            .data(franchises, d => d.id);

        lanes.exit()
            .transition().duration(600)
            .style('opacity', 0)
            .remove();

        const lanesEnter = lanes.enter()
            .append('g')
            .attr('class', 'lane')
            .style('opacity', 0);

        const allLanes = lanesEnter.merge(lanes);

        allLanes
            .transition().duration(600)
            .attr('transform', (d, i) => `translate(0, ${i * (laneHeight + lanePadding)})`)
            .style('opacity', d => {
                if (state.highlightedAnnotation) {
                    const hl = state.highlightedAnnotation;
                    if (hl.franchise_ids.length > 0 && !hl.franchise_ids.includes(d.id)) return 0.15;
                }
                if (state.selectedFranchise && state.selectedFranchise !== d.id && state.lockedFranchise !== d.id) return 0.3;
                return 1;
            });

        // Franchise label
        allLanes.each(function (franchise) {
            const lane = d3.select(this);

            // Label
            let label = lane.select('.lane-label');
            if (label.empty()) {
                label = lane.append('text')
                    .attr('class', 'lane-label')
                    .attr('x', -5)
                    .attr('y', laneHeight / 2)
                    .attr('text-anchor', 'end')
                    .style('font-size', '9px')
                    .style('fill', franchise.color)
                    .style('dominant-baseline', 'middle');
            }
            // Hide labels to save space — franchise identity comes from color + tooltip
            label.text('');

            // Area fill (revenue pulses)
            const movies = franchise.movies.slice().sort((a, b) => a.year - b.year);

            // Build area data: for each movie, create a peak point; between movies, taper to near-zero
            const areaData = [];
            movies.forEach((m, i) => {
                if (i > 0) {
                    // Add zero-point midway between previous and current movie
                    const prevYear = movies[i - 1].year;
                    const midYear = (prevYear + m.year) / 2;
                    areaData.push({ year: midYear, revenue: 0 });
                }
                areaData.push({ year: m.year, revenue: m.revenue });
            });

            const areaGen = d3.area()
                .x(d => xScale(d.year))
                .y0(laneHeight)
                .y1(d => laneHeight - revenueScale(d.revenue))
                .curve(d3.curveMonotoneX);

            let areaPath = lane.select('.lane-area');
            if (areaPath.empty()) {
                areaPath = lane.append('path')
                    .attr('class', 'lane-area')
                    .style('fill', franchise.color)
                    .style('opacity', 0.2);
            }
            areaPath.transition().duration(600)
                .attr('d', areaGen(areaData));

            // Movie dots
            const dots = lane.selectAll('.movie-dot')
                .data(movies, d => d.title);

            dots.exit()
                .transition().duration(600)
                .attr('r', 0)
                .remove();

            const dotsEnter = dots.enter()
                .append('circle')
                .attr('class', 'movie-dot')
                .attr('r', 0)
                .attr('cy', laneHeight / 2)
                .style('cursor', 'pointer');

            dotsEnter.merge(dots)
                .on('mouseover', (event, d) => {
                    State.set('selectedFranchise', franchise.id);
                    showTooltip(event, `
                        <div class="tt-title">${d.title} (${d.year})</div>
                        <div class="tt-row"><span class="tt-label">Revenue</span><span class="tt-value">${fmt.moneyShort(d.revenue)}</span></div>
                        <div class="tt-row"><span class="tt-label">Rating</span><span class="tt-value">${fmt.rating(d.vote_average)}</span></div>
                        <div class="tt-row"><span class="tt-label">Budget</span><span class="tt-value">${d.budget ? fmt.moneyShort(d.budget) : 'N/A'}</span></div>
                    `);
                })
                .on('mouseout', (event, d) => {
                    if (!state.lockedFranchise) State.set('selectedFranchise', null);
                    hideTooltip();
                })
                .on('click', (event, d) => {
                    event.stopPropagation();
                    State.set('selectedMovie', d);
                    State.set('selectedFranchise', franchise.id);
                    State.set('lockedFranchise', franchise.id);
                })
                .each(function (d) {
                    // Apply pulse class if annotation highlights match this dot
                    const el = d3.select(this);
                    if (state.highlightedAnnotation) {
                        const hl = state.highlightedAnnotation;
                        const franchiseMatch = hl.franchise_ids.length === 0 || hl.franchise_ids.includes(franchise.id);
                        const yearMatch = hl.year_range.length === 0 || (d.year >= hl.year_range[0] && d.year <= hl.year_range[1]);
                        const entryMatch = hl.entry_numbers.length === 0 || hl.entry_numbers.includes(d.entry_number);
                        el.classed('pulse', franchiseMatch && yearMatch && entryMatch);
                    } else {
                        el.classed('pulse', false);
                    }
                })
                .transition().duration(600)
                .attr('cx', d => xScale(d.year))
                .attr('cy', laneHeight / 2)
                .attr('r', d => dotScale(d.revenue))
                .style('fill', franchise.color)
                .style('opacity', d => ratingOpacity(d.vote_average));
        });

        // Adjust SVG height to fit all lanes
        const totalHeight = franchises.length * (laneHeight + lanePadding) + margin.top + margin.bottom + 30;
        svg.attr('height', Math.max(totalHeight, 200));
    }

    return { init };
})();
```

- [ ] **Step 2: Test in browser**

Reload page — river panel should show franchise swim-lanes with colored dots and area pulses. Verify:
- Dots appear at correct positions
- Area fills create pulse shapes
- Hovering a dot shows tooltip
- Brushing selects a year range

- [ ] **Step 3: Commit**

```bash
git add js/river.js
git commit -m "feat: add franchise rivers panel — swim-lanes with area pulses and brush"
```

---

## Task 5: Sequel Trajectory Panel

**Files:**
- Create: `js/trajectory.js`

- [ ] **Step 1: Create js/trajectory.js**

```javascript
/**
 * trajectory.js — Sequel slope chart.
 * Shows how ratings (or selected metric) change across sequel number.
 * Lines are drawn per-series within each franchise (reboots get separate segments).
 */
const TrajectoryChart = (() => {
    let svg, g, width, height, xScale, yScale;
    const margin = { top: 10, right: 15, bottom: 30, left: 40 };

    function init(container) {
        const el = d3.select(container);
        const rect = el.node().getBoundingClientRect();
        width = rect.width - margin.left - margin.right;
        height = rect.height - margin.top - margin.bottom;

        svg = el.append('svg')
            .attr('width', rect.width)
            .attr('height', rect.height);

        g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        xScale = d3.scaleLinear().range([0, width]);
        yScale = d3.scaleLinear().range([height, 0]);

        g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${height})`);
        g.append('g').attr('class', 'y-axis');
        g.append('g').attr('class', 'lines');

        State.on('change', update);
    }

    function update(state) {
        const franchises = state.filteredData;
        if (!franchises) return;

        const metric = state.activeFilters.metric;
        const brushRange = state.brushRange;

        // Build series data: group movies by franchise + series
        const seriesData = [];
        franchises.forEach(franchise => {
            const seriesMap = {};
            franchise.movies.forEach(m => {
                // If brush is active, only include movies in range
                if (brushRange && (m.year < brushRange[0] || m.year > brushRange[1])) return;
                const key = m.series || 'main';
                if (!seriesMap[key]) seriesMap[key] = [];
                seriesMap[key].push(m);
            });

            const seriesKeys = Object.keys(seriesMap).sort((a, b) => {
                const aMin = d3.min(seriesMap[a], m => m.year);
                const bMin = d3.min(seriesMap[b], m => m.year);
                return aMin - bMin;
            });

            seriesKeys.forEach((key, idx) => {
                seriesData.push({
                    id: `${franchise.id}-${key}`,
                    franchiseId: franchise.id,
                    color: franchise.color,
                    series: key,
                    isRebootBoundary: idx > 0,
                    movies: seriesMap[key].sort((a, b) => a.entry_number - b.entry_number),
                });
            });
        });

        // Scales
        const maxEntry = d3.max(seriesData, s => d3.max(s.movies, m => m.entry_number)) || 10;
        xScale.domain([1, maxEntry]);

        let yDomain;
        if (metric === 'vote_average') {
            yDomain = [0, 10];
        } else {
            const allVals = seriesData.flatMap(s => s.movies.map(m => m[metric])).filter(v => v > 0);
            yDomain = [0, d3.max(allVals) || 1];
        }
        yScale.domain(yDomain);

        // Axes
        g.select('.x-axis')
            .transition().duration(600)
            .call(d3.axisBottom(xScale).ticks(maxEntry).tickFormat(d => `#${d}`))
            .selectAll('text').style('fill', '#888').style('font-size', '10px');

        const yAxisFormat = metric === 'vote_average' ? d3.format('.0f') : fmt.moneyShort;
        g.select('.y-axis')
            .transition().duration(600)
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(yAxisFormat))
            .selectAll('text').style('fill', '#888').style('font-size', '10px');

        g.selectAll('.x-axis, .y-axis').selectAll('line, path').style('stroke', '#333');

        // Lines
        const line = d3.line()
            .x(d => xScale(d.entry_number))
            .y(d => yScale(d[metric]))
            .curve(d3.curveMonotoneX);

        const lines = g.select('.lines')
            .selectAll('.trajectory-group')
            .data(seriesData, d => d.id);

        lines.exit()
            .transition().duration(600)
            .style('opacity', 0)
            .remove();

        const linesEnter = lines.enter()
            .append('g')
            .attr('class', 'trajectory-group');

        linesEnter.append('path')
            .attr('class', 'trajectory-line')
            .attr('fill', 'none')
            .attr('stroke-width', 2.5);

        const allLines = linesEnter.merge(lines);

        allLines.select('.trajectory-line')
            .transition().duration(600)
            .attr('d', d => line(d.movies))
            .attr('stroke', d => d.color)
            .attr('stroke-dasharray', 'none')
            .style('opacity', d => {
                if (state.highlightedAnnotation) {
                    const hl = state.highlightedAnnotation;
                    if (hl.franchise_ids.length > 0 && !hl.franchise_ids.includes(d.franchiseId)) return 0.1;
                }
                if (state.selectedFranchise && state.selectedFranchise !== d.franchiseId) return 0.1;
                return 0.8;
            });

        // Draw dashed connector lines between reboot series within the same franchise
        const connectorData = [];
        const byFranchise = d3.group(seriesData, d => d.franchiseId);
        byFranchise.forEach((seriesList, fid) => {
            for (let i = 1; i < seriesList.length; i++) {
                const prev = seriesList[i - 1];
                const curr = seriesList[i];
                if (prev.movies.length > 0 && curr.movies.length > 0) {
                    const lastMovie = prev.movies[prev.movies.length - 1];
                    const firstMovie = curr.movies[0];
                    connectorData.push({
                        id: `${fid}-connector-${i}`,
                        franchiseId: fid,
                        color: prev.color,
                        from: lastMovie,
                        to: firstMovie
                    });
                }
            }
        });

        const connectors = g.select('.lines')
            .selectAll('.reboot-connector')
            .data(connectorData, d => d.id);

        connectors.exit().transition().duration(600).style('opacity', 0).remove();

        connectors.enter()
            .append('line')
            .attr('class', 'reboot-connector')
            .merge(connectors)
            .transition().duration(600)
            .attr('x1', d => xScale(d.from.entry_number))
            .attr('y1', d => yScale(d.from[metric]))
            .attr('x2', d => xScale(d.to.entry_number))
            .attr('y2', d => yScale(d.to[metric]))
            .attr('stroke', d => d.color)
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '6,3')
            .style('opacity', d => {
                if (state.selectedFranchise && state.selectedFranchise !== d.franchiseId) return 0.1;
                return 0.5;
            });

        // Dots on each line
        allLines.each(function (seriesItem) {
            const group = d3.select(this);
            const dots = group.selectAll('.trajectory-dot')
                .data(seriesItem.movies, d => d.title);

            dots.exit().transition().duration(600).attr('r', 0).remove();

            const dotsEnter = dots.enter()
                .append('circle')
                .attr('class', 'trajectory-dot')
                .attr('r', 0)
                .style('cursor', 'pointer');

            dotsEnter.merge(dots)
                .on('mouseover', (event, d) => {
                    State.set('selectedFranchise', seriesItem.franchiseId);
                    showTooltip(event, `
                        <div class="tt-title">${d.title}</div>
                        <div class="tt-row"><span class="tt-label">Entry</span><span class="tt-value">#${d.entry_number} (${d.series})</span></div>
                        <div class="tt-row"><span class="tt-label">${metric === 'vote_average' ? 'Rating' : 'Value'}</span><span class="tt-value">${metric === 'vote_average' ? fmt.rating(d[metric]) : fmt.moneyShort(d[metric])}</span></div>
                    `);
                })
                .on('mouseout', () => {
                    if (!state.lockedFranchise) State.set('selectedFranchise', null);
                    hideTooltip();
                })
                .on('click', (event, d) => {
                    event.stopPropagation();
                    const fid = seriesItem.franchiseId;
                    if (state.lockedFranchise === fid) {
                        State.set('lockedFranchise', null);
                        State.set('selectedFranchise', null);
                    } else {
                        State.set('lockedFranchise', fid);
                        State.set('selectedFranchise', fid);
                    }
                })
                .each(function (d) {
                    // Apply pulse for annotation highlights
                    const el = d3.select(this);
                    if (state.highlightedAnnotation) {
                        const hl = state.highlightedAnnotation;
                        const franchiseMatch = hl.franchise_ids.length === 0 || hl.franchise_ids.includes(seriesItem.franchiseId);
                        const entryMatch = hl.entry_numbers.length === 0 || hl.entry_numbers.includes(d.entry_number);
                        el.classed('pulse', franchiseMatch && entryMatch);
                    } else {
                        el.classed('pulse', false);
                    }
                })
                .transition().duration(600)
                .attr('cx', d => xScale(d.entry_number))
                .attr('cy', d => yScale(d[metric]))
                .attr('r', 4)
                .style('fill', seriesItem.color)
                .style('opacity', () => {
                    if (state.selectedFranchise && state.selectedFranchise !== seriesItem.franchiseId) return 0.1;
                    return 1;
                });
        });

        // Hover interaction on lines
        allLines
            .on('mouseover', function (event, d) {
                if (!state.lockedFranchise) {
                    State.set('selectedFranchise', d.franchiseId);
                }
            })
            .on('mouseout', function () {
                if (!state.lockedFranchise) {
                    State.set('selectedFranchise', null);
                }
            });
    }

    return { init };
})();
```

- [ ] **Step 2: Test in browser**

Verify:
- Lines draw for each franchise series
- Reboots show dashed connecting lines
- Hovering a line bolds it and fades others
- Clicking locks the selection
- Changing metric dropdown updates y-axis
- Brushing the river filters visible entries

- [ ] **Step 3: Commit**

```bash
git add js/trajectory.js
git commit -m "feat: add sequel trajectory panel — slope chart with series/reboot support"
```

---

## Task 6: Franchise Dominance Panel

**Files:**
- Create: `js/dominance.js`

- [ ] **Step 1: Create js/dominance.js**

```javascript
/**
 * dominance.js — Stacked area chart showing franchise box office share by year.
 */
const DominanceChart = (() => {
    let svg, g, width, height, xScale, yScale;
    const margin = { top: 10, right: 15, bottom: 30, left: 50 };

    function init(container) {
        const el = d3.select(container);
        const rect = el.node().getBoundingClientRect();
        width = rect.width - margin.left - margin.right;
        height = rect.height - margin.top - margin.bottom;

        svg = el.append('svg')
            .attr('width', rect.width)
            .attr('height', rect.height);

        g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        xScale = d3.scaleLinear().range([0, width]);
        yScale = d3.scaleLinear().range([height, 0]);

        g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${height})`);
        g.append('g').attr('class', 'y-axis');
        g.append('g').attr('class', 'areas');

        State.on('change', update);
    }

    function update(state) {
        const franchises = state.filteredData;
        if (!franchises || franchises.length === 0) return;

        const brushRange = state.brushRange;
        const yearRange = state.activeFilters.yearRange;
        const effectiveRange = brushRange || yearRange;

        // Build year-franchise revenue matrix
        const years = d3.range(effectiveRange[0], effectiveRange[1] + 1);
        const franchiseIds = franchises.map(f => f.id);

        const yearData = years.map(year => {
            const row = { year };
            franchises.forEach(f => {
                const moviesThisYear = f.movies.filter(m => m.year === year);
                row[f.id] = d3.sum(moviesThisYear, m => m.revenue);
            });
            return row;
        });

        // Stack
        const stack = d3.stack()
            .keys(franchiseIds)
            .value((d, key) => d[key] || 0)
            .order(d3.stackOrderDescending);

        const stackedData = stack(yearData);

        // Scales
        xScale.domain(effectiveRange);
        yScale.domain([0, d3.max(yearData, d => {
            return d3.sum(franchiseIds, id => d[id] || 0);
        }) || 1]);

        // Axes
        g.select('.x-axis')
            .transition().duration(600)
            .call(d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(8))
            .selectAll('text').style('fill', '#888').style('font-size', '10px');

        g.select('.y-axis')
            .transition().duration(600)
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(fmt.moneyShort))
            .selectAll('text').style('fill', '#888').style('font-size', '10px');

        g.selectAll('.x-axis, .y-axis').selectAll('line, path').style('stroke', '#333');

        // Color map
        const colorMap = {};
        franchises.forEach(f => { colorMap[f.id] = f.color; });

        // Areas
        const area = d3.area()
            .x(d => xScale(d.data.year))
            .y0(d => yScale(d[0]))
            .y1(d => yScale(d[1]))
            .curve(d3.curveMonotoneX);

        const areas = g.select('.areas')
            .selectAll('.dominance-area')
            .data(stackedData, d => d.key);

        areas.exit()
            .transition().duration(600)
            .style('opacity', 0)
            .remove();

        const areasEnter = areas.enter()
            .append('path')
            .attr('class', 'dominance-area')
            .style('opacity', 0)
            .style('cursor', 'pointer');

        areasEnter.merge(areas)
            .on('mouseover', (event, d) => {
                const franchiseId = d.key;
                const franchise = franchises.find(f => f.id === franchiseId);
                if (!franchise) return;

                // Find nearest year
                const [mx] = d3.pointer(event, g.node());
                const year = Math.round(xScale.invert(mx));
                const yearRow = yearData.find(r => r.year === year);
                const rev = yearRow ? yearRow[franchiseId] || 0 : 0;

                if (!state.lockedFranchise) State.set('selectedFranchise', franchiseId);
                showTooltip(event, `
                    <div class="tt-title">${franchise.name}</div>
                    <div class="tt-row"><span class="tt-label">Year</span><span class="tt-value">${year}</span></div>
                    <div class="tt-row"><span class="tt-label">Revenue</span><span class="tt-value">${fmt.moneyShort(rev)}</span></div>
                `);
            })
            .on('mouseout', () => {
                if (!state.lockedFranchise) State.set('selectedFranchise', null);
                hideTooltip();
            })
            .on('click', (event, d) => {
                event.stopPropagation();
                const fid = d.key;
                if (state.lockedFranchise === fid) {
                    State.set('lockedFranchise', null);
                    State.set('selectedFranchise', null);
                } else {
                    State.set('lockedFranchise', fid);
                    State.set('selectedFranchise', fid);
                }
            })
            .transition().duration(600)
            .attr('d', area)
            .style('fill', d => colorMap[d.key] || '#888')
            .style('opacity', d => {
                if (state.highlightedAnnotation) {
                    const hl = state.highlightedAnnotation;
                    if (hl.franchise_ids.length > 0 && !hl.franchise_ids.includes(d.key)) return 0.1;
                }
                if (state.selectedFranchise && state.selectedFranchise !== d.key) return 0.15;
                return 0.7;
            });
    }

    return { init };
})();
```

- [ ] **Step 2: Test in browser**

Verify:
- Stacked areas render with correct franchise colors
- Hovering shows franchise name + revenue for that year
- Clicking isolates a franchise
- Brushing the river updates the visible year range

- [ ] **Step 3: Commit**

```bash
git add js/dominance.js
git commit -m "feat: add franchise dominance panel — stacked area chart"
```

---

## Task 7: Profile Card Panel

**Files:**
- Create: `js/profile.js`

- [ ] **Step 1: Create js/profile.js**

```javascript
/**
 * profile.js — Franchise/movie detail card.
 * Shows aggregate franchise stats by default, individual movie details on click.
 */
const ProfileCard = (() => {
    let container;

    function init(selector) {
        container = d3.select(selector);
        renderEmpty();
        State.on('change', update);
    }

    function renderEmpty() {
        container.html('');
        container.append('div')
            .attr('class', 'profile-empty')
            .text('Hover a franchise or click a movie to see details');
    }

    function update(state) {
        if (state.selectedMovie) {
            renderMovie(state.selectedMovie, state);
        } else if (state.selectedFranchise || state.lockedFranchise) {
            const fid = state.lockedFranchise || state.selectedFranchise;
            const franchise = (state.filteredData || []).find(f => f.id === fid);
            if (franchise) {
                renderFranchise(franchise, state);
            }
        } else {
            renderEmpty();
        }
    }

    function renderFranchise(franchise, state) {
        container.html('');
        const div = container.append('div').attr('class', 'profile-franchise');

        // Filter movies by brush range if active
        let movies = franchise.movies;
        if (state.brushRange) {
            movies = movies.filter(m => m.year >= state.brushRange[0] && m.year <= state.brushRange[1]);
        }

        if (movies.length === 0) {
            div.append('div').attr('class', 'profile-name').style('color', franchise.color).text(franchise.name);
            div.append('div').attr('class', 'profile-years').text('No movies in selected range');
            return;
        }

        const totalRevenue = d3.sum(movies, m => m.revenue);
        const avgRating = d3.mean(movies, m => m.vote_average);
        const budgets = movies.filter(m => m.budget > 0);
        const avgBudget = budgets.length > 0 ? d3.mean(budgets, m => m.budget) : null;
        const minYear = d3.min(movies, m => m.year);
        const maxYear = d3.max(movies, m => m.year);

        div.append('div')
            .attr('class', 'profile-name')
            .style('color', franchise.color)
            .text(franchise.name);

        div.append('div')
            .attr('class', 'profile-years')
            .text(`${minYear} – ${maxYear} · ${movies.length} entries`);

        const stats = div.append('div').attr('class', 'profile-stats');

        addStat(stats, fmt.moneyShort(totalRevenue), 'Total Revenue');
        addStat(stats, fmt.rating(avgRating), 'Avg Rating');
        addStat(stats, avgBudget ? fmt.moneyShort(avgBudget) : 'N/A', 'Avg Budget');
    }

    function renderMovie(movie, state) {
        container.html('');
        const div = container.append('div').attr('class', 'profile-movie');

        // Poster
        if (movie.poster_path) {
            div.append('img')
                .attr('class', 'profile-poster')
                .attr('src', `https://image.tmdb.org/t/p/w200${movie.poster_path}`)
                .attr('alt', movie.title)
                .on('error', function () {
                    d3.select(this).remove();
                    addPosterPlaceholder(div, state);
                });
        } else {
            addPosterPlaceholder(div, state);
        }

        div.append('div')
            .attr('class', 'profile-name')
            .text(`${movie.title} (${movie.year})`);

        const stats = div.append('div').attr('class', 'profile-stats');
        addStat(stats, fmt.moneyShort(movie.revenue), 'Revenue');
        addStat(stats, fmt.rating(movie.vote_average), 'Rating');
        addStat(stats, movie.budget ? fmt.moneyShort(movie.budget) : 'N/A', 'Budget');
        addStat(stats, movie.runtime ? `${movie.runtime} min` : 'N/A', 'Runtime');

        // Genre tags
        const genres = div.append('div').attr('class', 'profile-genres');
        movie.genres.forEach(g => {
            genres.append('span').attr('class', 'profile-genre-tag').text(g);
        });

        // Back button
        div.append('button')
            .attr('class', 'profile-back')
            .text('← Back to franchise')
            .on('click', () => {
                State.set('selectedMovie', null);
            });
    }

    function addPosterPlaceholder(parent, state) {
        const franchise = (state.filteredData || []).find(f => f.id === state.selectedFranchise);
        parent.append('div')
            .attr('class', 'profile-poster-placeholder')
            .style('background', (franchise ? franchise.color : '#333') + '22')
            .style('border', `1px solid ${franchise ? franchise.color : '#333'}`)
            .text('🎬');
    }

    function addStat(container, value, label) {
        const stat = container.append('div');
        stat.append('div').attr('class', 'profile-stat-value').text(value);
        stat.append('div').attr('class', 'profile-stat-label').text(label);
    }

    return { init };
})();
```

- [ ] **Step 2: Test in browser**

Verify:
- Hovering a franchise anywhere shows franchise stats in the card
- Clicking a movie dot switches to movie mode with poster, stats, genres
- "Back to franchise" button returns to franchise mode
- Stats respect active brush range

- [ ] **Step 3: Commit**

```bash
git add js/profile.js
git commit -m "feat: add franchise profile card — franchise stats and movie details"
```

---

## Task 8: Narrative Annotation Bar

**Files:**
- Create: `js/annotations.js`

- [ ] **Step 1: Create js/annotations.js**

```javascript
/**
 * annotations.js — Narrative insight bar with highlight-driven cross-panel linking.
 */
const AnnotationBar = (() => {
    let annotations = [];
    let autoTimer = null;

    function init() {
        State.on('change', onStateChange);

        d3.select('#annotation-prev').on('click', () => navigate(-1));
        d3.select('#annotation-next').on('click', () => navigate(1));

        // Pause auto-advance on hover
        d3.select('#annotation-bar')
            .on('mouseenter', () => clearAutoAdvance())
            .on('mouseleave', () => startAutoAdvance());
    }

    function onStateChange(state) {
        if (state.data && state.data.annotations) {
            annotations = state.data.annotations;
            renderCurrent(state);

            if (!autoTimer) startAutoAdvance();
        }
    }

    function renderCurrent(state) {
        if (annotations.length === 0) return;

        const idx = state.currentInsight % annotations.length;
        const annotation = annotations[idx];

        d3.select('#annotation-text')
            .transition().duration(300)
            .style('opacity', 0)
            .on('end', function () {
                d3.select(this)
                    .text(annotation.text)
                    .transition().duration(300)
                    .style('opacity', 1);
            });
    }

    function navigate(direction) {
        if (annotations.length === 0) return;
        const state = State.get();
        const newIdx = ((state.currentInsight + direction) % annotations.length + annotations.length) % annotations.length;
        const annotation = annotations[newIdx];

        // Batch all state updates into one emit
        State.batch({
            currentInsight: newIdx,
            highlightedAnnotation: annotation ? annotation.highlights : null,
            lockedFranchise: null,
            selectedMovie: null
        });

        resetAutoAdvance();
    }

    function startAutoAdvance() {
        clearAutoAdvance();
        autoTimer = setInterval(() => navigate(1), 10000);
    }

    function clearAutoAdvance() {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
    }

    function resetAutoAdvance() {
        clearAutoAdvance();
        startAutoAdvance();
    }

    // Clear annotation highlights when user interacts with other controls
    State.on('*', (state, event) => {
        if ((state.brushRange !== null || state.lockedFranchise !== null) && state.highlightedAnnotation !== null) {
            // Guard: only call set if not already null (prevents infinite re-emit)
            State.set('highlightedAnnotation', null);
        }
    });

    return { init };
})();
```

- [ ] **Step 2: Test in browser**

Verify:
- Annotation text displays and fades between insights
- ◂ ▸ buttons cycle through annotations
- Auto-advance works (~10s interval)
- Hovering annotation bar pauses auto-advance
- Clicking an annotation highlights relevant franchises across panels
- Interacting with other controls clears annotation highlights

- [ ] **Step 3: Commit**

```bash
git add js/annotations.js
git commit -m "feat: add narrative annotation bar with cross-panel highlights"
```

---

## Task 9: Initial Load Animation

**Files:**
- Modify: `js/river.js`
- Modify: `js/main.js`

- [ ] **Step 1: Add staggered river entrance animation to river.js**

In `river.js`, update the `lanesEnter` section to add staggered opacity entrance:

Find the line where `lanesEnter` is created and after the merge, add delay:

```javascript
// In the allLanes transition, add delay for stagger:
.delay((d, i) => i * 100)
```

- [ ] **Step 2: Add loading state to main.js**

Before data loads, show a brief loading message. After data loads and first render, add a subtle fade-in to the whole app:

```javascript
// At the top of the IIFE in main.js, before data load:
d3.select('.app').style('opacity', 0);

// After all panel inits:
d3.select('.app')
    .transition().duration(800)
    .style('opacity', 1);
```

- [ ] **Step 3: Test animations**

Reload page — verify staggered river entrance and overall fade-in.

- [ ] **Step 4: Commit**

```bash
git add js/river.js js/main.js
git commit -m "feat: add initial load animations — staggered rivers and app fade-in"
```

---

## Task 10: Polish, Cross-Panel Edge Cases, Final Testing

**Files:**
- Modify: `css/style.css` (minor tweaks)
- Modify: various js files (edge case fixes)

- [ ] **Step 1: Test all interaction flows end-to-end**

Walk through each interaction from the spec's interaction table:
1. Brush timeline → all panels update ✓
2. Hover trajectory line → others fade, profile updates ✓
3. Click movie dot → profile shows movie details ✓
4. Change filters → all panels animate ✓
5. Navigate annotations → highlights pulse ✓
6. Click dominance area → isolates franchise ✓
7. Clear selection → everything resets ✓

Fix any issues found.

- [ ] **Step 2: Test edge cases**

- No franchises match filters (min entries = 10 with genre filter)
- Brush range with no movies
- Switch metric while franchise is selected
- Rapid filter changes (debounce should prevent flicker)

- [ ] **Step 3: Visual polish pass**

- Verify colors are all distinguishable on dark background
- Check tooltip positioning near edges
- Ensure panel titles are visible and correctly styled
- Test at different viewport widths (1200px, 1400px, 1600px)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "polish: edge case fixes and visual refinements"
```

---

## Task 11: GitHub Pages Deployment

**Files:**
- No new files

- [ ] **Step 1: Initialize git repo and push**

```bash
cd /home/wieeii/CSC316-A3
git init
git add -A
git commit -m "initial commit: The Franchise Machine"
git remote add origin <your-repo-url>
git push -u origin main
```

- [ ] **Step 2: Enable GitHub Pages**

Go to repo Settings → Pages → Source: Deploy from branch → Branch: main, folder: / (root) → Save.

- [ ] **Step 3: Verify deployment**

Visit `https://csc316-student.github.io/CSC316-A3/` and verify all functionality works.

- [ ] **Step 4: Commit any deployment fixes**

If any paths need adjusting for GitHub Pages, fix and push.
