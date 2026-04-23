# Goal Quest

Una cronaca medievale per trasformare i tuoi obiettivi in imprese: quest, tappe intermedie e forzieri.
Ogni obiettivo vale **100 punti**; definisci le tappe (1–99pt) e il premio che ti regalerai al raggiungimento.
Le azioni registrate diventano XP, ti fanno salire di rango nella **Sala d'Onore** e scrivono la tua
**Pergamena delle gesta**.

→ Live: https://mramundo.github.io/goal-quest/

---

## Stack

Nessun build step, nessun framework. Tutto ciò che ti serve è un browser moderno.

- **HTML5** + **CSS custom properties** (design system a token, 4 palette × dark/light)
- **ES modules** caricati direttamente dal browser (`<script type="module">`)
- **localStorage** come unica fonte di verità (dati privati, legati al browser)
- **GitHub Pages** per il deploy (workflow che carica l'intera repo senza compilare)

## Temi

| Palette | Atmosfera |
| --- | --- |
| **Pergamena** *(default)* | Marroni caldi, oro scriba, inchiostro |
| **Taverna** | Rame, birra, candele tremolanti |
| **Foresta Elfica** | Verdi profondi, argento, luce filtrata |
| **Regno di Ghiaccio** | Blu di ghiacciaio, indaco, neve |

Ogni palette ha modalità chiara e scura. Il picker in alto a destra cambia palette al volo.

## Come funziona

1. **Forgia una quest**: dai un nome, scegli un'icona, descrivi brevemente l'impresa.
2. **Definisci i forzieri**: ogni tappa (1–99 pt) ha un premio che ti regalerai al raggiungimento.
3. **Registra le azioni**: preset per tema oppure azione libera con slider dei punti.
4. **Sali nella Sala d'Onore**: supera gli XP dei campioni leggendari e scala la classifica.
5. **Rileggi la Pergamena**: ogni azione registrata resta per sempre nella tua cronaca.

## Sviluppo locale

Serve solo un server HTTP statico (gli ES modules richiedono un'origin, non `file://`).

```bash
# Python 3
python3 -m http.server 8000

# oppure con Node
npx serve .
```

Apri `http://localhost:8000` e sei operativo.

## Struttura

```
goal-quest/
├── index.html              # markup principale (header, hero, sezioni, dialog)
├── styles/
│   └── main.css            # design system (4 palette × dark/light)
├── scripts/
│   ├── app.js              # entry: tema, store, boot, livelli
│   ├── quests.js           # lista + drawer + modale "Forgia quest"
│   ├── progress.js         # modale "Registra azione", celebrazione, pergamena
│   └── hall.js             # Sala d'Onore
├── data/
│   ├── quests.seed.json    # esempi iniziali (solo al primo avvio)
│   ├── heroes.seed.json    # campioni leggendari della Sala d'Onore
│   └── actions-library.json# preset azioni per tema
├── assets/
│   └── favicon.svg
└── .github/workflows/
    └── pages.yml           # deploy GitHub Pages
```

## Dati

Tutto resta nel tuo browser sotto questi key di `localStorage`:

- `gq-quests` — quest con milestones
- `gq-log` — cronologia azioni
- `gq-profile` — nome/titolo del cavaliere
- `gq-palette`, `gq-mode` — preferenze di tema
- `gq-seeded` — flag "abbiamo già mostrato gli esempi iniziali"

Shortcut segreto: `Ctrl + Shift + E` esporta un JSON con tutto lo stato (utile per backup manuali).

## Deploy

Ogni push su `main` rigenera il sito. Il workflow è [`.github/workflows/pages.yml`](.github/workflows/pages.yml) e
si limita a caricare l'intera repo come artifact di Pages — nessun build, nessun framework da compilare.

## Licenza

MIT. Gioca onestamente.
