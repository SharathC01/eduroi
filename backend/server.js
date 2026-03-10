import express from "express";
import cors from "cors";
import { get as cacheGet, set as cacheSet } from "./cache.js";
import { DEFAULTS } from "./defaults.js";
import "dotenv/config";
import { createClient } from "@vercel/kv";

const app = express();
app.use(cors());

const ONE_DAY = 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * ONE_DAY;

// Hardcoded fallbacks — used if API fails and no prior successful fetch is in cache
const FALLBACK_RATES = { EUR: 90.2, USD: 83.5, GBP: 106.0, CAD: 61.5 };
const FALLBACK_INFLATION = { Germany: 2.8, USA: 3.2, Canada: 3.0, UK: 4.0 };

// GET /api/rates — live EUR/USD/GBP/CAD → INR exchange rates
// Source: frankfurter.app (no API key required, updates daily)
// Cached for 24 hours
app.get("/api/rates", async (req, res) => {
  const cached = cacheGet("rates");
  if (cached) return res.json(cached);

  try {
    const currencies = ["EUR", "USD", "GBP", "CAD"];
    const results = await Promise.all(
      currencies.map((c) =>
        fetch(`https://api.frankfurter.app/latest?from=${c}&to=INR`)
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          })
          .then((d) => ({ [c]: d.rates?.INR }))
      )
    );

    const rates = Object.assign({}, ...results);
    if (Object.values(rates).some((v) => !v)) throw new Error("Incomplete rates from API");

    cacheSet("rates", rates, ONE_DAY);
    cacheSet("rates_stale", rates, SEVEN_DAYS * 52); // long-lived fallback updated on each success
    res.json(rates);
  } catch (err) {
    console.error("[/api/rates] upstream failed:", err.message);
    const stale = cacheGet("rates_stale");
    res.json(stale || FALLBACK_RATES);
  }
});

// GET /api/inflation — latest annual CPI inflation for each destination country
// Source: World Bank Open Data (no API key, updates quarterly)
// Cached for 7 days
app.get("/api/inflation", async (req, res) => {
  const cached = cacheGet("inflation");
  if (cached) return res.json(cached);

  const COUNTRY_CODES = { Germany: "DE", USA: "US", Canada: "CA", UK: "GB" };

  try {
    const results = await Promise.all(
      Object.entries(COUNTRY_CODES).map(([name, code]) =>
        fetch(
          `https://api.worldbank.org/v2/country/${code}/indicator/FP.CPI.TOTL.ZG?format=json&mrv=1`
        )
          .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          })
          .then((d) => {
            const val = d[1]?.[0]?.value;
            return { [name]: val != null ? parseFloat(val.toFixed(1)) : null };
          })
      )
    );

    const inflation = Object.assign({}, ...results);
    if (Object.values(inflation).some((v) => v == null)) throw new Error("Incomplete inflation from API");

    cacheSet("inflation", inflation, SEVEN_DAYS);
    cacheSet("inflation_stale", inflation, SEVEN_DAYS * 52);
    res.json(inflation);
  } catch (err) {
    console.error("[/api/inflation] upstream failed:", err.message);
    const stale = cacheGet("inflation_stale");
    res.json(stale || FALLBACK_INFLATION);
  }
});

// GET /api/defaults — static curated data (salaries, living costs, loan rates, growth rates)
// No external API; just serves the local defaults.js file
app.get("/api/defaults", (req, res) => {
  res.json(DEFAULTS);
});

// GET /api/visits — persistent page-view counter backed by Vercel KV (free Redis)
// Increments on every call, returns the running total
app.get("/api/visits", async (req, res) => {
  try {
    const kv = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    const count = await kv.incr("eduroi_visits");
    res.json({ count });
  } catch {
    // KV not configured (local dev) or unavailable — return null silently
    res.json({ count: null });
  }
});

// Export for Vercel serverless — Vercel calls the handler directly, no listen() needed
export default app;

// Start local server when not running on Vercel
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`EduROI backend running on port ${PORT}`);
    console.log(`  GET /api/rates      — live exchange rates (24h cache)`);
    console.log(`  GET /api/inflation  — World Bank CPI data (7d cache)`);
    console.log(`  GET /api/defaults   — static salary/cost data`);
  });
}
