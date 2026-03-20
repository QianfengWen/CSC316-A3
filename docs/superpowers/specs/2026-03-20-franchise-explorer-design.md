# The Franchise Machine — Design Spec

Interactive D3.js dashboard for exploring movie franchise performance across time, revenue, ratings, and sequel progression.

## Goal

Enable free exploration of ~16 major movie franchises across multiple dimensions. Viewers should discover patterns like sequel fatigue, franchise dominance over time, and outlier successes — guided by narrative annotations but free to explore on their own.

## Data

### Source
TMDB (The Movie Database) API. Data is pre-fetched via a Python script and saved as a static `data/franchises.json` file. No server-side support required.

### Schema
```json
{
  "franchises": [
    {
      "id": "mcu",
      "name": "Marvel Cinematic Universe",
      "color": "#e63232",
      "movies": [
        {
          "title": "Iron Man",
          "release_date": "2008-05-02",
          "year": 2008,
          "entry_number": 1,
          "series": "main",
          "budget": 140000000,
          "revenue": 585174222,
          "vote_average": 7.6,
          "vote_count": 24000,
          "runtime": 126,
          "genres": ["Action", "Science Fiction", "Adventure"],
          "poster_path": "/78lPtwv72eTNqFW9COBYI0dWDJa.jpg",
          "overview": "..."
        }
      ]
    }
  ],
  "annotations": [
    {
      "text": "The MCU generated more revenue in Phase 3 alone ($13.5B) than the entire Harry Potter franchise ($9.2B)",
      "highlights": {
        "franchise_ids": ["mcu", "harry-potter"],
        "year_range": [2016, 2019],
        "entry_numbers": []
      }
    }
  ]
}
```

**Data handling notes:**
- Movies with `budget === 0` show "N/A" in the profile card budget field.
- Poster images: if `poster_path` is null, display a placeholder SVG with the franchise color and a film-reel icon.

### Franchise Grouping Strategy
Franchises with multiple reboots (Spider-Man, Batman) are treated as a single franchise entry but with a `series` sub-field on each movie to identify the continuity (e.g., `"raimi"`, `"webb"`, `"mcu"` for Spider-Man). The trajectory chart draws separate line segments per series within a franchise, connected by a dashed line at reboot boundaries, so rating drops between reboots are visually distinct from sequel fatigue within a continuity. `entry_number` resets to 1 at each reboot.

### Target Franchises (~16)
MCU, DCEU, Star Wars, Harry Potter/Fantastic Beasts, James Bond, Fast & Furious, Jurassic Park/World, Pirates of the Caribbean, Lord of the Rings/Hobbit, Transformers, Mission: Impossible, Spider-Man (Raimi / Webb / MCU), Batman (Burton / Nolan / DCEU), X-Men, Toy Story/Pixar sequels, Indiana Jones.

## Layout

Four linked panels + filter bar + narrative annotation bar. Dark cinematic theme (Netflix-style).

```
┌──────────────────────────────────────────────────────────────┐
│                    THE FRANCHISE MACHINE                      │
│         How Hollywood's Biggest Franchises Rise & Fade        │
├──────────────────────────────────────────────────────────────┤
│ FILTERS: [Genre ▾] [Decade: ◂━━━━━▸] [Min Entries ▾] [Metric ▾] │
├────────────────────────────────┬─────────────────────────────┤
│                                │                             │
│   FRANCHISE RIVERS             │   SEQUEL TRAJECTORY         │
│   Timeline (1970–2025)         │   Rating by Entry #         │
│   Flowing bands per franchise  │   Slope chart per franchise │
│   Dots = individual movies     │   Hover to isolate          │
│   Height = revenue             │                             │
│   Brushable                    │                             │
│                                │                             │
├────────────────────────────┬───┴─────────────────────────────┤
│                            │                                 │
│  FRANCHISE DOMINANCE       │   FRANCHISE PROFILE CARD        │
│  Stacked area chart        │   Stats: revenue, avg rating,   │
│  Box office share by year  │   budget, entries, years active │
│  Linked to timeline brush  │   Click movie dot for details   │
│                            │                                 │
├────────────────────────────┴─────────────────────────────────┤
│ ★ INSIGHT: [Narrative annotation text]              ◂ ▸      │
└──────────────────────────────────────────────────────────────┘
```

## Panel Specifications

### 1. Franchise Rivers (Main View — top left, ~60% width)
The primary and most distinctive view. A horizontal timeline (1970–2025) where each franchise is rendered as a horizontal swim-lane. Individual movies appear as dots within each lane.

**Geometry**: Each franchise occupies a fixed-height horizontal lane (not a true streamgraph). Within each lane, movies are positioned at their release year on the x-axis. A soft area fill connects movie positions using `d3.area` with `curveMonotoneX` interpolation, where the area height at each movie's x-position encodes that movie's revenue. Between movies, the area tapers toward zero (not held constant), creating a "pulse" effect at each release. This avoids the sparse-data problem of a true streamgraph while preserving the flowing river aesthetic.

**Fallback**: If the area interpolation proves visually cluttered with many overlapping franchises, fall back to simple horizontal lanes with dots only (no area fill), sized by revenue.

- **X-axis**: Time (year of release)
- **Lane area height**: Revenue at each movie's release point, tapered to near-zero between releases
- **Dots**: One per movie, positioned within the lane at release year. Dot size encodes vote count. Dot brightness/opacity encodes rating.
- **Color**: Each franchise has a unique assigned color (see revised palette below)
- **Brush**: Click+drag horizontally to select a year range. Brush selection propagates to all other panels. The decade range slider in the filter bar sets the visible x-axis extent; the brush operates within that extent. Clearing the brush resets to the full slider range.
- **On hover (dot)**: Tooltip with movie title, year, revenue, rating
- **On click (dot)**: Profile card flips to individual movie details
- **Initial animation**: Rivers draw in left-to-right with staggered 100ms delay per franchise

### 2. Sequel Trajectory (Top right, ~40% width)
A slope/line chart showing how ratings (or revenue, togglable via the Metric filter) change across sequel number within each franchise. Directly reveals sequel fatigue or resilience.

- **X-axis**: Entry number (#1, #2, #3, ...)
- **Y-axis**: Rating (or selected metric)
- **Lines**: One per franchise, colored to match. Connected dots at each entry.
- **On hover (line)**: Selected line boldens (stroke-width 3→5), all others fade to 10% opacity. Profile card updates to show that franchise.
- **On click (line)**: Locks the selection (click elsewhere or click again to unlock)
- **Linked to brush**: If a time range is brushed on the river, only entries within that range are shown (with animated transition)

### 3. Franchise Dominance (Bottom left, ~60% width)
A stacked area chart showing each franchise's share of total franchise box office revenue per year. Shows how a few mega-franchises have come to dominate.

- **X-axis**: Year
- **Y-axis**: Revenue (stacked, absolute only — normalized view removed to keep scope manageable)
- **Areas**: One per franchise, stacked, colored to match
- **On hover**: Tooltip showing franchise name and revenue for that year
- **On click (area)**: Isolates that franchise across all views
- **Linked to brush**: Updates to only show the brushed time range from the river

### 4. Franchise Profile Card (Bottom right, ~40% width)
A detail panel that shows aggregate franchise stats or individual movie details.

**Franchise mode** (default / on hover):
- Franchise name, color swatch
- Year range (e.g., "2008 – present")
- Number of entries
- Total revenue, average rating, average budget (large stat numbers)

**Movie mode** (on click of a movie dot):
- Movie title, release year
- Poster image (from TMDB poster_path)
- Budget, revenue, rating, runtime
- Genre tags
- Brief overview text
- "Back to franchise" link to return to franchise mode

**Franchise mode stats respect the active brush range** when one is set (e.g., if 2010–2020 is brushed, stats show only entries from that period).

**Transition**: 300ms scale transform when switching between modes.

### 5. Narrative Annotation Bar (Bottom)
A curated set of ~8-10 insight statements that guide exploration. Annotations are stored in the `annotations` array of the data file (see schema above).

- Text displays one insight at a time
- ◂ ▸ arrows cycle through insights
- On change: `state.js` reads the annotation's `highlights` object (`franchise_ids`, `year_range`, `entry_numbers`) and sets the corresponding state. All panels respond: matching dots pulse (CSS keyframe), matching franchise lines/areas bolden, non-matching elements fade to 20% opacity.
- Auto-advances every 10 seconds if user hasn't interacted (pauses on hover)
- Clicking an annotation's highlight clears when the user interacts with any other control

**Example annotations (with highlight data):**
- "The MCU generated more revenue in Phase 3 alone ($13.5B) than the entire Harry Potter franchise" → highlights `franchise_ids: ["mcu", "harry-potter"]`, `year_range: [2016, 2019]`
- "James Bond has survived 6 different actors across 60+ years — the longest-running franchise" → highlights `franchise_ids: ["james-bond"]`
- "Sequel fatigue is real: across all franchises, entry #4+ averages 0.8 rating points lower than entry #1" → highlights all franchises, `entry_numbers: [4, 5, 6, 7, 8]`
- "2019 was peak franchise: 8 of the top 10 grossing films were franchise entries" → highlights `year_range: [2019, 2019]`

## Interactions

| Interaction | Trigger | Effect | Animation |
|---|---|---|---|
| Brush timeline | Click+drag on river x-axis | All panels filter to brushed year range | 600ms ease-in-out |
| Hover franchise line | Mouseover on trajectory line | Line boldens, others fade, profile card updates | 200ms fade |
| Click movie dot | Click on river dot | Profile card flips to movie details | 300ms scale |
| Dynamic filters | Dropdown/slider change | All 4 panels update simultaneously | 600ms ease-in-out |
| Narrative cycle | Click ◂ ▸ or auto-advance | Insight text changes, data points pulse | 1s pulse |
| Click dominance area | Click on stacked area | Isolates franchise across all views | 600ms |
| Clear selection | Click empty space or "Clear" button | Reset all highlights and filters | 400ms |

## Filter Bar

Positioned below the title, above the panels.

- **Genre dropdown**: Filter franchises by genre (Action, Sci-Fi, Animation, etc.). Multi-select.
- **Decade range slider**: Dual-handle slider for year range (1970–2025). Updates all panels.
- **Min entries dropdown**: Filter to franchises with at least N entries (3, 5, 8, 10).
- **Metric selector**: Switch what the trajectory chart's y-axis shows (Rating, Revenue, Budget). ROI is excluded because many older films have unreported budgets in TMDB.

## Visual Design

### Color Palette
- **Background**: #1a1a2e (deep navy-black)
- **Panel backgrounds**: #16213e (slightly lighter navy)
- **Accent/gold**: #f0c040 (titles, annotations, highlights)
- **Text primary**: #e0e0e0
- **Text secondary**: #888888
- **Borders**: #333333

### Franchise Colors (high-contrast on dark, all hues distinct)
- MCU: #e63232 (red)
- DCEU: #1a6bff (blue)
- Star Wars: #3c96ff (light blue)
- Harry Potter: #a064ff (purple)
- James Bond: #00c896 (teal)
- Fast & Furious: #ff6b35 (orange)
- Jurassic Park: #4ecdc4 (cyan)
- Pirates: #c9a227 (gold)
- LOTR: #2ecc71 (green)
- Transformers: #b8d430 (yellow-green)
- Mission Impossible: #f39c12 (amber)
- Spider-Man: #ff4da6 (magenta-pink)
- Batman: #7eb8da (steel blue)
- X-Men: #9b59b6 (violet)
- Toy Story: #f7dc6f (soft yellow)
- Indiana Jones: #d4a574 (khaki)

### Typography
- Headings: System sans-serif stack, bold, uppercase for panel labels
- Body: System sans-serif, regular weight
- Stats: Large bold numbers for key metrics in profile card

### Animations
- Filter transitions: 600ms ease-in-out
- Hover highlights: 200ms fade
- Narrative pulse: 1s CSS pulse keyframe on highlighted dots
- Initial load: Rivers draw left-to-right, staggered 100ms per franchise
- Profile card mode switch: 300ms scale transform

## File Structure

```
CSC316-A3/
  index.html              # Single page app shell
  css/
    style.css             # All styles, dark theme, responsive
  js/
    main.js               # App init, data loading, filter state management
    river.js              # Franchise river timeline (swim-lane with revenue area pulses)
    trajectory.js         # Sequel slope chart
    dominance.js          # Stacked area chart
    profile.js            # Franchise/movie detail card
    annotations.js        # Narrative insight system
    state.js              # Shared state manager, cross-panel event bus
  data/
    franchises.json       # Pre-fetched TMDB data
    fetch_data.py         # Python script to rebuild dataset from TMDB API
```

## State Management

A simple event-bus pattern in `state.js`:

- Central state object holds: `brushRange`, `selectedFranchise`, `selectedMovie`, `activeFilters`, `currentInsight`
- Each panel registers listeners via `state.on('change', callback)`
- When any panel triggers a state change, all others receive the update and animate to new state
- State changes are debounced (50ms) to prevent cascading re-renders

## Deployment

- GitHub Pages from root folder of the repository
- URL pattern: `https://csc316-student.github.io/CSC316-A3/` (or similar)
- All assets are static — no build step required
- D3.js loaded via CDN

## Out of Scope

- Server-side logic or APIs at runtime
- User authentication or data persistence
- Mobile-optimized responsive layout (desktop-first, readable but not optimized for mobile)
- Accessibility beyond basic alt-text and keyboard navigation
