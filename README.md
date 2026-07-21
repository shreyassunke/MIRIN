# MIRIN

A personal workout tracker for logging progressive overload with minimal friction. React 18 + TypeScript + Vite + Tailwind CSS, with Dexie.js for offline IndexedDB persistence and Supabase for auth + background cloud sync.

## Run

```bash
npm install
cp .env.example .env   # then fill in Supabase URL + anon key
npm run dev            # dev server
npm run build          # type-check + production build
npm run preview        # serve dist/ locally
```

### Supabase auth setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the Project URL and the `anon` `public` key into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. In **Authentication → URL configuration**, add your local origin (e.g. `http://localhost:5174`) and production URL to the redirect allow list. Include the same origins under **Redirect URLs**.
4. Restart `npm run dev` after changing `.env`.

**Google** — Authentication → Providers → Google: enable it and add the Client ID / secret from [Google Cloud Console](https://console.cloud.google.com/) (OAuth web client). Authorized redirect URI should be `https://<project-ref>.supabase.co/auth/v1/callback`.

**Name** — collected on email sign-up and editable under **Profile**. Google usually fills it from the Google account.

Without those env vars the app opens the sign-in screen and explains what is missing. Email confirmation follows your Supabase Auth settings (disable it in Auth providers for the fastest local loop).

### Supabase sync setup

Logging still writes to IndexedDB first; sync runs in the background after sets are saved.

1. In the Supabase SQL Editor, run [`supabase/migrations/20260720120000_sync_documents.sql`](supabase/migrations/20260720120000_sync_documents.sql). That creates the `sync_documents` table and row-level security (each user only sees their own rows).
2. Sign in on a device — existing local history is uploaded on first bind. A second device pulls the same account after sign-in.
3. Profile shows sync status and a **Sync now** control. Offline changes queue locally and flush when you reconnect.

Free-tier Supabase is enough for personal use. Free projects pause after a week of inactivity; open the app (or the Supabase dashboard) to wake them.

## Deploy & use on iPhone

MIRIN is a **Progressive Web App**: deploy the `dist/` folder to any static host, then install it to your home screen. Set the same `VITE_SUPABASE_*` env vars in the host’s build settings. Workout logging writes to on-device IndexedDB first; auth and sync run through Supabase when online.

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
- `/profile` — display name, cloud sync status, and sign out.
- `/auth` — email or Google sign-in.

## Design

Design context lives in `PRODUCT.md` (strategy, register, anti-references) and `DESIGN.md` (locked palette and visual spec). Run `npx impeccable detect src/` to check for design anti-patterns; treat failures as blockers.

## Verification scripts

- `node scripts/screenshot.mjs` — screenshots every screen and exercises the logging flow in a headless browser (requires the dev server running and Playwright's Chromium installed).
- `node scripts/verify-with-data.mjs` — seeds three weeks of demo history into a throwaway browser profile and screenshots the data-filled charts.
- `node scripts/verify-mobile.mjs` — mobile wheel picker, logo, and lazy-route checks (set `BASE_URL` for preview builds).
