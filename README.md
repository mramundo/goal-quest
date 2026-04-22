# ⚔️ Goal Quest

> Una piattaforma di gamification a tema medievale per incentivare il raggiungimento
> degli obiettivi. Crea gilde, scrivi quest, spezzale in tappe, conquista forzieri.

Questa è una **POC** (proof of concept) costruita come SPA con React + Vite, che
usa un repository GitHub come database (JSON + GitHub API) e viene deployata su
GitHub Pages. Nessuna infrastruttura a pagamento.

---

## 🧭 Funzionalità

- **Login** con username + PIN (hash SHA-256) salvato in `data/users.json`.
- **Registrazione** tramite GitHub issue: il form compila un template, l'admin
  aggiunge la label `approved` e una GitHub Action appende l'utente.
- **Gilde** pubbliche o private (con PIN) tematiche.
- **Quest** con obiettivo finale su scala 0–100 e **N milestone intermedie**
  (1–99), ognuna con un premio configurabile.
- **Sistema di suggerimenti premi** basato sul testo dell'obiettivo (euristica
  keyword → pool di premi a tema).
- **Log progressi** con azioni quantificate in punti (+ preset suggeriti).
- **Leaderboard** per quest e **celebrazione** animata al raggiungimento delle
  milestone.
- **XP / livelli** cumulati sull'utente, con titoli medievali
  (Novizio → Leggenda).
- **4 temi** (Pergamena, Taverna, Foresta Elfica, Regno di Ghiaccio) ciascuno
  con variante light e dark. Il tema si applica cambiando un attributo sul
  `<html>`, nessun re-render del tree.
- **Mobile-first**, con bottom navigation su schermi piccoli e safe-area
  insets.

## 🏗️ Architettura

```
┌──────────────────┐      raw.githubusercontent.com       ┌──────────────┐
│  SPA (Vite/React)│ ────────────────────── READ ─────────▶│ data/*.json  │
│  GitHub Pages    │                                        │   (main)     │
│  mramundo.github │ ──── PUT /repos/.../contents ─────────▶│              │
│  .io/goal-quest  │       (Bearer PAT in bundle)           └──────────────┘
└──────────────────┘
```

- **Lettura**: via `raw.githubusercontent.com` senza auth, cache disattivata.
- **Scrittura**: GitHub Contents API con PAT fine-grained (nel bundle).
- **Cache**: in-memory + `localStorage` come write-through.
- **Concorrenza**: retry automatico su conflitto SHA (3 tentativi).

### ⚠️ Sicurezza (POC)

Il PAT viene incluso nel bundle JavaScript. Chi ispeziona il sito può
estrarlo e scrivere direttamente sul repo. Mitigazioni per questa POC:

1. Usa un PAT **fine-grained** scoped al **solo** repo `goal-quest`.
2. Dai al PAT **solo** il permesso `Contents: Read and write`.
3. Non mettere dati sensibili nei JSON: qui il PIN è SHA-256, ma la rinascita
   è banale se il PIN è debole.

Per produzione: mettere le scritture dietro un proxy (Cloudflare Worker,
Supabase Edge Function), o migrare a un backend vero (Supabase).

## 🚀 Setup (prima volta)

### 1. Clona e installa

```bash
git clone https://github.com/mramundo/goal-quest.git
cd goal-quest
npm install
```

### 2. Crea il PAT

1. Vai su <https://github.com/settings/tokens?type=beta>
2. "Generate new token" → **Fine-grained**
3. Repository access → *Only select repositories* → `goal-quest`
4. Repository permissions → **Contents: Read and write**
5. Copia il token (inizia con `github_pat_...`)

### 3. Configura `.env.local`

```bash
cp .env.example .env.local
# apri .env.local e incolla VITE_GITHUB_TOKEN=github_pat_xxx
```

### 4. Avvio in locale

```bash
npm run dev
```

App su <http://localhost:5173/goal-quest/>.

Login demo: `cavaliere` / PIN `1234`.

### 5. Deploy su GitHub Pages

1. Pusha il repo su `main`.
2. Su GitHub: **Settings → Pages → Source: GitHub Actions**.
3. Su GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**:
   - Nome: `GOAL_QUEST_WRITE_TOKEN`
   - Valore: il PAT creato al punto 2.
4. Il workflow `.github/workflows/deploy.yml` farà build + deploy ad ogni
   push su `main`.
5. Sito: <https://mramundo.github.io/goal-quest/>.

## 👑 Gestire i nuovi utenti

Quando un aspirante cavaliere clicca "Richiedi accesso al Regno":

1. Si apre una issue con i suoi dati + **hash SHA-256** del PIN.
2. Come admin, apri la issue e controllala.
3. Se vuoi approvare → aggiungi la label **`approved`**.
4. Il workflow `approve-user.yml` aggiunge l'utente a `data/users.json` e
   chiude l'issue.
5. L'utente può loggarsi con il PIN originale (che solo lui conosce).

Per respingere una richiesta, chiudi l'issue senza aggiungere la label.

### Approvazione manuale (senza workflow)

Se preferisci gestire a mano, aggiungi una riga a `data/users.json`:

```json
{
  "id": "usr_xxxxxxxx",
  "username": "merlino42",
  "displayName": "Merlino il Saggio",
  "pinHash": "<lo copi dal form dell'issue>",
  "createdAt": "2026-04-22T10:00:00.000Z",
  "totalXp": 0,
  "title": "Novizio"
}
```

## 🗂️ Struttura

```
goal-quest/
├── data/                        # "Database": JSON che vengono letti/scritti a runtime
│   ├── users.json
│   ├── groups.json
│   ├── memberships.json
│   ├── goals.json
│   └── progress.json
├── .github/
│   ├── ISSUE_TEMPLATE/registration.yml
│   └── workflows/
│       ├── deploy.yml           # build + pages deploy
│       └── approve-user.yml     # auto-approva con label "approved"
├── public/favicon.svg
├── src/
│   ├── components/
│   │   ├── layout/              # AppShell, ThemeProvider, ThemeSwitcher, RouteGuard
│   │   └── ui/                  # Button, Card, Dialog, Input, Progress, Badge, ...
│   ├── lib/
│   │   ├── config.ts            # env + endpoint builder
│   │   ├── github-api.ts        # wrapper Contents API
│   │   ├── db.ts                # CRUD sopra le collection
│   │   ├── queries.ts           # aggregazioni: leaderboard, suggerimenti premi
│   │   └── utils.ts             # cn, uid, sha256, titleForXp, levelForXp
│   ├── pages/                   # Una pagina per view
│   ├── store/                   # Zustand stores: auth, theme
│   ├── types/                   # Tipi di dominio
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css                # Theme tokens per le 4 palette
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

## 🧪 Demo rapida

```
Username: cavaliere
PIN:      1234
```

Da loggato puoi:
- Fondare una gilda e invitare l'autore via PIN.
- Creare una quest con N milestone, il sistema ti suggerisce premi.
- Loggare progressi: vedrai la tua XP salire e i forzieri sbloccarsi con
  animazione celebrativa.

## 📜 Licenza

MIT.
