# EduROI — Higher Education Investment Calculator

> Going abroad for a degree is one of the biggest financial decisions you'll make. The excitement is real — but so are the numbers. EduROI puts those numbers in front of you: your investment, your opportunity cost, your projected returns. No fear, no hype. Just data, so you can decide with clarity.

EduROI is a financial modelling tool built specifically for Indian students evaluating a postgraduate degree abroad. It computes the full Net Present Value of studying in Germany, the USA, Canada, or the UK — and compares it against the counterfactual of staying in India — across a 20-year horizon.

---

## What problem does it solve?

When Indian students consider studying abroad, they typically focus on tuition fees and maybe the first salary. EduROI makes the complete picture visible:

- **What does it actually cost?** — Tuition, living expenses, visa/travel/setup, and the salary you give up while studying (opportunity cost)
- **When do you break even?** — The year your cumulative earnings abroad finally exceed what you would have earned staying in India, net of all costs
- **Is it worth it in 10 years? In 20?** — NPV-adjusted lifetime wealth comparison
- **What if things go differently?** — Sensitivity sliders let you stress-test the numbers in real time

---

## Features

### Core Calculator

- **4 destination countries** — Germany, USA, Canada, UK
- **4 fields of study** — Tech, Business, Sciences, Arts
- **Degree duration** — 1, 2, or 3 years
- **Full investment breakdown**:
  - Direct cost: tuition + living expenses + one-time setup costs
  - Opportunity cost: foregone India salary during the study period
  - Loan EMI: configurable loan amount, interest rate, and repayment period

### Financial Model

The model computes NPV (Net Present Value) — all future cash flows discounted to today's rupees — so numbers across different years are directly comparable.

**Study phase (S1, S2 ...)**
Each study year records the total cost (direct + opportunity cost), shown on the negative axis as the investment phase.

**Earning phase (Y1 ... Y20)**
For each earning year, the model computes:

```
Annual net (real) = (Abroad salary × exchange rate × INR drift) − India salary − Loan EMI
                    ─────────────────────────────────────────────────────────────────────
                                      (1 + inflation)^year
```

Cumulative NPV starts at `−Total Investment` on Day 1 and climbs toward zero (break-even) and beyond.

**"Plan to return" mode** — if you intend to move back to India after N years, the model switches to a premium India salary track from that year onward (India salary growth + 3% premium for international experience).

### 15 Refinement Inputs

Accessible via the "Refine your inputs" section:

| Section | Inputs |
|---|---|
| India situation | India salary growth rate, current age |
| Education costs | Monthly living cost abroad, one-time costs, loan amount, loan rate, repayment period |
| Return projections | Starting salary abroad, abroad salary growth rate, job search buffer, plan to return (+ return year) |
| Macro assumptions | INR depreciation rate, destination country inflation rate |

### Three Chart Views

**Wealth Trajectory** — Area chart showing cumulative India path vs. Abroad path in nominal ₹ lakhs across the full timeline (study years + 20 earning years).

**Net NPV** — Area chart of cumulative Net Present Value. Shows the exact break-even crossing (dashed reference line). The gradient switches from red (below zero) to green (above zero) at the break-even point. Includes an explainer box defining NPV and how to read the chart.

**Annual Gain** — Bar chart of the real purchasing-power advantage for each single year. Red bars = India would have been better that year; orange = abroad wins. Includes an explainer box on why bars may look similar and how to read trends.

All charts show the age of the user at each data point as a second row on the X-axis.

### Sensitivity Analysis

Three real-time sliders that update all charts and KPIs without re-clicking Calculate:

- **Salary adjustment** (−30% to +30%) — "What if the offer is lower than median?"
- **INR drift change** (−2% to +3%) — "What if the rupee holds its value?"
- **Job search delay** (0–15 months) — "What if it takes longer to find a job?"

### Key Metrics (Summary Cards)

- **Total Investment** — C₀ (direct costs) + B₀ (opportunity cost) combined
- **Break-even Year** — colour-coded: green (≤10 yrs), amber (≤15 yrs), red (>15 yrs)
- **10-Year NPV** — whether you're ahead of the India path a decade in
- **20-Year NPV** — full lifetime ROI signal

### Live Data Backend

A lightweight Express backend fetches and caches real-world data from two free public APIs:

| Endpoint | Source | Cache TTL |
|---|---|---|
| `/api/rates` | [frankfurter.app](https://frankfurter.app) — ECB-sourced FX rates | 24 hours |
| `/api/inflation` | [World Bank Open Data](https://data.worldbank.org) — CPI indicator | 7 days |
| `/api/defaults` | Local static file — salaries, living costs, growth rates | Static |

The frontend shows a live data indicator (green dot = live, amber = estimates) and the exact fetch timestamp. If any upstream API fails, the backend falls back to hardcoded defaults — the frontend never crashes.

### Export

Download all projected data as a CSV file — includes the year-by-year wealth table, summary KPIs, and all input parameters used for the run.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5 |
| Charts | Recharts |
| Icons | Lucide React |
| Fonts | Fraunces (display), DM Mono, DM Sans |
| Backend | Node.js, Express 4 |
| Data APIs | frankfurter.app, World Bank Open Data |
| Deployment | Vercel (frontend + serverless backend on same domain) |

---

## Project Structure

```
/
├── eduroi.jsx          # Main React component (entire frontend)
├── main.jsx            # React entry point
├── index.html          # HTML shell
├── vite.config.js      # Vite + React plugin config
├── package.json        # Frontend dependencies
├── vercel.json         # Vercel routing: /api/* → backend, /* → frontend
│
└── backend/
    ├── server.js       # Express app — 3 API routes + caching + fallback logic
    ├── cache.js        # In-memory TTL cache (no Redis)
    ├── defaults.js     # Static salary/living/growth data
    ├── package.json    # Backend dependencies
    ├── .env.example    # PORT=3001
    └── README.md       # Railway deployment guide (alternative to Vercel)
```

---

## Running Locally

**Prerequisites:** Node.js 18+

```bash
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies
cd backend && npm install && cd ..

# 3. Start the backend (Terminal 1)
cd backend && npm run dev
# → Running on http://localhost:3001

# 4. Start the frontend (Terminal 2)
npm run dev
# → Running on http://localhost:5173
```

The frontend automatically points to `http://localhost:3001` in development and uses relative URLs in production.

---

## Deploying to Vercel

Both the React frontend and the Express backend deploy to Vercel as a single project — the backend runs as a serverless function at `/api/*`.

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. No settings changes needed — `vercel.json` handles everything
4. Click **Deploy**

Vercel builds the frontend with `npm run build` and routes all `/api/*` requests to `backend/server.js` automatically.

---

## Data Sources & Assumptions

| Data point | Source | Notes |
|---|---|---|
| Exchange rates | frankfurter.app (ECB) | Updated daily, cached 24h |
| Destination inflation | World Bank CPI (FP.CPI.TOTL.ZG) | Most recent annual value, cached 7d |
| Salaries | 2024 market data (Glassdoor, Levels.fyi, LinkedIn Salary) | Median gross for each country + field |
| India salary growth | User input, default 8%/yr | Reflects ~historical IT sector growth |
| INR depreciation | User input, default 1.5%/yr | Conservative long-run average |
| Living costs | Numbeo estimates, curated per city tier | Monthly average including rent |
| Loan rate | Default 8.5% | Approximate Indian education loan rate |

All salary and cost figures are starting-point estimates. Use the refinement inputs to adjust them to your specific situation.

---

## Limitations

- Salaries are national medians — actual offers vary significantly by company, city, and negotiation
- The model does not account for taxes in the destination country (post-tax income would be lower)
- INR depreciation and inflation are assumed constant; real rates fluctuate
- PR/visa pathways, career switching, and non-financial factors (quality of life, network, family) are not modelled
- The "plan to return" premium (+3% growth) is a rough heuristic, not empirical data

Use EduROI as a thinking instrument to frame the decision quantitatively — not as a guarantee of outcomes.

---

*Built for Indian students. Data sourced from public APIs. No personal data collected or stored.*
