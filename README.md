# Goal Quest

A medieval-flavored chronicle that turns your goals into quests, milestones, and treasure chests.
Every goal is worth **100 points**; you define milestones (1–99pt) and the reward you'll give
yourself at each one. Logged actions become XP, climb the **Hall of Fame**, and write your
**Chronicle of deeds**.

→ Live: https://mramundo.github.io/goal-quest/

---

## Stack

No build step, no framework. All you need is a modern browser.

- **HTML5** + **CSS custom properties** (token-based design system, 4 palettes × dark/light)
- **ES modules** loaded directly by the browser (`<script type="module">`)
- **localStorage** as the single source of truth (data is private, lives in this browser)
- **GitHub Pages** for deploy (workflow uploads the whole repo — nothing to compile)

## Themes

| Palette | Mood |
| --- | --- |
| **Parchment** *(default)* | Warm browns, scribe's gold, ink |
| **Tavern** | Copper, ale, flickering candles |
| **Elven Forest** | Deep greens, silver, filtered light |
| **Frozen Realm** | Glacier blues, indigo, snow |

Every palette has a light and dark mode. The picker in the top-right switches on the fly.

## How it works

1. **Forge a quest** — give it a name, pick an icon, describe the undertaking briefly.
2. **Define the chests** — each milestone (1–99 pt) comes with a reward you'll give yourself.
3. **Log actions** — use topic-based presets or a free-form action with a points slider.
4. **Climb the Hall of Fame** — outpace legendary champions' XP and rise through the ranks.
5. **Reread your Chronicle** — every logged action stays forever in the scroll.

## Local development

Only a static HTTP server is needed (ES modules require an origin, not `file://`).

```bash
# Python 3
python3 -m http.server 8000

# or with Node
npx serve .
```

Open `http://localhost:8000` and you're off.

## Structure

```
goal-quest/
├── index.html              # main markup (topbar, hero, sections, onboarding, footer)
├── styles/
│   └── main.css            # design system (4 palettes × dark/light)
├── scripts/
│   ├── app.js              # entry: theme, store, boot, hero recap
│   ├── quests.js           # list + inline detail + inline composer
│   ├── progress.js         # inline log composer, chronicle, toasts
│   └── hall.js             # Hall of Fame leaderboard
├── data/
│   ├── quests.seed.json    # initial examples (first run only)
│   ├── heroes.seed.json    # legendary champions of the Hall
│   └── actions-library.json# per-topic action presets
├── assets/
│   └── favicon.svg
└── .github/workflows/
    └── pages.yml           # GitHub Pages deploy
```

## Data

Everything stays in your browser under these `localStorage` keys:

- `gq-quests` — quests with milestones
- `gq-log` — action history
- `gq-profile` — hero name and title
- `gq-palette`, `gq-mode` — theme preferences
- `gq-seeded` — flag "we've already loaded the initial examples"

Secret shortcut: `Ctrl + Shift + E` exports a JSON of all state (handy for manual backups).

## Deploy

Every push to `main` regenerates the site. The workflow is [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
and simply uploads the whole repo as a Pages artifact — no build, nothing to compile.

## License

MIT. Play fair.
