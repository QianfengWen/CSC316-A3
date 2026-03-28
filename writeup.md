# The Franchise Machine: Interactive Visualization Write-Up

**CSC316 Assignment 3 — Interactive Visualization**
**Deployed URL:** https://qianfengwen.github.io/CSC316-A3/

---

## Design Rationale

### Dataset & Motivation

I chose to explore the performance trajectories of 16 major Hollywood movie franchises spanning 1970–2025, using data pre-fetched from The Movie Database (TMDB) API. Franchises are a compelling domain for interactive visualization because they naturally invite multi-dimensional comparison: audiences intuitively wonder *which franchise earns the most?*, *do sequels get worse over time?*, and *when did superhero movies start dominating the box office?* These questions require cross-referencing revenue, ratings, timeline, and sequel order — a task well-suited to linked interactive views.

### Visual Encodings

The visualization comprises four coordinated panels, each chosen to address a different facet of the data:

- **Franchise Rivers** (top-left): A horizontal swim-lane timeline where each franchise occupies a fixed lane. Individual movies are plotted as dots (x = release year, size = revenue, opacity = rating), connected by area fills whose height encodes revenue. I chose swim-lanes over a streamgraph to avoid overlapping areas that would make individual franchises hard to trace. The "pulse" effect — areas tapering between releases — visually conveys the rhythm of franchise activity without clutter.

- **Sequel Trajectory** (top-right): A slope chart showing how a chosen metric (rating, revenue, or budget) evolves across sequel entries. Each franchise is a colored line. Reboots (e.g., Spider-Man's Raimi → Webb → MCU eras) appear as separate segments connected by dashed lines, distinguishing genuine sequel fatigue from reboot resets. I considered a small-multiples layout but found a single overlaid chart more effective for direct comparison.

- **Franchise Dominance** (bottom-left): A stacked area chart showing each franchise's share of total box office revenue per year. This reveals macro-level trends — such as the MCU's explosive growth post-2012 — that are invisible in the per-franchise views. A stacked bar chart was an alternative, but the continuous area better conveys temporal flow.

- **Franchise Profile** (bottom-right): A detail card that switches between franchise-level aggregates and individual movie details on click. This serves as the details-on-demand layer, keeping the main charts uncluttered while still providing precise numbers, poster images, and genre tags.

### Interaction & Animation Techniques

The core interaction principle is **linked discovery**: every action in one panel ripples across all others.

- **Temporal brushing** on the river chart filters all panels to a selected year range, enabling users to isolate specific eras (e.g., the 2008–2012 superhero boom).
- **Hover + click locking** lets users highlight a franchise across all views. Clicking locks the selection so it persists during further exploration; clicking again or elsewhere unlocks it. Non-selected franchises dim to 10–30% opacity rather than disappearing entirely, preserving context.
- **Dynamic query filters** (genre multi-select, year range slider, minimum entries dropdown, metric selector) enable systematic exploration along different dimensions.
- **Narrative annotations** auto-advance through curated insights (e.g., "The MCU's Phase 3 alone out-earned the entire Harry Potter franchise"), with each annotation triggering pulsing highlights on relevant data points across all panels. This provides guided entry points while leaving the viewer in control.

All transitions use 600ms ease-in-out easing to maintain the cinematic feel described in our design goals. Panel updates, filter changes, and brush interactions all animate smoothly rather than snapping, which rewards exploration and makes state changes easy to follow.

### Aesthetic Choices

I adopted a dark, Netflix-inspired theme (#1a1a2e base, #f0c040 gold accents) with the cinematic display font Bebas Neue for headings. The dark background allows the franchise-specific colors to pop, and the gold accents draw attention to interactive affordances. This was a deliberate departure from the typical light-background academic chart — the goal was to make data exploration feel immersive rather than clinical.

---

## Development Process

### Working Process & Timeline

Development took approximately 18–20 people-hours across two weeks, broken into the following phases:

1. **Data preparation (~2 hrs):** I wrote a Python script to fetch franchise data from the TMDB API, then augmented it with synthetic entries to ensure all 16 franchises had sufficient data points. The annotation insights were hand-curated after exploratory analysis of the dataset.

2. **Design & scaffolding (~3 hrs):** I drafted a detailed design spec (layout, encoding choices, interaction model, color palette) before writing any visualization code. This upfront planning saved significant time by preventing mid-implementation redesigns.

3. **Core implementation (~8 hrs):** Building the four panels, the central state manager, and the cross-panel linking logic. The state manager uses an event-bus pattern — all panels subscribe to a single `change` event, and state mutations are debounced at 50ms to prevent cascading re-renders. The river chart's area generation was the most technically challenging component, requiring custom D3 area generators with tapering logic.

4. **Interaction polish (~3 hrs):** Implementing brush-to-filter propagation, hover/click locking semantics, and the annotation highlight system. Getting the lock/unlock behavior to feel intuitive (click to lock, click same to unlock, click different to switch) required careful state management.

5. **Post-critique polish (~3 hrs):** After the peer review session, I addressed feedback on legend readability, typography hierarchy, filter behavior, panel scrolling, and empty-state handling.

### Use of LLMs

I used Claude as a coding assistant during development. It was most helpful for scaffolding repetitive setup work, suggesting D3 patterns, and helping debug issues in the cross-panel interaction logic. I treated the LLM as a support tool rather than as the source of the design itself: I still reviewed, revised, and integrated the code manually, especially when refining the visual design, adjusting interaction behavior, and handling edge cases. The parts that required the most direct effort from me were the aesthetic tuning (colors, spacing, typography) and the final rounds of browser-based debugging, since those depended on iterative judgment rather than code generation alone.

### Aspects That Took the Most Time

The cross-panel linking and state management consumed the most development time. Ensuring that brush selections, hover highlights, filter changes, and annotation highlights all compose correctly without conflicting or causing flickering required careful thought about state priorities and transition timing. The river chart's custom area encoding — with revenue-proportional height and inter-release tapering — was also non-trivial to implement with D3's area generators.

---

## Acknowledgments

- **Data source:** [The Movie Database (TMDB)](https://www.themoviedb.org/) — used under their API terms of service
- **Visualization library:** [D3.js v7](https://d3js.org/) by Mike Bostock et al.
- **Typography:** [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue) via Google Fonts
- **Development assistance:** Claude (Anthropic) was used as a coding assistant during development
- **Inspiration:** The NameGrapher application (for interaction design philosophy), Netflix's UI (for dark-theme aesthetic direction)
