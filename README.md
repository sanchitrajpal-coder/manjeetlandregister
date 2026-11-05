# Manjeet Land Register

Family land register for the Manjeet Group: parcels, state title records (7/12 and equivalents), property document sets with AI reading, and a map with government plot boundaries.

## Deploy on Railway (first time)

1. **New project → Deploy from GitHub repo** → `sanchitrajpal-coder/manjeetlandregister`. Railway builds the Dockerfile.
2. **Add Postgres**: in the project, *+ New → Database → PostgreSQL*. Then on the app service → *Variables* → add `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`.
3. **Add a volume** for the documents: app service → *Settings → Volumes → Add volume*, mount path `/data`.
4. **Variables** on the app service:
   - `SESSION_SECRET` — any long random string
   - `ADMIN_PASSWORD` — the admin login's password (user `admin`)
   - `VIEWER_PASSWORD` — the read-only login's password (user `viewer`)
   - `ANTHROPIC_API_KEY` — from console.anthropic.com; turns on document reading
   - `AI_MODEL` — optional, default `claude-sonnet-4-5`
5. **Networking → Generate domain**. Open it, sign in as `admin`.

On first boot the app creates its tables and loads the 451 parcels from `seed/data.json` (the register as published on 3 Aug 2026). Nothing else to set up.

## After it is up

- **Settings → Users**: add editors (plant heads, accounts) and viewers.
- **Title records → Merge records file**: load `seed/gevrai-gat50-records.json` to bring in the Gevrai gat 50 pull. Its highlighted 7/12 image is already served at `/records/gevrai-gat50.jpg`.
- **Map → Fetch govt boundaries**: pulls plot outlines and owner lists from Mahabhunakasha for every parcel whose village code is known (set the code on the parcel from Mahabhulekh — the 18-digit value in the village dropdown).
- **Documents**: open a property, drop its PDF set on the box. Reading starts automatically when `ANTHROPIC_API_KEY` is set; observations appear on the property and on the Documents tab.

## Local run

```
createdb mlr
DATABASE_URL=postgres://localhost/mlr DATA_DIR=./data npm start
```

## Layout

- `server/index.js` — API and static hosting
- `server/db.js` — schema (created on boot)
- `server/seed.js` — one-time load of the old register
- `server/bhunaksha.js` — government map adapter (MH, MP, RJ)
- `server/reader.js` — document reader (pdftoppm → Claude vision → merged summary)
- `public/` — the app (plain JS, no build step)
