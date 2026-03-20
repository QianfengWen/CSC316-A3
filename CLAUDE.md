# CSC316-A3: The Franchise Machine

Interactive D3.js visualization exploring movie franchise performance, deployed on GitHub Pages.

## Design Context

### Users
CSC316 students, TAs, and professor evaluating an interactive visualization assignment. Viewers should be able to freely explore franchise data across multiple dimensions (revenue, ratings, budget, timeline) and discover patterns like sequel fatigue, franchise dominance, and outlier successes.

### Brand Personality
Cinematic, immersive, data-rich.

### Aesthetic Direction
- **Visual tone**: Netflix-style — dark, image-heavy, smooth transitions, cinematic feel
- **Theme**: Dark background (#1a1a2e base), gold accents (#f0c040), per-franchise colors that pop against dark
- **Anti-references**: Must NOT look like a generic Tableau/PowerBI dashboard or a plain academic homework assignment
- **Typography**: Clean sans-serif, clear hierarchy, legible on dark backgrounds

### Design Principles
1. **Cinematic immersion** — The dark theme and smooth animations should make exploring data feel like browsing a premium movie platform, not reading a spreadsheet
2. **Linked discovery** — Every interaction in one panel should ripple meaningfully across others, rewarding curiosity
3. **Creative encodings** — Franchise rivers, not bar charts. The visual form should feel novel and memorable
4. **Guided freedom** — Narrative annotations provide entry points, but the viewer controls the journey
5. **Polish over scope** — A few well-crafted panels with smooth transitions beat many half-finished views

## Tech Stack
- D3.js v7
- Vanilla HTML/CSS/JS (no frameworks)
- Static JSON data (pre-fetched from TMDB)
- GitHub Pages deployment
