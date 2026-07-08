# MIRIN

A personal workout tracker for logging progressive overload with minimal friction. Fully client-side: React 18 + TypeScript + Vite + Tailwind CSS, with Dexie.js persisting everything to IndexedDB. No backend, no accounts.

## Run

```bash
npm install
npm run dev      # dev server
npm run build    # type-check + production build
npm run preview  # serve dist/ locally
```

## Deploy & use on iPhone

MIRIN is a **Progressive Web App**: deploy the `dist/` folder to any static host, then install it to your home screen. Workout data stays on your device (IndexedDB); nothing is sent to a server.

### 1. Deploy (pick one)

**Vercel** (recommended — repo includes `vercel.json`):

```bash
npm i -g vercel   # once
npm run build
vercel --prod
```

Or connect the GitHub repo at [vercel.com](https://vercel.com) — build command `npm run build`, output directory `dist`.

**Netlify** — `netlify.toml` is included. Connect the repo or:

```bash
npm i -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

**Cloudflare Pages** — build `npm run build`, output `dist`. SPA fallback comes from `public/_redirects` (copied into `dist/`).

All hosts need **HTTPS**. Client-side routes (`/today`, `/trends`, etc.) are handled by the included SPA fallback rules.

### 2. Install on iPhone

1. Open your deployed URL in **Safari** (Add to Home Screen works best in Safari, not Chrome).
2. Tap **Share** → **Add to Home Screen**.
3. Open **MIRIN** from the home screen — it runs full-screen like a native app.

After the first visit, a service worker caches the app shell so it loads offline at the gym. Your logged sets remain in on-device storage.

### Local testing on phone (same Wi‑Fi)

```bash
npm run dev -- --host
```

On iPhone Safari: `http://<your-computer-ip>:5174/today` (your PC must stay on; use a deployed URL for daily use).

## Screens

- `/today` — auto-detects the next day in the 5-day rotation (Push / Pull / Legs / Arms / Chest & Back), prefills last session's weight×reps, steppers + one-tap logging, auto-starting rest timer.
- `/exercise/:id` — estimated 1RM trend (Epley) and the last 10 sessions.
- `/trends` — overall volume per session, plus dedicated weak-point charts (Lateral Raise, Rear Delt Flye, Incline Press).
- `/split` — reorder exercises within each day; order is enforced on the logging screen.

## Design

Design context lives in `PRODUCT.md` (strategy, register, anti-references) and `DESIGN.md` (locked palette and visual spec). Run `npx impeccable detect src/` to check for design anti-patterns; treat failures as blockers.

## Verification scripts

- `node scripts/screenshot.mjs` — screenshots every screen and exercises the logging flow in a headless browser (requires the dev server running and Playwright's Chromium installed).
- `node scripts/verify-with-data.mjs` — seeds three weeks of demo history into a throwaway browser profile and screenshots the data-filled charts.
- `node scripts/verify-mobile.mjs` — mobile wheel picker, logo, and lazy-route checks (set `BASE_URL` for preview builds).
