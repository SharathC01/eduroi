import { useState, useMemo, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid
} from "recharts";
import { Download, TrendingUp, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

const C = {
  bg: '#262220', surface: '#302C29', surface2: '#3A3633',
  border: '#524D49', text: '#FAFAF9', muted: '#D6D3D1', faint: '#A8A29E',
  accent: '#F97316', accentDim: 'rgba(249,115,22,0.10)',
  positive: '#86EFAC', posDim: 'rgba(134,239,172,0.08)',
  negative: '#FCA5A5', negDim: 'rgba(252,165,165,0.08)',
};
const F = {
  display: "'Fraunces', Georgia, serif",
  mono: "'DM Mono', 'Courier New', monospace",
  body: "'DM Sans', system-ui, sans-serif",
};

// In production (Vercel), API is on the same domain — use relative URLs.
// In local dev, the backend runs separately on port 3001.
const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:3001';

const COUNTRY_DEFAULTS = {
  Germany: { flag:"🇩🇪", currency:"EUR", symbol:"€", rate:90.2, salary:{Tech:65000,Business:56000,Sciences:52000,Arts:42000}, living:1400, inflation:2.8, growth:3.0, loanRate:8.5 },
  USA:     { flag:"🇺🇸", currency:"USD", symbol:"$", rate:83.5, salary:{Tech:95000,Business:85000,Sciences:72000,Arts:58000}, living:2200, inflation:3.2, growth:4.5, loanRate:8.5 },
  Canada:  { flag:"🇨🇦", currency:"CAD", symbol:"CA$", rate:61.5, salary:{Tech:78000,Business:68000,Sciences:64000,Arts:50000}, living:1800, inflation:3.0, growth:3.5, loanRate:8.5 },
  UK:      { flag:"🇬🇧", currency:"GBP", symbol:"£", rate:106.0, salary:{Tech:52000,Business:48000,Sciences:45000,Arts:36000}, living:1900, inflation:4.0, growth:3.0, loanRate:8.5 },
};

function calcROI(inp) {
  const co = inp.co;
  const dur = inp.duration || 2;
  const drift = (inp.inrDrift || 1.5) / 100;
  const tuitionINR = (inp.tuition || 20000) * dur * co.rate;
  const livingINR = (inp.livingCost || co.living) * 12 * dur * co.rate;
  const C0 = tuitionINR + livingINR + (inp.oneTime || 200000);
  const indiaSalAnn = (inp.currentSalary || 80000) * 12;
  const jobBuf = inp.jobSearchMonths ?? 3;
  const B0 = indiaSalAnn * (dur + jobBuf / 12);
  const totalInv = C0 + B0;
  const loanAmt = inp.loanAmount || 0;
  const mlr = (inp.loanRate || co.loanRate) / 100 / 12;
  const n = (inp.loanYears || 10) * 12;
  const emi = loanAmt > 0 ? loanAmt * mlr * Math.pow(1+mlr,n) / (Math.pow(1+mlr,n)-1) : 0;
  const annualLoan = emi * 12;
  const indGrowth = (inp.indiaSalaryGrowth || 8) / 100;
  const baseSal = (inp.abroadSalary || co.salary[inp.field || "Tech"]) * (inp.salaryMult || 1);
  const abrGrowth = (inp.abroadSalaryGrowth || co.growth) / 100;
  const disc = (inp.inflation || co.inflation) / 100;
  const planRet = inp.planReturn || false;
  const retAfter = inp.returnAfter || 5;
  const userAge = inp.age || 26;
  const startWorkAge = Math.round(userAge + dur + jobBuf / 12);

  const years = [];

  // — Study years: investment phase shown on negative axis —
  const directPerYear = (tuitionINR + livingINR) / dur;
  let cumStudyNPV = 0, cumStudyIndia = 0;
  for (let s = 1; s <= dur; s++) {
    const indiaSalYear = indiaSalAnn * Math.pow(1 + indGrowth, s);
    const yearCost = directPerYear + (s === 1 ? (inp.oneTime || 200000) : 0) + indiaSalYear;
    cumStudyNPV -= yearCost;
    cumStudyIndia += indiaSalYear;
    years.push({
      year: s - dur - 1, label: `S${s}·${userAge + s - 1}`,
      IndiaPath: Math.round(cumStudyIndia / 1e5),
      AbroadPath: 0,
      NetNPV: Math.round(cumStudyNPV / 1e5),
      annualNet: Math.round(-yearCost / 1e5),
      isStudy: true,
    });
  }

  // — Earning years —
  let cumNPV = -totalInv, cumIndia = cumStudyIndia, cumAbroad = 0;
  for (let t = 1; t <= 20; t++) {
    let Mt;
    if (planRet && t > retAfter) {
      Mt = indiaSalAnn * Math.pow(1 + indGrowth + 0.03, t);
    } else {
      Mt = baseSal * Math.pow(1+abrGrowth, t) * co.rate * Math.pow(1+drift, t);
    }
    const Bt = indiaSalAnn * Math.pow(1+indGrowth, t);
    cumIndia += Bt;
    cumAbroad += Mt;
    const netT = (Mt - Bt - annualLoan) / Math.pow(1+disc, t);
    cumNPV += netT;
    years.push({
      year: t, label: `Y${t}·${startWorkAge + t - 1}`,
      IndiaPath: Math.round(cumIndia / 1e5),
      AbroadPath: Math.round(cumAbroad / 1e5),
      NetNPV: Math.round(cumNPV / 1e5),
      annualNet: Math.round(netT / 1e5),
      isStudy: false,
    });
  }

  const earningYears = years.filter(y => !y.isStudy);
  const breakEvenYear = earningYears.find(y => y.NetNPV >= 0)?.year || null;
  return { years, breakEvenYear, npv10: earningYears[9].NetNPV, npv20: earningYears[19].NetNPV, totalInv, C0, B0, annualLoan };
}

function fmtL(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  const s = v < 0 ? '-' : '', a = Math.abs(v);
  return a >= 100 ? `${s}₹${(a/100).toFixed(1)} Cr` : `${s}₹${a.toFixed(1)}L`;
}
function fmtINR(v) {
  const l = v / 1e5;
  return l >= 100 ? `₹${(l/100).toFixed(2)} Cr` : `₹${l.toFixed(1)}L`;
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const [yr, age] = (label || '').split('·');
  return (
    <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 14px', fontFamily: F.mono, fontSize: 13 }}>
      <div style={{ color: C.muted, marginBottom: 6, fontSize: 12 }}>
        {yr}{age ? <span style={{ color: C.faint }}> · age {age}</span> : null}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, lineHeight: '22px' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.stroke || p.fill || C.accent, flexShrink: 0 }} />
          <span style={{ color: C.muted, fontSize: 12, minWidth: 80 }}>{p.name}</span>
          <span style={{ color: C.text, marginLeft: 'auto' }}>{fmtL(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const AgeTick = ({ x, y, payload }) => {
  const [yr, age] = (payload?.value || '').split('·');
  const isStudy = yr?.startsWith('S');
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={10} textAnchor="middle" fill={isStudy ? C.negative : C.faint} fontSize={8} fontFamily={F.mono}>{yr}</text>
      {age && <text x={0} y={0} dy={20} textAnchor="middle" fill={C.faint} fontSize={7} fontFamily={F.mono}>{age}</text>}
    </g>
  );
};

export default function EduROI() {
  // Live data state — initialised with hardcoded defaults, updated from API
  const [countries, setCountries] = useState(COUNTRY_DEFAULTS);
  const [dataStatus, setDataStatus] = useState('loading'); // 'loading' | 'live' | 'estimates'
  const [fetchedAt, setFetchedAt] = useState(null);

  useEffect(() => {
    setDataStatus('loading');
    Promise.allSettled([
      fetch(`${API_BASE_URL}/api/rates`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`${API_BASE_URL}/api/inflation`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
      fetch(`${API_BASE_URL}/api/defaults`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    ]).then(([ratesRes, inflationRes, defaultsRes]) => {
      const anyFailed = [ratesRes, inflationRes, defaultsRes].some(r => r.status === 'rejected');
      const rateMap = { Germany: 'EUR', USA: 'USD', Canada: 'CAD', UK: 'GBP' };

      setCountries(prev => {
        const next = Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v }]));

        if (ratesRes.status === 'fulfilled') {
          Object.entries(rateMap).forEach(([name, currency]) => {
            if (ratesRes.value[currency] && next[name]) next[name].rate = ratesRes.value[currency];
          });
        }
        if (inflationRes.status === 'fulfilled') {
          Object.entries(inflationRes.value).forEach(([name, val]) => {
            if (next[name] && val != null) next[name].inflation = val;
          });
        }
        if (defaultsRes.status === 'fulfilled') {
          Object.entries(defaultsRes.value.countries || {}).forEach(([name, data]) => {
            if (next[name]) Object.assign(next[name], data);
          });
        }
        return next;
      });

      setFetchedAt(new Date());
      setDataStatus(anyFailed ? 'estimates' : 'live');
    });
  }, []);

  const [country, setCountry] = useState("Germany");
  const [field, setField] = useState("Tech");
  const [currentSalary, setCurrentSalary] = useState(80000);
  const [tuition, setTuition] = useState(20000);
  const [duration, setDuration] = useState(2);
  const [showDetailed, setShowDetailed] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [indiaSalaryGrowth, setIndiaSalaryGrowth] = useState(8);
  const [age, setAge] = useState(26);
  const [livingCost, setLivingCost] = useState(null);
  const [oneTime, setOneTime] = useState(200000);
  const [loanAmount, setLoanAmount] = useState(0);
  const [loanRate, setLoanRate] = useState(8.5);
  const [loanYears, setLoanYears] = useState(10);
  const [abroadSalary, setAbroadSalary] = useState(null);
  const [abroadGrowth, setAbroadGrowth] = useState(null);
  const [planReturn, setPlanReturn] = useState(false);
  const [returnAfter, setReturnAfter] = useState(5);
  const [jobSearch, setJobSearch] = useState(3);
  const [inrDrift, setInrDrift] = useState(1.5);
  const [inflation, setInflation] = useState(null);
  const [salAdj, setSalAdj] = useState(0);
  const [inrAdj, setInrAdj] = useState(0);
  const [jobAdj, setJobAdj] = useState(0);

  const co = countries[country];

  function resetPresets(name) {
    setCountry(name);
    setAbroadSalary(null);
    setLivingCost(null);
    setInflation(null);
    setAbroadGrowth(null);
  }

  const inputs = useMemo(() => ({
    co,
    country, field, currentSalary, tuition, duration,
    indiaSalaryGrowth, age,
    livingCost: livingCost ?? co.living,
    oneTime, loanAmount, loanRate, loanYears,
    abroadSalary: abroadSalary ?? co.salary[field],
    abroadSalaryGrowth: abroadGrowth ?? co.growth,
    planReturn, returnAfter,
    jobSearchMonths: jobSearch + jobAdj,
    inrDrift: inrDrift + inrAdj,
    inflation: inflation ?? co.inflation,
    salaryMult: 1 + salAdj / 100,
  }), [co,country,field,currentSalary,tuition,duration,indiaSalaryGrowth,age,livingCost,oneTime,loanAmount,loanRate,loanYears,abroadSalary,abroadGrowth,planReturn,returnAfter,jobSearch,inrDrift,inflation,salAdj,inrAdj,jobAdj]);

  const results = useMemo(() => calculated ? calcROI(inputs) : null, [calculated, inputs]);

  const npvGradStop = useMemo(() => {
    if (!results) return 0.5;
    const vals = results.years.map(y => y.NetNPV);
    const max = Math.max(...vals), min = Math.min(...vals);
    if (max <= 0) return 0; if (min >= 0) return 1;
    return max / (max - min);
  }, [results]);

  function exportCSV() {
    if (!results) return;
    const rows = [
      ['Year','India Path (₹L)','Abroad Path (₹L)','Net NPV (₹L)','Annual Net (₹L)'],
      ...results.years.map(y => [y.year, y.IndiaPath, y.AbroadPath, y.NetNPV, y.annualNet]),
      [], ['Summary'],
      ['Total Investment', fmtINR(results.totalInv)],
      ['Break-even Year', results.breakEvenYear || '>20 yrs'],
      ['10-Year NPV (₹L)', results.npv10],
      ['20-Year NPV (₹L)', results.npv20],
      [], ['Inputs'],
      ['Country', country], ['Field', field],
      ['Monthly Salary (₹)', currentSalary],
      [`Annual Tuition (${co.symbol})`, tuition],
      ['Duration (yrs)', duration],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'EduROI_Results.csv';
    a.click();
  }

  // Styles
  const inpStyle = {
    background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6,
    color: C.text, padding: '8px 10px', fontFamily: F.mono, fontSize: 14,
    width: '100%', outline: 'none', transition: 'border-color 0.15s',
  };
  const lbl = {
    fontSize: 11, color: C.muted, fontFamily: F.body, marginBottom: 4,
    display: 'block', textTransform: 'uppercase', letterSpacing: '0.07em',
  };
  const pill = (active) => ({
    padding: '6px 12px', borderRadius: 100, fontSize: 13, cursor: 'pointer',
    fontFamily: F.body, border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? 'rgba(249,115,22,0.12)' : 'transparent',
    color: active ? C.accent : C.muted, transition: 'all 0.15s', outline: 'none',
  });
  const secLabel = {
    fontSize: 11, color: C.accent, fontFamily: F.body,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4,
  };
  const secLine = { flex: 1, height: 1, background: 'rgba(249,115,22,0.2)' };

  const tabs = ['Wealth Trajectory', 'Net NPV', 'Annual Gain'];

  return (
    <div style={{ fontFamily: F.body, background: C.bg, color: C.text, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap');
        html, body { margin: 0; padding: 0; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1C1917; }
        ::-webkit-scrollbar-thumb { background: #3D3835; border-radius: 2px; }
        input[type=range] { -webkit-appearance: none; width: 100%; height: 3px; background: #3D3835; border-radius: 2px; cursor: pointer; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #F97316; border-radius: 50%; cursor: pointer; border: 2px solid #1C1917; transition: transform 0.1s; }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.2); }
        input[type=number] { -moz-appearance: textfield; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.25; }
        .calc-btn:hover { background: #EA580C !important; transform: translateY(-1px); }
        .calc-btn { transition: all 0.15s !important; }
        .tab-btn:hover { color: #FAFAF9 !important; }
        .inp-field:focus { border-color: #F97316 !important; }
        .export-btn:hover { border-color: #4A4540 !important; color: #FAFAF9 !important; }
        .country-btn:hover { border-color: #4A4540 !important; }
        .pill-btn:hover { border-color: #4A4540 !important; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      {/* HEADER */}
      <div style={{ height: 58, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 8, padding: '6px 7px', display: 'flex' }}>
            <TrendingUp size={16} color={C.accent} />
          </div>
          <span style={{ fontFamily: F.display, fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em' }}>EduROI</span>
        </div>
        <div style={{ width: 1, height: 18, background: C.border }} />
        <span style={{ fontSize: 14, color: C.faint }}>Higher Education Investment Calculator</span>
        <div style={{ marginLeft: 'auto', background: 'rgba(134,239,172,0.07)', border: '1px solid rgba(134,239,172,0.18)', borderRadius: 100, padding: '3px 11px', fontSize: 12, color: C.positive, letterSpacing: '0.03em' }}>
          For Indian Students
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT PANEL ── */}
        <div style={{ width: 400, borderRight: `1px solid ${C.border}`, overflowY: 'auto', padding: '20px 20px 80px', flexShrink: 0 }}>

          {/* Data Status Badge */}
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
            {dataStatus === 'loading' && (
              <span style={{ fontSize: 12, color: C.faint, fontFamily: F.mono, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.faint, display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite' }} />
                Fetching live rates…
              </span>
            )}
            {dataStatus === 'live' && (
              <span style={{ fontSize: 12, color: C.positive, fontFamily: F.mono, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.positive, display: 'inline-block' }} />
                Live data
              </span>
            )}
            {dataStatus === 'estimates' && (
              <span style={{ fontSize: 12, color: '#FCD34D', fontFamily: F.mono, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FCD34D', display: 'inline-block' }} />
                Using estimates
              </span>
            )}
          </div>

          {/* Country Selector */}
          <div style={{ marginBottom: 16 }}>
            <span style={lbl}>Destination Country</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7 }}>
              {Object.entries(countries).map(([name, data]) => (
                <button key={name} className="country-btn" onClick={() => resetPresets(name)}
                  style={{ ...pill(country === name), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 4px', borderRadius: 9 }}>
                  <span style={{ fontSize: 22 }}>{data.flag}</span>
                  <span style={{ fontSize: 12 }}>{name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Field Selector */}
          <div style={{ marginBottom: 16 }}>
            <span style={lbl}>Field of Study</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {['Tech', 'Business', 'Sciences', 'Arts'].map(f => (
                <button key={f} className="pill-btn" onClick={() => setField(f)} style={{ ...pill(field === f), flex: 1, textAlign: 'center' }}>{f}</button>
              ))}
            </div>
          </div>

          {/* Preset hint */}
          <div style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.13)', borderRadius: 8, padding: '9px 12px', marginBottom: 16, fontSize: 13, lineHeight: '20px' }}>
            <span style={{ color: C.accent }}>{field}</span> in <span style={{ color: C.accent }}>{country}</span>
            <span style={{ color: C.faint }}> · </span>
            <span style={{ fontFamily: F.mono, color: C.text }}>{co.symbol}{co.salary[field].toLocaleString()}/yr</span>
            <span style={{ color: C.faint }}> · </span>
            <span style={{ color: C.muted }}>Living </span>
            <span style={{ fontFamily: F.mono, color: C.text }}>{co.symbol}{co.living}/mo</span>
            <span style={{ color: C.faint }}> · </span>
            <span style={{ fontFamily: F.mono, color: C.text }}>₹{co.rate.toFixed(2)}/{co.currency}</span>
            {dataStatus === 'live' && (
              <a href="https://frankfurter.app" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 10, color: C.faint, fontFamily: F.mono, marginLeft: 5, textDecoration: 'none', borderBottom: `1px dotted ${C.faint}`, verticalAlign: 'middle' }}>
                live ↗
              </a>
            )}
          </div>

          {/* Model A Inputs */}
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Current Monthly Salary (₹)</label>
            <input className="inp-field" type="number" style={inpStyle} value={currentSalary} onChange={e => setCurrentSalary(+e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Annual Tuition ({co.symbol})</label>
              <input className="inp-field" type="number" style={inpStyle} value={tuition} onChange={e => setTuition(+e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Duration</label>
              <div style={{ display: 'flex', gap: 5 }}>
                {[1, 2, 3].map(d => (
                  <button key={d} className="pill-btn" onClick={() => setDuration(d)}
                    style={{ ...pill(duration === d), padding: '8px 10px', borderRadius: 7, fontFamily: F.mono, fontSize: 13 }}>
                    {d}yr
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Refine Toggle */}
          <button onClick={() => setShowDetailed(!showDetailed)}
            style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.muted, cursor: 'pointer', fontFamily: F.body, fontSize: 13.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showDetailed ? 16 : 18, outline: 'none', transition: 'border-color 0.15s' }}>
            <span>Refine your inputs <span style={{ color: C.faint, fontSize: 12 }}>▾ 15 more fields</span></span>
            {showDetailed ? <ChevronUp size={14} color={C.faint} /> : <ChevronDown size={14} color={C.faint} />}
          </button>

          {/* Model B */}
          {showDetailed && (
            <div style={{ borderLeft: `2px solid ${C.border}`, paddingLeft: 16, marginBottom: 18 }}>

              <div style={secLabel}>§1 Your India Situation<div style={secLine} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
                <div>
                  <label style={lbl}>India Salary Growth (%/yr)</label>
                  <input className="inp-field" type="number" style={inpStyle} value={indiaSalaryGrowth} onChange={e => setIndiaSalaryGrowth(+e.target.value)} step="0.5" />
                </div>
                <div>
                  <label style={lbl}>Your Age</label>
                  <input className="inp-field" type="number" style={inpStyle} value={age} onChange={e => setAge(+e.target.value)} />
                </div>
              </div>

              <div style={secLabel}>§2 Education Costs<div style={secLine} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
                <div>
                  <label style={lbl}>Monthly Living ({co.symbol})</label>
                  <input className="inp-field" type="number" style={inpStyle} value={livingCost ?? co.living} onChange={e => setLivingCost(+e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>One-time Costs (₹)</label>
                  <input className="inp-field" type="number" style={inpStyle} value={oneTime} onChange={e => setOneTime(+e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Loan Amount (₹)</label>
                  <input className="inp-field" type="number" style={inpStyle} value={loanAmount} onChange={e => setLoanAmount(+e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Loan Rate (%)</label>
                  <input className="inp-field" type="number" style={inpStyle} value={loanRate} onChange={e => setLoanRate(+e.target.value)} step="0.1" />
                </div>
                <div>
                  <label style={lbl}>Repayment Period (yrs)</label>
                  <input className="inp-field" type="number" style={inpStyle} value={loanYears} onChange={e => setLoanYears(+e.target.value)} />
                </div>
              </div>

              <div style={secLabel}>§3 Return Projections<div style={secLine} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
                <div>
                  <label style={lbl}>Starting Salary ({co.symbol}/yr)</label>
                  <input className="inp-field" type="number" style={inpStyle} value={abroadSalary ?? co.salary[field]} onChange={e => setAbroadSalary(+e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Abroad Growth (%/yr)</label>
                  <input className="inp-field" type="number" style={inpStyle} value={abroadGrowth ?? co.growth} onChange={e => setAbroadGrowth(+e.target.value)} step="0.5" />
                </div>
                <div>
                  <label style={lbl}>Job Search Buffer (mo)</label>
                  <input className="inp-field" type="number" style={inpStyle} value={jobSearch} onChange={e => setJobSearch(+e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Plan to Return?</label>
                  <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                    {[['Yes', true], ['No', false]].map(([l, v]) => (
                      <button key={l} className="pill-btn" onClick={() => setPlanReturn(v)} style={{ ...pill(planReturn === v), flex: 1, textAlign: 'center' }}>{l}</button>
                    ))}
                  </div>
                </div>
                {planReturn && (
                  <div>
                    <label style={lbl}>Return after (yrs)</label>
                    <input className="inp-field" type="number" style={inpStyle} value={returnAfter} onChange={e => setReturnAfter(+e.target.value)} />
                  </div>
                )}
              </div>

              <div style={secLabel}>§4 Macro Assumptions<div style={secLine} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                <div>
                  <label style={lbl}>INR Depreciation (%/yr)</label>
                  <input className="inp-field" type="number" style={inpStyle} value={inrDrift} onChange={e => setInrDrift(+e.target.value)} step="0.1" />
                </div>
                <div>
                  <label style={lbl}>Destination Inflation (%) <a href="https://data.worldbank.org/indicator/FP.CPI.TOTL.ZG" target="_blank" rel="noopener noreferrer" style={{ color: C.faint, fontSize: 9, fontFamily: F.mono, textDecoration: 'none', borderBottom: `1px dotted ${C.faint}`, letterSpacing: 0 }}>World Bank ↗</a></label>
                  <input className="inp-field" type="number" style={inpStyle} value={inflation ?? co.inflation} onChange={e => setInflation(+e.target.value)} step="0.1" />
                </div>
              </div>
            </div>
          )}

          {/* CTA */}
          <button className="calc-btn" onClick={() => setCalculated(true)}
            style={{ width: '100%', background: C.accent, border: 'none', borderRadius: 10, padding: '13px', color: '#fff', cursor: 'pointer', fontFamily: F.body, fontSize: 15, fontWeight: 500, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            Calculate my ROI →
          </button>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 26px 80px', minWidth: 0 }}>

          {/* DISCLAIMER — always visible at the top */}
          <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 9, padding: '14px 16px', marginBottom: 22, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={13} color={C.faint} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontSize: 17, color: C.muted, lineHeight: '26px', fontFamily: F.body, margin: 0, marginBottom: 10 }}>
                Going abroad for a degree is one of the biggest financial decisions you'll make. The excitement is real — but so are the numbers. EduROI puts those numbers in front of you: your investment, your opportunity cost, your projected returns. No fear, no hype. Just data, so you can decide with clarity.
              </p>
              <p style={{ fontSize: 15, color: C.faint, lineHeight: '22px', fontFamily: F.body, margin: 0 }}>
                Uses statistical averages and publicly sourced data. Salary ranges reflect 2024 market data. Currency rates, inflation, and job market conditions fluctuate. Treat this as a <em style={{ color: C.muted }}>thinking instrument</em>, not a financial guarantee. Consult a financial advisor for major life decisions.
              </p>
            </div>
          </div>

          {!results ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
              <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.18)', borderRadius: 28, padding: 32, marginBottom: 4 }}>
                <TrendingUp size={48} color={C.accent} />
              </div>
              <div style={{ fontFamily: F.display, fontSize: 27, fontWeight: 600, color: C.muted, letterSpacing: '-0.02em' }}>Your 20-year projection</div>
              <div style={{ fontSize: 14, color: C.faint, maxWidth: 280, lineHeight: '21px' }}>Fill in your details on the left and hit Calculate to see your full wealth trajectory vs staying in India</div>
              <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
                {['Break-even Year', '10-yr NPV', '20-yr NPV'].map(s => (
                  <div key={s} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: F.mono, fontSize: 23, color: C.border, marginBottom: 4 }}>—</div>
                    <div style={{ fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* STAT CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Total Investment', val: fmtINR(results.totalInv), color: C.accent, sub: `C₀ + B₀ combined` },
                  {
                    label: 'Break-even Year',
                    val: results.breakEvenYear ? `Year ${results.breakEvenYear}` : '> 20 yrs',
                    color: results.breakEvenYear ? (results.breakEvenYear <= 10 ? C.positive : results.breakEvenYear <= 15 ? C.accent : C.negative) : C.negative,
                    sub: results.breakEvenYear ? `${20 - results.breakEvenYear} yrs of gain after` : 'Consider carefully'
                  },
                  {
                    label: '10-Year NPV', val: fmtL(results.npv10),
                    color: results.npv10 >= 0 ? C.positive : C.negative,
                    sub: results.npv10 >= 0 ? 'Ahead of India path' : 'Still recovering'
                  },
                  {
                    label: '20-Year NPV', val: fmtL(results.npv20),
                    color: results.npv20 >= 0 ? C.positive : C.negative,
                    sub: results.npv20 >= 0 ? 'Strong lifetime ROI' : 'Negative 20yr ROI'
                  },
                ].map((card, i) => (
                  <div key={i} style={{ background: C.surface, borderRadius: 10, padding: '14px 15px', border: `1px solid ${C.border}`, borderTop: `2px solid ${card.color}` }}>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{card.label}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 20, color: card.color, fontWeight: 500, lineHeight: '25px' }}>{card.val}</div>
                    <div style={{ fontSize: 12, color: C.faint, marginTop: 5 }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              {/* CHART BLOCK */}
              <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 18, overflow: 'hidden' }}>
                <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 20px', gap: 4 }}>
                  {tabs.map((tab, i) => (
                    <button key={i} className="tab-btn" onClick={() => setActiveTab(i)}
                      style={{ padding: '12px 16px', background: 'transparent', border: 'none', color: activeTab === i ? C.accent : C.faint, fontFamily: F.body, fontSize: 13, cursor: 'pointer', borderBottom: `2px solid ${activeTab === i ? C.accent : 'transparent'}`, marginBottom: -1, transition: 'color 0.15s', outline: 'none' }}>
                      {tab}
                    </button>
                  ))}
                </div>
                <div style={{ padding: '20px 12px 14px 4px' }}>

                  {/* Tab 0 — Wealth Trajectory */}
                  {activeTab === 0 && (
                    <ResponsiveContainer width="100%" height={230}>
                      <AreaChart data={results.years} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={C.positive} stopOpacity="0.22" />
                            <stop offset="95%" stopColor={C.positive} stopOpacity="0.02" />
                          </linearGradient>
                          <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={C.accent} stopOpacity="0.22" />
                            <stop offset="95%" stopColor={C.accent} stopOpacity="0.02" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                        <XAxis dataKey="label" tick={<AgeTick />} axisLine={false} tickLine={false} interval={1} padding={{ left: 5, right: 15 }} height={32} />
                        <YAxis tickFormatter={v => `₹${v}L`} tick={{ fill: C.faint, fontSize: 10, fontFamily: F.mono }} axisLine={false} tickLine={false} width={64} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="IndiaPath" name="India Path" stroke={C.positive} strokeWidth={2} fill="url(#gI)" dot={false} />
                        <Area type="monotone" dataKey="AbroadPath" name="Abroad Path" stroke={C.accent} strokeWidth={2} fill="url(#gA)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}

                  {/* Tab 1 — Net NPV */}
                  {activeTab === 1 && (
                    <>
                    <ResponsiveContainer width="100%" height={230}>
                      <AreaChart data={results.years} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gNPV" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={C.positive} stopOpacity={npvGradStop > 0.05 ? "0.25" : "0"} />
                            <stop offset={`${Math.min(99, npvGradStop * 100)}%`} stopColor={C.positive} stopOpacity="0.03" />
                            <stop offset={`${Math.min(100, npvGradStop * 100 + 0.1)}%`} stopColor={C.negative} stopOpacity="0.03" />
                            <stop offset="100%" stopColor={C.negative} stopOpacity={npvGradStop < 0.95 ? "0.25" : "0"} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                        <XAxis dataKey="label" tick={<AgeTick />} axisLine={false} tickLine={false} interval={1} padding={{ left: 5, right: 15 }} height={32} />
                        <YAxis tickFormatter={v => `₹${v}L`} tick={{ fill: C.faint, fontSize: 10, fontFamily: F.mono }} axisLine={false} tickLine={false} width={64} />
                        <Tooltip content={<ChartTooltip />} />
                        <ReferenceLine y={0} stroke={C.accent} strokeDasharray="7 4" strokeWidth={1.5} label={{ value: '← Break-even', fill: C.accent, fontSize: 10, fontFamily: F.body, position: 'insideTopLeft' }} />
                        <Area type="monotone" dataKey="NetNPV" name="Net NPV" stroke={C.accent} strokeWidth={2} fill="url(#gNPV)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>

                    {/* NPV Explainer */}
                    <div style={{ margin: '16px 8px 4px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 600, color: C.text }}>What is Net NPV?</span>
                        <span style={{ fontSize: 11, color: C.faint, fontFamily: F.mono }}>Net Present Value — in today's ₹</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: C.muted, lineHeight: '19px' }}>
                          <strong style={{ color: C.text, fontWeight: 500 }}>NPV discounts future money</strong> to what it's worth today, accounting for inflation. ₹1 lakh ten years from now is worth less than ₹1 lakh now — NPV corrects for that, so all years are comparable.
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: C.muted, lineHeight: '19px' }}>
                          <strong style={{ color: C.text, fontWeight: 500 }}>How it's calculated here:</strong> Each year, the discounted difference <span style={{ fontFamily: F.mono, fontSize: 11, color: C.faint }}>(abroad salary − India salary − loan EMI)</span> is added cumulatively, then the full investment cost is subtracted from the start.
                        </div>
                      </div>
                      <div style={{ gridColumn: '1 / -1', borderTop: `1px solid ${C.border}`, paddingTop: 10, display: 'flex', gap: 20 }}>
                        {[
                          { dot: C.negative, text: 'Line below zero — you haven\'t recovered your investment yet vs staying in India' },
                          { dot: C.accent,   text: 'Dashed line = break-even. From here on, you\'re net-positive vs the India path' },
                          { dot: C.positive, text: 'Line above zero — cumulative lifetime gain over staying in India, in today\'s rupees' },
                        ].map((item, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, flex: 1 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.dot, flexShrink: 0, marginTop: 3 }} />
                            <span style={{ fontSize: 11, color: C.faint, lineHeight: '17px' }}>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    </>
                  )}

                  {/* Tab 2 — Annual Gain */}
                  {activeTab === 2 && (
                    <>
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={results.years} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                        <XAxis dataKey="label" tick={<AgeTick />} axisLine={false} tickLine={false} interval={1} padding={{ left: 5, right: 15 }} height={32} />
                        <YAxis tickFormatter={v => `₹${v}L`} tick={{ fill: C.faint, fontSize: 10, fontFamily: F.mono }} axisLine={false} tickLine={false} width={64}
                          domain={[
                            dataMin => dataMin >= 0 ? Math.floor(dataMin * 0.75) : dataMin * 1.1,
                            dataMax => Math.ceil(dataMax * 1.05),
                          ]}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <ReferenceLine y={0} stroke={C.border} strokeWidth={1} />
                        <Bar dataKey="annualNet" name="Annual Net" radius={[3, 3, 0, 0]} maxBarSize={24}>
                          {results.years.map((e, i) => <Cell key={i} fill={e.annualNet >= 0 ? C.accent : C.negative} fillOpacity={0.82} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    {/* Annual Gain Explainer */}
                    <div style={{ margin: '16px 8px 4px', background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontFamily: F.display, fontSize: 14, fontWeight: 600, color: C.text }}>Reading this chart</span>
                        <span style={{ fontSize: 11, color: C.faint, fontFamily: F.mono }}>Y-axis starts above zero to show year-on-year change</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: C.muted, lineHeight: '19px' }}>
                          <strong style={{ color: C.text, fontWeight: 500 }}>Each bar</strong> is the real purchasing-power gain for that single year — how much more you earn abroad vs India that year, after discounting for inflation, expressed in today's rupees.
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, lineHeight: '19px' }}>
                          <strong style={{ color: C.text, fontWeight: 500 }}>Why bars look similar:</strong> Abroad salary growth + INR depreciation roughly cancel out inflation discounting, so the real annual advantage stays broadly flat. A rising trend means you're pulling ahead faster over time.
                        </div>
                      </div>
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: 'flex', gap: 20 }}>
                        {[
                          { dot: C.accent,    text: 'Orange bar — abroad earnings beat India that year in real terms' },
                          { dot: C.negative,  text: 'Red bar — India path would have been better that year (e.g. early high-loan years)' },
                          { dot: C.faint,     text: 'Tall bars = stronger annual advantage; look for a rising trend as your career grows' },
                        ].map((item, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, flex: 1 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: item.dot, flexShrink: 0, marginTop: 3 }} />
                            <span style={{ fontSize: 11, color: C.faint, lineHeight: '17px' }}>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    </>
                  )}
                </div>
              </div>

              {/* SENSITIVITY */}
              <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
                  <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 600 }}>Sensitivity Analysis</div>
                  <div style={{ fontSize: 12, color: C.faint }}>Drag sliders — charts update live</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
                  {[
                    { label: 'Salary Adjustment', val: salAdj, set: setSalAdj, min: -30, max: 30, step: 1, fmt: v => `${v > 0 ? '+' : ''}${v}%`, hint: '"What if offer is lower?"', negBad: true },
                    { label: 'INR Drift Change', val: inrAdj, set: setInrAdj, min: -2, max: 3, step: 0.5, fmt: v => `${v > 0 ? '+' : ''}${v}%`, hint: '"What if rupee holds?"', negBad: false },
                    { label: 'Job Search Delay', val: jobAdj, set: setJobAdj, min: 0, max: 15, step: 1, fmt: v => `+${v} mo`, hint: '"If it takes longer…"', negBad: false },
                  ].map((s, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: C.muted }}>{s.label}</span>
                        <span style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 500, color: s.val === 0 ? C.faint : (i === 0 ? (s.val > 0 ? C.positive : C.negative) : C.negative) }}>
                          {s.fmt(s.val)}
                        </span>
                      </div>
                      <input type="range" min={s.min} max={s.max} step={s.step} value={s.val} onChange={e => s.set(+e.target.value)} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                        <span style={{ fontSize: 10, color: C.faint, fontFamily: F.mono }}>{s.fmt(s.min)}</span>
                        <span style={{ fontSize: 11, color: C.faint, fontStyle: 'italic' }}>{s.hint}</span>
                        <span style={{ fontSize: 10, color: C.faint, fontFamily: F.mono }}>{s.fmt(s.max)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* INVESTMENT BREAKDOWN */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
                {[
                  { icon: '🔴', label: 'Direct Education Cost', sub: 'Tuition + Living + One-time', val: fmtINR(results.C0), accent: '#F87171' },
                  { icon: '🟠', label: 'Opportunity Cost', sub: `${duration} yr${duration > 1 ? 's' : ''} of forgone India income`, val: fmtINR(results.B0), accent: C.accent },
                  { icon: '🟡', label: 'Annual Loan Payment', sub: loanAmount > 0 ? `EMI on ₹${(loanAmount / 1e5).toFixed(1)}L loan` : 'No loan taken', val: results.annualLoan > 0 ? fmtINR(results.annualLoan) + '/yr' : '₹0', accent: '#FDE047' },
                ].map((b, i) => (
                  <div key={i} style={{ background: C.surface, borderRadius: 10, padding: '14px 15px', border: `1px solid ${C.border}`, borderLeft: `3px solid ${b.accent}` }}>
                    <div style={{ fontSize: 18, marginBottom: 8 }}>{b.icon}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, lineHeight: '17px' }}>{b.label}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 19, color: C.text, fontWeight: 500 }}>{b.val}</div>
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 5 }}>{b.sub}</div>
                  </div>
                ))}
              </div>

              {/* EXPORT */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button className="export-btn" onClick={exportCSV}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 15px', color: C.muted, cursor: 'pointer', fontFamily: F.body, fontSize: 13, transition: 'all 0.15s', outline: 'none' }}>
                  <Download size={12} /> Export CSV
                </button>
              </div>

              {/* LAST UPDATED FOOTER */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 4, paddingBottom: 8 }}>
                {fetchedAt && (
                  <span style={{ fontSize: 11, color: C.faint, fontFamily: F.mono }}>
                    Data fetched {fetchedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {fetchedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {!fetchedAt && (
                  <span style={{ fontSize: 11, color: C.faint, fontFamily: F.mono }}>Using built-in estimates · salary data as of Jan 2024</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}