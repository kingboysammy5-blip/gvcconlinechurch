# Deployment & Database Setup Guide — Gracious Voice Celebration Centre (GVCC)

This project includes everything needed to build and deploy cleanly to **Vercel** or **Netlify**, while ensuring all **67 church photographs (`/images/church/photo_00.jpg`–`photo_66.jpg`)**, **graphics (`/src/assets/images/...`)**, **server API routes (`/api/*`)**, **PostgreSQL database**, and **Firebase Auth & Firestore** work in production.

---

## 1. Included Deployment & Database Files

- **Vercel**: `vercel.json`, `api/index.ts`
- **Netlify**: `netlify.toml`, `netlify/functions/api.ts`, `public/_redirects`
- **Database Schema & Seeding**: `database/schema.sql`, `database/seed.sql`, `src/db/schema.ts`, `src/db/runSeed.ts`, `src/db/drizzle.config.ts`
- **Verified Baseline Fallback**: `src/data/gvccDefaultBootstrap.ts` (ensures church identity, slides, Bishop profile, and all 67 gallery photos render immediately even before external database environment variables are attached)
- **Firebase Rules & Config**: `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `firebase-applet-config.json`
- **Environment Template**: `.env.example`

---

## 2. Database Setup (PostgreSQL — Neon, Vercel Postgres, Supabase, Railway, or Cloud SQL)

Set **either** `DATABASE_URL` (recommended for Vercel/Netlify) **or** individual `SQL_HOST` / `SQL_USER` / `SQL_PASSWORD` / `SQL_DB_NAME` variables in your host's Environment Variables panel.

### Option A: Push Schema + Seed via CLI
```bash
npm run db:push
npm run db:seed
```

### Option B: Run Raw SQL Scripts Directly
Execute the two idempotent SQL files in order inside your PostgreSQL SQL Editor or via `psql`:
1. `database/schema.sql` — Creates all 24 tables and indexes.
2. `database/seed.sql` — Seeds GVCC settings (`2 Timothy 4:2–5`, `GVCC TV LIVE`, `2 Corinthians 9:7`), Bishop Joseph Ondari Gichana, 6 homepage slides, fellowships, ministries, and all 67 real church photographs.

---

## 3. Deploying to Vercel

1. Connect your repository in Vercel.
2. **Framework Preset**: Vite (uses `vercel.json`: `buildCommand: "npm run build"`, `outputDirectory: "dist"`).
3. Add Environment Variables in Vercel Project Settings:
   - `DATABASE_URL` (or `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`)
   - `GEMINI_API_KEY` (required for Scripture & Ministry Research)
   - `ADMIN_PORTAL_PASSCODE` (defaults to `1234`)
   - `ADMIN_TOKEN_SECRET` (long random secret string)
4. Deploy. All images in `public/images/church/`, graphics in `src/assets/images/`, and `/api/*` routes via `api/index.ts` will be live.

---

## 4. Deploying to Netlify

1. Connect your repository in Netlify.
2. Netlify automatically reads `netlify.toml` (`npm run build`, publishes `dist/`, bundles `netlify/functions/api.ts` with `esbuild`).
3. Add the same Environment Variables (`DATABASE_URL`, `GEMINI_API_KEY`, `ADMIN_PORTAL_PASSCODE`, `ADMIN_TOKEN_SECRET`) in **Site Configuration → Environment Variables**.
4. Deploy.

---

## 5. Firebase Auth & Firestore Authorized Domains

After deploying to Vercel (`*.vercel.app`) or Netlify (`*.netlify.app`):
1. Open **Firebase Console → Authentication → Settings → Authorized domains** for project `silent-style-97cvm`.
2. Add your production Vercel / Netlify domain (and any custom domain) so Google / Email sign-in works seamlessly.
3. Deploy rules/indexes if needed via Firebase CLI:
   ```bash
   firebase deploy --only firestore
   ```
