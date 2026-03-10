# EduROI Backend

Lightweight Node.js + Express data proxy. Fetches live exchange rates and inflation data from free public APIs and serves them to the React frontend. No database, no user data, no paid API keys.

## Endpoints

| Route | Source | Cache |
|---|---|---|
| `GET /api/rates` | [frankfurter.app](https://frankfurter.app) | 24 hours |
| `GET /api/inflation` | [World Bank Open Data](https://data.worldbank.org) | 7 days |
| `GET /api/defaults` | Local static file | None (static) |

## Running locally

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Server starts on `http://localhost:3001` (or the `PORT` in `.env`).

## Deploying free on Railway

Railway gives you a free tier with no credit card for small projects.

1. **Push `/backend` to GitHub** — either as a subfolder of the main repo, or as a separate repo. If it's a subfolder, Railway can still target it via the root directory setting.

2. **Connect to Railway**
   - Go to [railway.app](https://railway.app) and sign in with GitHub
   - Click **New Project → Deploy from GitHub repo**
   - Select your repo; set **Root Directory** to `backend` if it's a subfolder

3. **Set environment variables**
   - In the Railway dashboard, go to your service → **Variables**
   - Add `PORT` = `3001` (Railway also injects its own `PORT` automatically — the app reads whichever is set)

4. **Railway auto-deploys on push** — every `git push` to the connected branch triggers a redeploy.

5. **Update the frontend** — after deploying, copy your Railway public URL (e.g. `https://eduroi-backend.railway.app`) and update the single constant at the top of the frontend fetch utility:

   ```js
   // In eduroi.jsx, near the top:
   const API_BASE_URL = 'https://eduroi-backend.railway.app';
   ```

That's it. The frontend will now use live data instead of local estimates.
