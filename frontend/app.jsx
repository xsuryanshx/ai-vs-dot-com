const { useEffect, useRef, useState } = React;

// ============================================================
// 0. PATHS & THEME
// ============================================================

// All paths are relative to /frontend/index.html
const DATA_PATHS = {
  dotcom: "Dotcom.csv", // lives in frontend/
  bigTech: "HighTech.xlsx", // lives in frontend/
  pureAi: "PureAI.xlsx", // lives in frontend/
  macro: "combined-macrodata.csv", // lives in frontend/
  pe: "pe-averages.csv", // lives in frontend/ 

  // Nasdaq-100 index-level series (CSV, 2 columns: date/quarter + value)
  peIndexDotcom: "nasdaq100_pe_1996_2000.csv",
  peIndexModern: "nasdaq100_pe_2022_2025.csv",
  psIndexDotcom: "nasdaq100_ps_1996_2000.csv",
  psIndexModern: "nasdaq100_ps_2022_2025.csv",
};

const THEME = {
  text: "#94a3b8",
  grid: "rgba(255, 255, 255, 0.06)",
  tooltipBg: "rgba(15, 22, 41, 0.9)",
  tooltipBorder: "rgba(255, 255, 255, 0.1)",
};

const SERIES_COLORS = {
  dotcom: { solid: "#f472b6", fill: "rgba(244, 114, 182, 0.2)" },
  bigTech: { solid: "#22c55e", fill: "rgba(34, 197, 94, 0.2)" },
  pureAi: { solid: "#38bdf8", fill: "rgba(56, 189, 248, 0.2)" },
};

const MACRO_COLORS = ["#a78bfa", "#38bdf8", "#34d399", "#f472b6", "#fbbf24"];

const MACRO_COLUMNS = [
  "Inflation",
  "Unemployment",
  "Interest Rate",
  "GDP Yearly Growth",
  "NASDAQ Yearly Growth",
];

// Common line style for ALL line charts
const LINE_STYLE = {
  tension: 0.3,
  borderWidth: 3,
  pointRadius: 0,
  pointHoverRadius: 5,
  fill: false,
};

// ============================================================
// 1. Data loading helpers
// ============================================================

// Strip BOM + outer quotes from a CSV token
function cleanCsvToken(s) {
  if (s == null) return "";
  let t = String(s).trim().replace(/^\uFEFF/, ""); // remove BOM if present
  if (t.startsWith('"') && t.endsWith('"')) {
    t = t.slice(1, -1);
  }
  return t;
}

async function loadCsvAsObjects(path) {
  const res = await fetch(path);
  if (!res.ok) {
    console.error(`❌ Failed to load CSV at ${path}`, res.status, res.statusText);
    throw new Error(`Failed to load CSV: ${path}`);
  }
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) {
    console.warn(`⚠️ CSV at ${path} is empty`);
    return [];
  }

  const headers = lines[0].split(",").map((h) => cleanCsvToken(h));
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => cleanCsvToken(c));
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });

  console.log("First CSV row keys:", Object.keys(rows[0] || {}));
  return rows;
}

async function loadExcelAsObjects(path) {
  const res = await fetch(path);
  if (!res.ok) {
    console.error(`❌ Failed to load Excel at ${path}`, res.status, res.statusText);
    throw new Error(`Failed to load Excel: ${path}`);
  }
  const buffer = await res.arrayBuffer();
  const wb = XLSX.read(buffer);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows;
}

function toNumberOrNull(value) {
  if (value === "" || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

// Convert "Company/Metric/year columns" → tidy panel
function tidyPanelJS(rows, years) {
  const records = [];
  let i = 0;

  while (i < rows.length) {
    const base = rows[i];
    const company = base["Company"];
    if (!company) {
      i += 1;
      continue;
    }

    const block = rows.slice(i, i + 3);
    const mcRow = block.find((r) => r["Metric"] === "Market Cap ($bn)") || {};
    const revRow = block.find((r) => r["Metric"] === "Revenue ($bn)") || {};
    const vrRow = block.find((r) => r["Metric"] === "Valuation/Revenue") || {};

    years.forEach((y) => {
      const col = String(y);
      records.push({
        Company: company,
        Year: y,
        MarketCap: Number(mcRow[col]) || null,
        Revenue: Number(revRow[col]) || null,
        ValRev: Number(vrRow[col]) || null,
      });
    });

    i += 3;
  }

  return records;
}

// CSV → panel with strong logging
async function loadDotcomPanel() {
  try {
    const rows = await loadCsvAsObjects(DATA_PATHS.dotcom);
    console.log(`✅ Loaded Dotcom.csv, raw rows: ${rows.length}`);

    const panel = tidyPanelJS(rows, [1996, 1997, 1998, 1999, 2000]);
    console.log(`✅ Tidy dot-com panel records: ${panel.length}`);

    const usable = panel.filter((r) => r.ValRev != null && r.ValRev > 0);
    if (!usable.length) {
      console.warn(
        "⚠️ Dot-com data loaded but no positive ValRev values found. " +
          "Check that the CSV has a 'Valuation/Revenue' column with numeric values."
      );
    }
    return panel;
  } catch (e) {
    console.error("❌ Dot-com panel failed to load:", e);
    return [];
  }
}

// Excel → panel with logging
async function loadExcelPanel(path, years, label) {
  try {
    const rows = await loadExcelAsObjects(path);
    console.log(`✅ Loaded ${label}, raw rows: ${rows.length}`);
    const panel = tidyPanelJS(rows, years);
    console.log(`✅ Tidy ${label} panel records: ${panel.length}`);
    return panel;
  } catch (e) {
    console.error(`❌ Failed to load ${label}:`, e);
    return [];
  }
}

async function loadPeAverages() {
  try {
    const rows = await loadCsvAsObjects(DATA_PATHS.pe);
    console.log(`✅ Loaded P/E averages, raw rows: ${rows.length}`);
    return rows
      .map((r) => ({
        Year: Number(r.Year),
        Dotcom: toNumberOrNull(r.Dotcom),
        BigTechAI: toNumberOrNull(r.BigTechAI),
        PureAI: toNumberOrNull(r.PureAI),
      }))
      .filter((r) => Number.isFinite(r.Year));
  } catch (e) {
    console.error("❌ Failed to load P/E averages:", e);
    return [];
  }
}

// Nasdaq-100 index-level time series loader (2-column CSV: quarter/date + value)
async function loadIndexSeries(path, label) {
  try {
    const rows = await loadCsvAsObjects(path);
    if (!rows.length) {
      console.warn(`⚠️ Index series at ${path} is empty`);
      return { labels: [], values: [] };
    }
    const keys = Object.keys(rows[0]);
    if (keys.length < 2) {
      console.warn(`⚠️ Index series at ${path} does not have at least 2 columns`);
      return { labels: [], values: [] };
    }
    const labelKey = keys[0];
    const valueKey = keys[1];

    const labels = rows.map((r) => String(r[labelKey]));
    const values = rows
      .map((r) => toNumberOrNull(r[valueKey]))
      .map((v) => (Number.isFinite(v) ? v : null));

    console.log(`✅ Loaded index series ${label || path}: ${labels.length} points`);
    return { labels, values };
  } catch (e) {
    console.error(`❌ Failed to load index series ${label || path}:`, e);
    return { labels: [], values: [] };
  }
}

// ============================================================
// 2. Valuation helpers
// ============================================================

function safeLogArray(values) {
  return values
    .filter((v) => v != null && v > 0)
    .map((v) => Math.log(v));
}

function groupAvgLogPsByYear(records) {
  const byYear = new Map();
  records.forEach((r) => {
    if (r.ValRev != null && r.ValRev > 0) {
      if (!byYear.has(r.Year)) byYear.set(r.Year, []);
      byYear.get(r.Year).push(r.ValRev);
    }
  });

  const years = Array.from(byYear.keys()).sort((a, b) => a - b);
  const logVals = years.map((y) => {
    const arr = byYear.get(y);
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    return Math.log(avg);
  });

  return { years, logVals };
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return null;
  const idx = (sortedArr.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedArr[lower];
  return (
    sortedArr[lower] * (1 - (idx - lower)) + sortedArr[upper] * (idx - lower)
  );
}

function computeBoxStats(logValues) {
  if (!logValues.length) {
    return { min: null, q1: null, median: null, q3: null, max: null };
  }
  const sorted = [...logValues].sort((a, b) => a - b);
  return {
    min: sorted[0],
    q1: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    q3: percentile(sorted, 0.75),
    max: sorted[sorted.length - 1],
  };
}

function medianLogPs(records, years) {
  const vals = records
    .filter((r) => years.includes(r.Year))
    .map((r) => r.ValRev)
    .filter((v) => v != null && v > 0);

  if (!vals.length) return null;
  vals.sort((a, b) => a - b);
  const mid = Math.floor(vals.length / 2);
  const median =
    vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
  return Math.log(median);
}

function medianValue(values) {
  const nums = values
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
  if (!nums.length) return null;
  nums.sort((a, b) => a - b);
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0
    ? (nums[mid - 1] + nums[mid]) / 2
    : nums[mid];
}

function meanFinite(arr) {
  const values = arr.filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  const sum = values.reduce((s, v) => s + v, 0);
  return sum / values.length;
}

// Rough earnings-per-share guess using a constant net margin against revenue.
const EPS_MARGIN_GUESS = 0.15;
function estimateEpsByYear(records, margin = EPS_MARGIN_GUESS) {
  const buckets = new Map();

  records.forEach((r) => {
    const rev = Number(r.Revenue);
    if (Number.isFinite(rev) && rev > 0) {
      if (!buckets.has(r.Year)) buckets.set(r.Year, []);
      buckets.get(r.Year).push(rev);
    }
  });

  const epsMap = new Map();
  buckets.forEach((vals, year) => {
    if (!vals.length) return;
    const avgRev = vals.reduce((s, v) => s + v, 0) / vals.length;
    epsMap.set(year, avgRev * margin);
  });

  return epsMap;
}

function findPeakIndex(values) {
  let peakIdx = -1;
  let peakVal = -Infinity;
  values.forEach((v, i) => {
    if (Number.isFinite(v) && v > peakVal) {
      peakVal = v;
      peakIdx = i;
    }
  });
  return peakIdx;
}

// ============================================================
// 3. Macro helpers
// ============================================================

function parseMacroCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];

  const rawHeaders = lines[0].split(",").map((h) => cleanCsvToken(h));
  const headers = rawHeaders.map((h) =>
    h === "NASDAQ Yearly Growith" ? "NASDAQ Yearly Growth" : h
  );

  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => cleanCsvToken(c));
    const row = {};
    headers.forEach((h, i) => {
      const cell = cells[i];
      if (h === "Date") {
        const d = new Date(cell);
        row.Date = Number.isNaN(d.getTime()) ? null : d;
      } else {
        const num = Number(cell);
        row[h] = Number.isFinite(num) ? num : null;
      }
    });
    return row;
  });

  const valid = rows.filter(
    (r) => r.Date instanceof Date && !Number.isNaN(r.Date.getTime())
  );
  valid.sort((a, b) => a.Date - b.Date);

  const deduped = new Map();
  valid.forEach((r) => deduped.set(r.Date.toISOString(), r));
  return Array.from(deduped.values());
}

async function loadMacrodata() {
  try {
    const res = await fetch(DATA_PATHS.macro);
    if (!res.ok) {
      console.error(
        `❌ Failed to load macro CSV at ${DATA_PATHS.macro}`,
        res.status,
        res.statusText
      );
      throw new Error("Macro CSV load failed");
    }
    const text = await res.text();
    const parsed = parseMacroCsv(text);
    console.log(`✅ Macro rows: ${parsed.length}`);
    return parsed;
  } catch (e) {
    console.error("❌ Macro dataset failed to load:", e);
    return [];
  }
}

function normalizeMacro(rows, columns, method, referenceRows) {
  if (method === "None") return rows;
  const ref = referenceRows && referenceRows.length ? referenceRows : rows;
  const stats = {};

  if (method === "Index to 100") {
    columns.forEach((col) => {
      const firstValid = rows.map((r) => r[col]).find((v) => v != null);
      stats[col] = { base: firstValid ?? null };
    });
  } else if (method === "Z-score (standardize)") {
    columns.forEach((col) => {
      const values = ref.map((r) => r[col]).filter((v) => v != null);
      const mean = values.reduce((s, v) => s + v, 0) / (values.length || 1);
      const variance =
        values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length || 1);
      stats[col] = { mean, std: Math.sqrt(variance) };
    });
  }

  return rows.map((row) => {
    const next = { ...row };
    columns.forEach((col) => {
      const val = row[col];
      if (val == null) {
        next[col] = null;
        return;
      }
      if (method === "Index to 100") {
        const base = stats[col].base;
        next[col] = base && base !== 0 ? (val / base) * 100 : null;
      } else if (method === "Z-score (standardize)") {
        const { mean, std } = stats[col];
        next[col] = std && std !== 0 ? (val - mean) / std : null;
      }
    });
    return next;
  });
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
  }).format(date);
}

// ============================================================
// 4. Chart glue
// ============================================================

Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.color = THEME.text;
Chart.defaults.borderColor = THEME.grid;

function useChart(canvasRef, configFactory, deps) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext("2d");
    const config = configFactory(ctx);
    chartRef.current = new Chart(ctx, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, deps);
}

// ================== Story charts ============================

function AvgPsLineChart({ dotcom, aiPure, aiBroad }) {
  const canvasRef = useRef(null);

  const dot = groupAvgLogPsByYear(dotcom);
  const pure = groupAvgLogPsByYear(aiPure);
  const broad = groupAvgLogPsByYear(aiBroad);

  const allYears = Array.from(
    new Set([...dot.years, ...pure.years, ...broad.years])
  ).sort((a, b) => a - b);

  const align = (series) => {
    const map = new Map(series.years.map((y, i) => [y, series.logVals[i]]));
    return allYears.map((y) => map.get(y) ?? null);
  };

  useChart(
    canvasRef,
    () => ({
      type: "line",
      data: {
        labels: allYears,
        datasets: [
          {
            label: "Dot-com",
            data: align(dot),
            borderColor: SERIES_COLORS.dotcom.solid,
            backgroundColor: SERIES_COLORS.dotcom.fill,
            ...LINE_STYLE,
          },
          {
            label: "Big Tech AI",
            data: align(pure),
            borderColor: SERIES_COLORS.bigTech.solid,
            backgroundColor: SERIES_COLORS.bigTech.fill,
            ...LINE_STYLE,
          },
          {
            label: "Pure-play AI",
            data: align(broad),
            borderColor: SERIES_COLORS.pureAi.solid,
            backgroundColor: SERIES_COLORS.pureAi.fill,
            ...LINE_STYLE,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { usePointStyle: true, boxWidth: 6 } },
          tooltip: {
            backgroundColor: THEME.tooltipBg,
            titleColor: "#fff",
            bodyColor: "#cbd5e1",
            borderColor: THEME.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (c) =>
                `${c.dataset.label}: ${
                  c.raw != null ? Math.exp(c.raw).toFixed(1) : "N/A"
                }x P/S`,
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            title: {
              display: true,
              text: "log(Valuation / Revenue)",
            },
          },
        },
      },
    }),
    [JSON.stringify(allYears), dotcom.length, aiPure.length, aiBroad.length]
  );

  return <canvas ref={canvasRef} />;
}

function AvgPeLineChart({ peRows, toggles }) {
  const canvasRef = useRef(null);

  const years = Array.from(
    new Set(peRows.map((r) => r.Year).filter((y) => Number.isFinite(y)))
  ).sort((a, b) => a - b);

  const rowByYear = new Map(peRows.map((r) => [r.Year, r]));
  const align = (key) =>
    years.map((y) => {
      const row = rowByYear.get(y);
      const val = row ? row[key] : null;
      return val ?? null;
    });

  const datasets = [
    {
      label: "Dot-com",
      data: align("Dotcom"),
      borderColor: SERIES_COLORS.dotcom.solid,
      backgroundColor: SERIES_COLORS.dotcom.fill,
      spanGaps: true,
      hidden: !toggles.dotcom,
      ...LINE_STYLE,
    },
    {
      label: "Big Tech AI",
      data: align("BigTechAI"),
      borderColor: SERIES_COLORS.bigTech.solid,
      backgroundColor: SERIES_COLORS.bigTech.fill,
      spanGaps: true,
      hidden: !toggles.aiPure,
      ...LINE_STYLE,
    },
    {
      label: "Pure-play AI",
      data: align("PureAI"),
      borderColor: SERIES_COLORS.pureAi.solid,
      backgroundColor: SERIES_COLORS.pureAi.fill,
      spanGaps: true,
      hidden: !toggles.aiBroad,
      ...LINE_STYLE,
    },
  ];

  useChart(
    canvasRef,
    () => ({
      type: "line",
      data: { labels: years, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { usePointStyle: true, boxWidth: 6 } },
          tooltip: {
            backgroundColor: THEME.tooltipBg,
            titleColor: "#fff",
            bodyColor: "#cbd5e1",
            borderColor: THEME.tooltipBorder,
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (c) => {
                const val = Number(c.raw);
                const display = Number.isFinite(val) ? val.toFixed(1) : "N/A";
                return `${c.dataset.label}: ${display}x P/E`;
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { title: { display: true, text: "Average P/E" } },
        },
      },
    }),
    [JSON.stringify(peRows), toggles.dotcom, toggles.aiPure, toggles.aiBroad]
  );

  return <canvas ref={canvasRef} />;
}

function PeScatterChart({ peRows, toggles, dotcom, aiPure, aiBroad }) {
  const canvasRef = useRef(null);

  const epsMaps = {
    Dotcom: estimateEpsByYear(dotcom || []),
    BigTechAI: estimateEpsByYear(aiPure || []),
    PureAI: estimateEpsByYear(aiBroad || []),
  };

  const formatNumber = (val) => {
    const num = Number(val);
    if (!Number.isFinite(num)) return "N/A";
    if (num >= 1000)
      return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (num >= 10) return num.toLocaleString("en-US", { maximumFractionDigits: 1 });
    return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  };

  const makePoints = (key, epsMap, enabled) =>
    enabled
      ? (peRows || [])
          .map((r) => {
            const peVal = toNumberOrNull(r[key]);
            const eps = epsMap.get(r.Year);
            if (!Number.isFinite(peVal) || !Number.isFinite(eps) || eps <= 0) {
              return null;
            }
            const sharePrice = peVal * eps;
            if (!Number.isFinite(sharePrice) || sharePrice <= 0) return null;
            return { x: sharePrice, y: eps, year: r.Year };
          })
          .filter(Boolean)
      : [];

  useChart(
    canvasRef,
    () => ({
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Dot-com",
            data: makePoints("Dotcom", epsMaps.Dotcom, toggles.dotcom),
            backgroundColor: SERIES_COLORS.dotcom.fill,
            borderColor: SERIES_COLORS.dotcom.solid,
            borderWidth: 1,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: "Big Tech AI",
            data: makePoints("BigTechAI", epsMaps.BigTechAI, toggles.aiPure),
            backgroundColor: SERIES_COLORS.bigTech.fill,
            borderColor: SERIES_COLORS.bigTech.solid,
            borderWidth: 1,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: "Pure-play AI",
            data: makePoints("PureAI", epsMaps.PureAI, toggles.aiBroad),
            backgroundColor: SERIES_COLORS.pureAi.fill,
            borderColor: SERIES_COLORS.pureAi.solid,
            borderWidth: 1,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { usePointStyle: true, boxWidth: 6 } },
          tooltip: {
            backgroundColor: THEME.tooltipBg,
            borderColor: THEME.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (c) => {
                const price = formatNumber(c.raw.x);
                const eps = formatNumber(c.raw.y);
                return `${c.dataset.label}: $${price} price, $${eps} EPS (Year ${c.raw.year})`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "logarithmic",
            title: { display: true, text: "Share price" },
            grid: { display: false },
            ticks: { callback: (v) => formatNumber(v) },
          },
          y: {
            type: "logarithmic",
            title: { display: true, text: "EPS (earnings per share)" },
            ticks: { callback: (v) => formatNumber(v) },
          },
        },
      },
    }),
    [
      JSON.stringify(peRows),
      toggles.dotcom,
      toggles.aiPure,
      toggles.aiBroad,
      dotcom.length,
      aiPure.length,
      aiBroad.length,
    ]
  );

  return <canvas ref={canvasRef} />;
}

function PeakBoxplotChart({
  dotVals,
  pureVals,
  broadVals,
  yTitle = "log(P/S Distribution)",
}) {
  const canvasRef = useRef(null);
  const realStats = [
    computeBoxStats(dotVals),
    computeBoxStats(pureVals),
    computeBoxStats(broadVals),
  ];

  const yBounds = (() => {
    const finiteStats = realStats.filter(
      (s) => Number.isFinite(s.min) && Number.isFinite(s.max)
    );
    if (!finiteStats.length) return { min: undefined, max: undefined };

    const minVal = Math.min(...finiteStats.map((s) => s.min));
    const maxVal = Math.max(...finiteStats.map((s) => s.max));
    const range = Math.max(1, maxVal - minVal);
    const pad = range * 0.15;

    return { min: minVal - pad, max: maxVal + pad };
  })();

  useChart(
    canvasRef,
    (ctx) => {
      const boxplotPlugin = {
        id: "customBoxplot",
        afterDatasetsDraw(chart) {
          const { ctx } = chart;
          ctx.save();
          ctx.lineWidth = 2;

          chart.getDatasetMeta(0).data.forEach((bar, idx) => {
            const stat = realStats[idx];
            if (!stat || stat.median == null) return;

            const x = bar.x;
            const yScale = chart.scales.y;
            const yMin = yScale.getPixelForValue(stat.min);
            const yQ1 = yScale.getPixelForValue(stat.q1);
            const yMed = yScale.getPixelForValue(stat.median);
            const yQ3 = yScale.getPixelForValue(stat.q3);
            const yMax = yScale.getPixelForValue(stat.max);
            const w = 40;

            const color =
              idx === 0
                ? SERIES_COLORS.dotcom.solid
                : idx === 1
                ? SERIES_COLORS.bigTech.solid
                : SERIES_COLORS.pureAi.solid;
            const fill =
              idx === 0
                ? SERIES_COLORS.dotcom.fill
                : idx === 1
                ? SERIES_COLORS.bigTech.fill
                : SERIES_COLORS.pureAi.fill;

            ctx.strokeStyle = color;
            ctx.fillStyle = fill;

            // whiskers
            ctx.beginPath();
            ctx.moveTo(x, yMin);
            ctx.lineTo(x, yQ1);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x, yQ3);
            ctx.lineTo(x, yMax);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x - w / 4, yMin);
            ctx.lineTo(x + w / 4, yMin);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(x - w / 4, yMax);
            ctx.lineTo(x + w / 4, yMax);
            ctx.stroke();

            // box
            ctx.beginPath();
            ctx.rect(x - w / 2, yQ3, w, yQ1 - yQ3);
            ctx.fill();
            ctx.stroke();

            // median
            ctx.beginPath();
            ctx.moveTo(x - w / 2, yMed);
            ctx.lineTo(x + w / 2, yMed);
            ctx.stroke();
          });

          ctx.restore();
        },
      };

      return {
        type: "bar",
        data: {
          labels: ["Dot-com Peak", "Big Tech AI Peak", "Pure AI Peak"],
          datasets: [
            {
              label: "Hidden",
              data: realStats.map((s) => s.median),
              backgroundColor: "transparent",
              borderWidth: 0,
            },
          ],
        },
        plugins: [boxplotPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              title: { display: true, text: yTitle },
              suggestedMin: yBounds.min,
              suggestedMax: yBounds.max,
            },
          },
        },
      };
    },
    [JSON.stringify(realStats), yTitle]
  );

  return <canvas ref={canvasRef} />;
}

function McRevScatterChart({ dotcom, aiPure, aiBroad }) {
  const canvasRef = useRef(null);

  const makePoints = (records) =>
    records
      .filter((r) => r.MarketCap > 0 && r.Revenue > 0)
      .map((r) => ({
        x: Math.log(r.Revenue),
        y: Math.log(r.MarketCap),
      }));

  useChart(
    canvasRef,
    () => ({
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Dot-com",
            data: makePoints(dotcom),
            backgroundColor: SERIES_COLORS.dotcom.fill,
            borderColor: SERIES_COLORS.dotcom.solid,
            borderWidth: 1,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: "Big Tech AI",
            data: makePoints(aiPure),
            backgroundColor: SERIES_COLORS.bigTech.fill,
            borderColor: SERIES_COLORS.bigTech.solid,
            borderWidth: 1,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: "Pure-play AI",
            data: makePoints(aiBroad),
            backgroundColor: SERIES_COLORS.pureAi.fill,
            borderColor: SERIES_COLORS.pureAi.solid,
            borderWidth: 1,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { usePointStyle: true } },
          tooltip: {
            backgroundColor: THEME.tooltipBg,
            borderColor: THEME.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (c) =>
                `${c.dataset.label}: log(Rev)=${c.raw.x.toFixed(
                  2
                )}, log(MC)=${c.raw.y.toFixed(2)}`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "log(Revenue)" },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: "log(Market Cap)" },
          },
        },
      },
    }),
    [dotcom.length, aiPure.length, aiBroad.length]
  );

  return <canvas ref={canvasRef} />;
}

function MedianBarChart({ values, label }) {
  const canvasRef = useRef(null);

  useChart(
    canvasRef,
    () => ({
      type: "bar",
      data: {
        labels: ["Dot-com Peak", "Big Tech AI Peak", "Pure AI Peak"],
        datasets: [
          {
            label,
            data: values,
            backgroundColor: [
              SERIES_COLORS.dotcom.fill,
              SERIES_COLORS.bigTech.fill,
              SERIES_COLORS.pureAi.fill,
            ],
            borderColor: [
              SERIES_COLORS.dotcom.solid,
              SERIES_COLORS.bigTech.solid,
              SERIES_COLORS.pureAi.solid,
            ],
            borderWidth: 2,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: {
            title: { display: true, text: label },
          },
        },
      },
    }),
    [JSON.stringify(values), label]
  );

  return <canvas ref={canvasRef} />;
}

// ================== Nasdaq-100 index charts ====================

function IndexMetricCards({ metricName, dotSeries, modernSeries }) {
  if (
    !dotSeries ||
    !modernSeries ||
    !dotSeries.values ||
    !modernSeries.values
  ) {
    return null;
  }

  const dotVals = dotSeries.values.filter((v) => Number.isFinite(v));
  const modernVals = modernSeries.values.filter((v) => Number.isFinite(v));
  if (!dotVals.length || !modernVals.length) return null;

  const peakDotcom = Math.max(...dotVals);
  const peakModern = Math.max(...modernVals);
  const avgDotcom = meanFinite(dotVals);
  const avgModern = meanFinite(modernVals);

  const format =
    metricName === "P/E" ? (v) => v.toFixed(1) : (v) => v.toFixed(2);

  const cardStyle = {
    background:
      "linear-gradient(145deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.95) 100%)",
    borderRadius: 12,
    padding: "14px 16px",
    border: "1px solid rgba(148,163,184,0.3)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    boxShadow: "0 18px 35px rgba(15,23,42,0.6)",
  };

  const labelStyle = {
    fontSize: "0.8rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#9ca3af",
  };

  const valueStyle = (color) => ({
    fontFamily: "'Space Mono', ui-monospace, SFMono-Regular, Menlo, Monaco",
    fontSize: "1.9rem",
    fontWeight: 700,
    color,
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 16,
      }}
    >
      <div style={cardStyle}>
        <div style={labelStyle}>Peak {metricName} (Dot-com)</div>
        <div style={valueStyle(SERIES_COLORS.dotcom.solid)}>
          {format(peakDotcom)}
        </div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>Peak {metricName} (Modern AI era)</div>
        <div style={valueStyle(SERIES_COLORS.bigTech.solid)}>
          {format(peakModern)}
        </div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>Average {metricName} (Dot-com)</div>
        <div style={valueStyle(SERIES_COLORS.dotcom.solid)}>
          {format(avgDotcom)}
        </div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>Average {metricName} (Modern AI era)</div>
        <div style={valueStyle(SERIES_COLORS.bigTech.solid)}>
          {format(avgModern)}
        </div>
      </div>
    </div>
  );
}

function IndexSideBySideChart({ metricName, dotSeries, modernSeries }) {
  const dotRef = useRef(null);
  const modernRef = useRef(null);

  const buildConfig = (labels, values, label, color) => ({
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data: values,
          borderColor: color.solid,
          backgroundColor: color.fill,
          ...LINE_STYLE,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { usePointStyle: true, boxWidth: 6 },
        },
        tooltip: {
          backgroundColor: THEME.tooltipBg,
          borderColor: THEME.tooltipBorder,
          borderWidth: 1,
          titleColor: "#fff",
          bodyColor: "#cbd5e1",
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Quarter" },
          grid: { display: false },
        },
        y: {
          title: { display: true, text: `${metricName} Ratio` },
        },
      },
    },
  });

  useChart(
    dotRef,
    () =>
      buildConfig(
        dotSeries?.labels || [],
        dotSeries?.values || [],
        "Dot-com Era (1996–2000)",
        SERIES_COLORS.dotcom
      ),
    [JSON.stringify(dotSeries)]
  );

  useChart(
    modernRef,
    () =>
      buildConfig(
        modernSeries?.labels || [],
        modernSeries?.values || [],
        "Modern AI Era (2022–2025)",
        SERIES_COLORS.bigTech
      ),
    [JSON.stringify(modernSeries)]
  );

  if (
    !dotSeries ||
    !modernSeries ||
    !dotSeries.labels?.length ||
    !modernSeries.labels?.length
  ) {
    return (
      <div style={{ padding: "0.75rem", color: "#9ca3af" }}>
        Nasdaq-100 index series not available for this metric.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 24,
      }}
    >
      <div>
        <div
          style={{
            marginBottom: 8,
            fontSize: "0.9rem",
            color: "var(--muted)",
          }}
        >
          Dot-com Era (1996–2000)
        </div>
        <div className="chart-container" style={{ height: 280 }}>
          <canvas ref={dotRef} />
        </div>
      </div>
      <div>
        <div
          style={{
            marginBottom: 8,
            fontSize: "0.9rem",
            color: "var(--muted)",
          }}
        >
          Modern AI Era (2022–2025)
        </div>
        <div className="chart-container" style={{ height: 280 }}>
          <canvas ref={modernRef} />
        </div>
      </div>
    </div>
  );
}

function IndexOverlayChart({ metricName, dotSeries, modernSeries }) {
  const canvasRef = useRef(null);

  useChart(
    canvasRef,
    () => {
      if (
        !dotSeries ||
        !modernSeries ||
        !dotSeries.values ||
        !modernSeries.values
      ) {
        return {
          type: "line",
          data: { labels: [], datasets: [] },
          options: { responsive: true },
        };
      }

      const dotVals = dotSeries.values;
      const modernVals = modernSeries.values;

      const dotPeakIdx = findPeakIndex(dotVals);
      const modernPeakIdx = findPeakIndex(modernVals);

      if (dotPeakIdx === -1 || modernPeakIdx === -1) {
        return {
          type: "line",
          data: { labels: [], datasets: [] },
          options: { responsive: true },
        };
      }

      const dotPositions = dotVals.map((_, i) => i - dotPeakIdx);
      const modernPositions = modernVals.map((_, i) => i - modernPeakIdx);

      const minX = Math.min(...dotPositions, ...modernPositions);
      const maxX = Math.max(...dotPositions, ...modernPositions);

      const dotPoints = dotVals
        .map((v, i) =>
          Number.isFinite(v)
            ? { x: dotPositions[i], y: v }
            : null
        )
        .filter(Boolean);
      const modernPoints = modernVals
        .map((v, i) =>
          Number.isFinite(v)
            ? { x: modernPositions[i], y: v }
            : null
        )
        .filter(Boolean);

      const peakLinePlugin = {
        id: "peakLine",
        afterDraw(chart) {
          const xScale = chart.scales.x;
          const yScale = chart.scales.y;
          if (!xScale || !yScale) return;
          const x = xScale.getPixelForValue(0);
          const ctx = chart.ctx;
          ctx.save();
          ctx.strokeStyle = "rgba(148, 163, 184, 0.9)";
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(x, yScale.top);
          ctx.lineTo(x, yScale.bottom);
          ctx.stroke();
          ctx.restore();
        },
      };

      return {
        type: "line",
        data: {
          datasets: [
            {
              label: "Dot-com Era (1996–2000)",
              data: dotPoints,
              borderColor: SERIES_COLORS.dotcom.solid,
              backgroundColor: SERIES_COLORS.dotcom.fill,
              ...LINE_STYLE,
            },
            {
              label: "Modern AI Era (2022–2025)",
              data: modernPoints,
              borderColor: SERIES_COLORS.bigTech.solid,
              backgroundColor: SERIES_COLORS.bigTech.fill,
              ...LINE_STYLE,
            },
          ],
        },
        plugins: [peakLinePlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: {
              position: "top",
              labels: { usePointStyle: true, boxWidth: 6 },
            },
            tooltip: {
              backgroundColor: THEME.tooltipBg,
              borderColor: THEME.tooltipBorder,
              borderWidth: 1,
              titleColor: "#fff",
              bodyColor: "#cbd5e1",
            },
          },
          scales: {
            x: {
              type: "linear",
              min: minX,
              max: maxX,
              ticks: {
                stepSize: 1,
                callback: (v) => {
                  if (v === 0) return "PEAK";
                  if (v < 0) return `${Math.abs(v)}Q before peak`;
                  return `${v}Q after peak`;
                },
              },
              grid: { display: true },
            },
            y: {
              title: { display: true, text: `${metricName} Ratio` },
            },
          },
        },
      };
    },
    [JSON.stringify(dotSeries), JSON.stringify(modernSeries), metricName]
  );

  return (
    <div className="chart-container" style={{ height: 320 }}>
      <canvas ref={canvasRef} />
    </div>
  );
}

// ================== Macro chart ============================

function MacroLineChart({ series, yTitle }) {
  const canvasRef = useRef(null);

  useChart(
    canvasRef,
    () => ({
      type: "line",
      data: {
        datasets: series.map((s, idx) => ({
          label: s.label,
          data: s.data,
          borderColor: s.color || MACRO_COLORS[idx % MACRO_COLORS.length],
          backgroundColor:
            (s.color || MACRO_COLORS[idx % MACRO_COLORS.length]) + "20",
          ...LINE_STYLE,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            labels: { usePointStyle: true, boxWidth: 6 },
          },
          tooltip: {
            backgroundColor: THEME.tooltipBg,
            borderColor: THEME.tooltipBorder,
            borderWidth: 1,
            titleColor: "#fff",
            bodyColor: "#cbd5e1",
            callbacks: {
              title: (items) =>
                items[0]
                  ? formatDateLabel(new Date(items[0].raw.x))
                  : "",
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            ticks: {
              callback: (v) => formatDateLabel(new Date(v)),
              maxTicksLimit: 8,
            },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: yTitle },
          },
        },
      },
    }),
    [JSON.stringify(series), yTitle]
  );

  return <canvas ref={canvasRef} />;
}

// ============================================================
// 5. Main Application
// ============================================================

function App() {
  const [dotcom, setDotcom] = useState([]);
  const [aiBroad, setAiBroad] = useState([]);
  const [aiPure, setAiPure] = useState([]);
  const [macroRows, setMacroRows] = useState([]);
  const [peAverages, setPeAverages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  // Nasdaq-100 index-level state
  const [peIndexDotcom, setPeIndexDotcom] = useState({ labels: [], values: [] });
  const [peIndexModern, setPeIndexModern] = useState({ labels: [], values: [] });
  const [psIndexDotcom, setPsIndexDotcom] = useState({ labels: [], values: [] });
  const [psIndexModern, setPsIndexModern] = useState({ labels: [], values: [] });

  const [cohortToggles, setCohortToggles] = useState({
    dotcom: true,
    aiPure: true,
    aiBroad: true,
  });
  const [ratioMode, setRatioMode] = useState("ps");
  const [activeStory, setActiveStory] = useState("trend");

  const [macroColsState, setMacroColumns] = useState([]);
  const [macroSelection, setMacroSelection] = useState({});
  const [macroRange, setMacroRange] = useState([0, 0]);
  const [macroNormalization, setMacroNormalization] = useState(
    "Z-score (standardize)"
  );
  const [macroZoom, setMacroZoom] = useState("AI Boom (2022–2025)");
  const [macroZoom2, setMacroZoom2] = useState("Dot-com Bubble (1995–2002)");
  const [macroStory, setMacroStory] = useState(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        // Core cohort + macro + P/E averages
        const [dotPanel, purePanel, broadPanel, mRows, peRows] =
          await Promise.all([
            loadDotcomPanel(),
            loadExcelPanel(
              DATA_PATHS.bigTech,
              [2020, 2021, 2022, 2023, 2024, 2025],
              "HighTech.xlsx (Big Tech AI)"
            ),
            loadExcelPanel(
              DATA_PATHS.pureAi,
              [2020, 2021, 2022, 2023, 2024, 2025],
              "PureAI.xlsx (Pure-play AI)"
            ),
            loadMacrodata(),
            loadPeAverages(),
          ]);

        if (dotPanel.length) setDotcom(dotPanel);
        if (purePanel.length) setAiPure(purePanel);
        if (broadPanel.length) setAiBroad(broadPanel);
        if (peRows && peRows.length) setPeAverages(peRows);

        if (
          !dotPanel.length ||
          !purePanel.length ||
          !broadPanel.length ||
          !peRows.length
        ) {
          setUsingFallback(true);
        }

        if (mRows && mRows.length) {
          const mCols = MACRO_COLUMNS.filter((c) => c in mRows[0]);
          setMacroRows(mRows);
          setMacroColumns(mCols);
          setMacroSelection(
            mCols.reduce((acc, c) => ({ ...acc, [c]: true }), {})
          );
          setMacroRange([0, Math.max(mRows.length - 1, 0)]);
        }

        // Nasdaq-100 index-level series
        const [
          peIdxDot,
          peIdxMod,
          psIdxDot,
          psIdxMod,
        ] = await Promise.all([
          loadIndexSeries(DATA_PATHS.peIndexDotcom, "P/E Dot-com"),
          loadIndexSeries(DATA_PATHS.peIndexModern, "P/E Modern"),
          loadIndexSeries(DATA_PATHS.psIndexDotcom, "P/S Dot-com"),
          loadIndexSeries(DATA_PATHS.psIndexModern, "P/S Modern"),
        ]);

        setPeIndexDotcom(peIdxDot);
        setPeIndexModern(peIdxMod);
        setPsIndexDotcom(psIdxDot);
        setPsIndexModern(psIdxMod);
      } catch (e) {
        console.error("Data load failed:", e);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const activeDotcom = cohortToggles.dotcom ? dotcom : [];
  const activeAiPure = cohortToggles.aiPure ? aiPure : [];
  const activeAiBroad = cohortToggles.aiBroad ? aiBroad : [];

  const dotPeak = activeDotcom.filter((r) => [1999, 2000].includes(r.Year));
  const aiPurePeak = activeAiPure.filter((r) =>
    [2023, 2024, 2025].includes(r.Year)
  );
  const aiBroadPeak = activeAiBroad.filter((r) =>
    [2023, 2024, 2025].includes(r.Year)
  );

  const dotPeakLog = safeLogArray(dotPeak.map((r) => r.ValRev));
  const aiPurePeakLog = safeLogArray(aiPurePeak.map((r) => r.ValRev));
  const aiBroadPeakLog = safeLogArray(aiBroadPeak.map((r) => r.ValRev));

  const dotMed = medianLogPs(activeDotcom, [1999, 2000]);
  const pureMed = medianLogPs(activeAiPure, [2023, 2024, 2025]);
  const broadMed = medianLogPs(activeAiBroad, [2023, 2024, 2025]);

  const extractPe = (years, key, enabled) =>
    enabled
      ? peAverages
          .filter((r) => years.includes(r.Year))
          .map((r) => toNumberOrNull(r[key]))
          .filter((v) => Number.isFinite(v))
      : [];

  const peDotPeaks = extractPe([1999, 2000], "Dotcom", cohortToggles.dotcom);
  const peBigTechPeaks = extractPe(
    [2023, 2024, 2025],
    "BigTechAI",
    cohortToggles.aiPure
  );
  const pePurePeaks = extractPe(
    [2023, 2024, 2025],
    "PureAI",
    cohortToggles.aiBroad
  );

  const peDotMed = cohortToggles.dotcom ? medianValue(peDotPeaks) : null;
  const peBigTechMed = cohortToggles.aiPure
    ? medianValue(peBigTechPeaks)
    : null;
  const pePureMed = cohortToggles.aiBroad ? medianValue(pePurePeaks) : null;

  const macroFiltered = macroRows.slice(macroRange[0], macroRange[1] + 1);
  const macroSelectedCols = macroColsState.filter((c) => macroSelection[c]);
  const macroNormData = normalizeMacro(
    macroFiltered,
    macroSelectedCols,
    macroNormalization,
    macroRows
  );

  const buildSeries = (data, normData) =>
    macroSelectedCols.map((col, i) => ({
      label: col,
      color: MACRO_COLORS[i % MACRO_COLORS.length],
      data: data
        .map((row, idx) => {
          const y = normData[idx]?.[col];
          return y != null
            ? { x: row.Date.getTime(), y, original: row[col] }
            : null;
        })
        .filter(Boolean),
    }));

  const macroSeries = buildSeries(macroFiltered, macroNormData);

  const zoomRanges = {
    "AI Boom (2022–2025)": [
      new Date("2022-01-01"),
      new Date("2025-12-31"),
    ],
    "Dot-com Bubble (1995–2002)": [
      new Date("1995-01-01"),
      new Date("2002-12-31"),
    ],
    "Housing Bubble (2003–2009)": [
      new Date("2003-01-01"),
      new Date("2009-12-31"),
    ],
    "Smartphone Era (2007–2015)": [
      new Date("2007-01-01"),
      new Date("2015-12-31"),
    ],
    Reaganomics: [new Date("1981-01-01"), new Date("1989-12-31")],
  };

  const zoomDates = zoomRanges[macroZoom];
  const macroZoomRows =
    !macroZoom || macroZoom === "None" || !zoomDates
      ? []
      : macroRows.filter(
          (r) => r.Date >= zoomDates[0] && r.Date <= zoomDates[1]
        );
  const macroZoomNorm = normalizeMacro(
    macroZoomRows,
    macroSelectedCols,
    macroNormalization,
    macroRows
  );
  const macroZoomSeries = buildSeries(macroZoomRows, macroZoomNorm);

  const zoomDates2 = zoomRanges[macroZoom2];
  const macroZoomRows2 =
    !macroZoom2 || macroZoom2 === "None" || !zoomDates2
      ? []
      : macroRows.filter(
          (r) => r.Date >= zoomDates2[0] && r.Date <= zoomDates2[1]
        );
  const macroZoomNorm2 = normalizeMacro(
    macroZoomRows2,
    macroSelectedCols,
    macroNormalization,
    macroRows
  );
  const macroZoomSeries2 = buildSeries(macroZoomRows2, macroZoomNorm2);

  const applyMacroStory = (storyType) => {
    setMacroStory(storyType);
    if (storyType === "bull") {
      setMacroZoom("Dot-com Bubble (1995–2002)");
      setMacroZoom2("AI Boom (2022–2025)");
      const newSelection = {};
      MACRO_COLUMNS.forEach((c) => (newSelection[c] = false));
      newSelection["GDP Yearly Growth"] = true;
      newSelection["Unemployment"] = true;
      newSelection["NASDAQ Yearly Growth"] = true;
      setMacroSelection(newSelection);
    } else if (storyType === "bear") {
      setMacroZoom("Dot-com Bubble (1995–2002)");
      setMacroZoom2("AI Boom (2022–2025)");
      const newSelection = {};
      MACRO_COLUMNS.forEach((c) => (newSelection[c] = false));
      newSelection["Inflation"] = true;
      newSelection["Interest Rate"] = true;
      setMacroSelection(newSelection);
    }
  };

  const resetView = () => {
    setMacroStory(null);
    setMacroNormalization("Z-score (standardize)");
    setMacroZoom("AI Boom (2022–2025)");
    setMacroZoom2("Dot-com Bubble (1995–2002)");
    if (macroRows.length > 0) {
      setMacroRange([0, Math.max(macroRows.length - 1, 0)]);
      const allCols = MACRO_COLUMNS.filter((c) => c in macroRows[0]);
      setMacroSelection(
        allCols.reduce((acc, c) => ({ ...acc, [c]: true }), {})
      );
    }
  };

  const toggleCohort = (k) =>
    setCohortToggles((p) => ({ ...p, [k]: !p[k] }));
  const toggleMacroCol = (c) =>
    setMacroSelection((p) => ({ ...p, [c]: !p[c] }));

  const storyContent = {
    ps: {
      trend: {
        title: "Heat over time",
        body: "Dot-com valuations rocketed on top of single-product web ideas, often with fragile business models. Today's AI excitement sits on cash-generating platforms.",
        bullets: [
          "Dot-com: sharp spike as speculation decouples from fundamentals.",
          "Pure-play AI: averages rise faster than Big Tech AI thanks to narrow revenue bases.",
          "Big Tech AI: steadier climb because diversified platforms buffer hype swings.",
        ],
      },
      peaks: {
        title: "Peak distributions",
        body: "Peak windows show where cohorts cluster. Dot-com names piled up at extreme valuations, pure AI sits above Big Tech, but neither revisit 2000's mania.",
        bullets: [
          "Dot-com: box sits high with long whiskers—classic froth.",
          "Pure-play AI: higher medians than Big Tech but tighter than dot-com peaks.",
          "Big Tech AI: compact box thanks to diversified revenue cushions.",
        ],
      },
      scale: {
        title: "Scale vs. Revenue",
        body: "On the log–log scatter, Big Tech spans huge revenue bases with healthy market-cap alignment. Dot-com and pure AI points overlap across log values.",
        bullets: [
          "Dot-com vs. Pure AI: overlapping clouds show both chase value ahead of revenue.",
          "Big Tech AI: trends up and to the right with fewer outliers.",
          "Spread: pure AI and dot-com clusters sit at lower revenue scales, amplifying volatility.",
        ],
      },
      median: {
        title: "Typical peaks",
        body: "Median P/S at cohort peaks highlights cushion. Big Tech AI stays nearer sustainable bands, while pure AI floats higher—still calmer than dot-com extremes.",
        bullets: [
          "Dot-com: elevated medians underline the bubble's breadth.",
          "Pure-play AI: higher medians hint at optimism priced in before revenue catches up.",
          "Big Tech AI: lower medians signal investors reward proven engines.",
        ],
      },
    },
    pe: {
      trend: {
        title: "Heat over time",
        body: "Average P/E shows how each era prices earnings as excitement swells. Dot-com stair-steps into 2000, Big Tech stays steadier despite the 2022 EPS dip, and pure AI starts calmer before echoing dot-com’s late lift in 2024–25.",
        bullets: [
          "Dot-com: earnings multiples climb fast as the 2000 peak nears.",
          "Big Tech AI: lives in a mid-30s–40s band, briefly knocked by 2022 EPS noise.",
          "Pure-play AI: quiet early, then mirrors dot-com’s late-ramp pattern into 2025.",
        ],
      },
      peaks: {
        title: "Peak distributions",
        body: "Peak windows show how extremes bunch. Pure-play AI now carries the highest tail, dot-com sits in the middle band, and Big Tech stays tighter after its 2022 reset.",
        bullets: [
          "Dot-com: middle cluster, elevated but no longer the ceiling.",
          "Big Tech AI: narrower box, reflecting larger, steadier earnings engines.",
          "Pure-play AI: widest spread and top end, hinting at a softer dot-com echo.",
        ],
      },
      scale: {
        title: "Share price vs EPS (earnings per share)",
        body: "Share price against EPS on a log scale to see how each cohort prices profits. Big Tech leans on hefty earnings, dot-com points cluster lower, and pure AI rockets in the later years.",
        bullets: [
          "Dot-com: low-to-mid EPS keeps most points low and left.",
          "Big Tech AI: higher EPS lifts the cloud up-right, even with calmer pricing.",
          "Pure-play AI: late surge pulls price faster than EPS, looking closer to dot-com than Big Tech.",
        ],
      },
      median: {
        title: "Typical peaks",
        body: "Median P/E at peak windows shows pure AI now on top, dot-com in the middle, and Big Tech grounded in the mid-30s.",
        bullets: [
          "Dot-com: middle-slot median, a reminder of 1999–2000 heat without leading.",
          "Big Tech AI: mid-30s median signals valuation discipline from scale.",
          "Pure-play AI: highest median of the three, edging past dot-com.",
        ],
      },
    },
  };

  const metricName = ratioMode === "ps" ? "P/S" : "P/E";
  const activeIndexDotcom =
    ratioMode === "ps" ? psIndexDotcom : peIndexDotcom;
  const activeIndexModern =
    ratioMode === "ps" ? psIndexModern : peIndexModern;

  return (
    <div className="page">
      <div className="hero">
        <div className="tag">Dot-com vs AI</div>
        <h1>Is the AI bubble real?</h1>
        <p>
          We contrast the late-1990s dot-com spike with today&apos;s AI surge.
          See why diversified giants are structurally safer than the narrow bets
          of the past.
        </p>
        <div className="controls-row">
          <label className="toggle-pill">
            <input
              type="checkbox"
              checked={cohortToggles.dotcom}
              onChange={() => toggleCohort("dotcom")}
            />{" "}
            Dot-com
          </label>
          <label className="toggle-pill">
            <input
              type="checkbox"
              checked={cohortToggles.aiPure}
              onChange={() => toggleCohort("aiPure")}
            />{" "}
            Big Tech AI
          </label>
          <label className="toggle-pill">
            <input
              type="checkbox"
              checked={cohortToggles.aiBroad}
              onChange={() => toggleCohort("aiBroad")}
            />{" "}
            Pure-play AI
          </label>
        </div>
      </div>

      {/* GLOBAL P/S vs P/E TOGGLE (outside card, controls cohorts + Nasdaq) */}
      <div
        className="metric-toggle-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          justifyContent: "flex-start",
        }}
      >
        <span
          style={{
            fontSize: "0.9rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#9ca3af",
          }}
        >
          Valuation metric:
        </span>
        <button
          className={`story-btn ${ratioMode === "ps" ? "active" : ""}`}
          onClick={() => {
            setRatioMode("ps");
            setActiveStory("trend");
          }}
        >
          P/S ratio
        </button>
        <button
          className={`story-btn ${ratioMode === "pe" ? "active" : ""}`}
          onClick={() => {
            setRatioMode("pe");
            setActiveStory("trend");
          }}
        >
          P/E ratio
        </button>
      </div>

      {/* STORY SECTION (P/S + P/E cohort graphs) */}
      <div className="story-section">
        <div className="section-header">
          <h2>The Data Story</h2>
        </div>

        <div className="story-grid">
          <div className="card story-content">
            <div className="story-tabs">
              {Object.keys(storyContent[ratioMode]).map((k) => (
                <button
                  key={k}
                  className={`story-btn ${activeStory === k ? "active" : ""}`}
                  onClick={() => setActiveStory(k)}
                >
                  {storyContent[ratioMode][k].title}
                </button>
              ))}
            </div>
            <div className="info-box">
              <div className="info-headline">
                {storyContent[ratioMode][activeStory]?.title}
              </div>
              <p className="info-body">
                {storyContent[ratioMode][activeStory]?.body}
              </p>
              <ul>
                {(storyContent[ratioMode][activeStory]?.bullets || []).map(
                  (b, i) => (
                    <li key={i}>{b}</li>
                  )
                )}
              </ul>
            </div>
          </div>

          <div className="card chart-card">
            <div className="chart-container">
              {loading && (
                <p
                  style={{
                    textAlign: "center",
                    marginTop: 100,
                    color: "var(--muted)",
                  }}
                >
                  Loading datasets...
                </p>
              )}
              {!loading &&
                ratioMode === "ps" &&
                activeStory === "trend" && (
                  <AvgPsLineChart
                    dotcom={activeDotcom}
                    aiPure={activeAiPure}
                    aiBroad={activeAiBroad}
                  />
                )}
              {!loading &&
                ratioMode === "pe" &&
                activeStory === "trend" && (
                  <AvgPeLineChart
                    peRows={peAverages}
                    toggles={cohortToggles}
                  />
                )}
              {!loading &&
                ratioMode === "ps" &&
                activeStory === "peaks" && (
                  <PeakBoxplotChart
                    dotVals={dotPeakLog}
                    pureVals={aiPurePeakLog}
                    broadVals={aiBroadPeakLog}
                    yTitle="log(P/S Distribution)"
                  />
                )}
              {!loading &&
                ratioMode === "pe" &&
                activeStory === "peaks" && (
                  <PeakBoxplotChart
                    dotVals={peDotPeaks}
                    pureVals={peBigTechPeaks}
                    broadVals={pePurePeaks}
                    yTitle="P/E at Peaks"
                  />
                )}
              {!loading &&
                ratioMode === "ps" &&
                activeStory === "scale" && (
                  <McRevScatterChart
                    dotcom={activeDotcom}
                    aiPure={activeAiPure}
                    aiBroad={activeAiBroad}
                  />
                )}
              {!loading &&
                ratioMode === "pe" &&
                activeStory === "scale" && (
                  <PeScatterChart
                    peRows={peAverages}
                    toggles={cohortToggles}
                    dotcom={activeDotcom}
                    aiPure={activeAiPure}
                    aiBroad={activeAiBroad}
                  />
                )}
              {!loading &&
                ratioMode === "ps" &&
                activeStory === "median" && (
                  <MedianBarChart
                    values={[dotMed, pureMed, broadMed]}
                    label="Median log(P/S)"
                  />
                )}
              {!loading &&
                ratioMode === "pe" &&
                activeStory === "median" && (
                  <MedianBarChart
                    values={[peDotMed, peBigTechMed, pePureMed]}
                    label="Median P/E"
                  />
                )}
            </div>
            <div className="chart-subtitle">
              {ratioMode === "ps" &&
                activeStory === "trend" &&
                "Logarithmic scale showing valuation multiples over time. Dot-com bubble clearly visible on the left."}
              {ratioMode === "pe" &&
                activeStory === "trend" &&
                "Average P/E paths: dot-com climbs into 2000, Big Tech steadies after the 2022 dip, and pure AI’s late lift subtly echoes dot-com momentum."}
              {ratioMode === "ps" &&
                activeStory === "peaks" &&
                "Distribution of Valuation/Revenue ratios at market peaks. Dot-com outliers sit much higher."}
              {ratioMode === "pe" &&
                activeStory === "peaks" &&
                "Peak P/E distributions: pure-play AI carries the highest tail, dot-com sits mid-pack, and Big Tech stays tighter after its 2022 reset."}
              {ratioMode === "ps" &&
                activeStory === "scale" &&
                "Comparing Market Cap vs Revenue on a log-log scale. Big Tech aligns with scale; Dot-com scattered."}
              {ratioMode === "pe" &&
                activeStory === "scale" &&
                "Log scatter of share price vs EPS shows dot-com clustered low, Big Tech buoyed by larger earnings, and pure AI drifting toward dot-com territory before leaping late."}
              {ratioMode === "ps" &&
                activeStory === "median" &&
                "Median Price-to-Sales ratio at the height of each era. Big Tech valuations remain grounded."}
              {ratioMode === "pe" &&
                activeStory === "median" &&
                "Median P/E at peak windows: pure-play AI leads, dot-com trails it, and Big Tech holds mid-30s discipline."}
              {usingFallback && (
                <span
                  style={{
                    display: "block",
                    color: "#fde047",
                    fontSize: "0.8rem",
                    marginTop: 8,
                  }}
                >
                  Note: Some cohorts are missing or partially loaded. Check file
                  paths and CSV headers if something looks off.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NASDAQ-100 INDEX-LEVEL SECTION (shares metric toggle above) */}
      <div className="story-section">
        <div className="section-header">
          <h2>Nasdaq-100 Index Valuation Metrics</h2>
          <p className="section-subtitle">
            Comparing the dot-com bubble (1996–2000) vs the modern AI era
            (2022–2025) using index-level {metricName} ratios.
          </p>
        </div>

        <div className="card chart-card" style={{ marginBottom: 24 }}>
          <IndexMetricCards
            metricName={metricName}
            dotSeries={activeIndexDotcom}
            modernSeries={activeIndexModern}
          />
        </div>

        <div
          className="story-grid"
          style={{ gridTemplateColumns: "1.5fr 1fr", gap: 24 }}
        >
          <div className="card chart-card">
            <div className="chart-container">
              <IndexSideBySideChart
                metricName={metricName}
                dotSeries={activeIndexDotcom}
                modernSeries={activeIndexModern}
              />
            </div>
            <div className="chart-subtitle">
              Side-by-side view of Nasdaq-100 index {metricName} during the
              dot-com bubble vs the recent AI cycle.
            </div>
          </div>
          <div className="card chart-card">
            <IndexOverlayChart
              metricName={metricName}
              dotSeries={activeIndexDotcom}
              modernSeries={activeIndexModern}
            />
            <div className="chart-subtitle">
              Overlay comparison with both eras aligned so their peak index
              valuations sit on the same PEAK line (0 on the x-axis).
            </div>
          </div>
        </div>
      </div>

      {/* MACRO SECTION */}
      <div className="macro-section">
        <div className="section-header">
          <h2>Macroeconomic Context</h2>
        </div>

        {/* Bull / Bear controls */}
        <div
          className="macro-story-controls"
          style={{
            display: "flex",
            gap: "1rem",
            marginBottom: "2rem",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => applyMacroStory("bull")}
            className={`story-btn ${macroStory === "bull" ? "active" : ""}`}
            style={{
              fontSize: "1.2rem",
              padding: "1rem 2rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              borderColor: macroStory === "bull" ? "#22c55e" : undefined,
            }}
          >
            <span>🐂</span> Bull Case
          </button>
          <button
            onClick={() => applyMacroStory("bear")}
            className={`story-btn ${macroStory === "bear" ? "active" : ""}`}
            style={{
              fontSize: "1.2rem",
              padding: "1rem 2rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              borderColor: macroStory === "bear" ? "#ef4444" : undefined,
            }}
          >
            <span>🐻</span> Bear Case
          </button>
          <button
            onClick={resetView}
            className="story-btn"
            style={{
              fontSize: "1.2rem",
              padding: "1rem 2rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              borderColor: "rgba(255,255,255,0.4)",
              color: "#fff",
            }}
          >
            <span>🔄</span> Reset View
          </button>
        </div>

        {macroStory && (
          <div
            className="card story-content"
            style={{
              marginBottom: "2rem",
              borderLeft:
                macroStory === "bull"
                  ? "4px solid #22c55e"
                  : "4px solid #ef4444",
            }}
          >
            <div className="info-headline">
              {macroStory === "bull"
                ? "The Bull Case: Resilience & Growth"
                : "The Bear Case: Rate Shock Risk"}
            </div>
            <p className="info-body">
              {macroStory === "bull"
                ? "Yes, it's true that the stock market growth is outpacing GDP growth, but viewing it in the bigger picture it's not as bad as it seems, and not close to the dot-com bubble.  Unemployment is rising, but still low by historical standards."
                : "The interest rate is generally raised to lower inflation, but despite decades-high rates, inflation remains sticky.  In the dot-com bubble, interest rates were similar to today's pre-crash rates."}
            </p>
          </div>
        )}

        <div className="macro-layout">
          <div className="card macro-controls">
            <h3>Configuration</h3>
            <div className="control-group">
              <div className="field">
                <label>Normalization</label>
                <select
                  value={macroNormalization}
                  onChange={(e) =>
                    setMacroNormalization(e.target.value)
                  }
                >
                  <option>Z-score (standardize)</option>
                  <option>Index to 100</option>
                  <option>None</option>
                </select>
              </div>

              <div className="field">
                <label>Date Range</label>
                <div className="badges">
                  <span>
                    {macroRows[macroRange[0]]?.Date
                      ? formatDateLabel(
                          macroRows[macroRange[0]].Date
                        )
                      : "Start"}
                  </span>
                  <span>
                    {macroRows[macroRange[1]]?.Date
                      ? formatDateLabel(
                          macroRows[macroRange[1]].Date
                        )
                      : "End"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(macroRows.length - 1, 0)}
                  value={macroRange[0]}
                  onChange={(e) =>
                    setMacroRange([
                      Math.min(
                        Number(e.target.value),
                        macroRange[1]
                      ),
                      macroRange[1],
                    ])
                  }
                />
                <input
                  type="range"
                  min={0}
                  max={Math.max(macroRows.length - 1, 0)}
                  value={macroRange[1]}
                  onChange={(e) =>
                    setMacroRange([
                      macroRange[0],
                      Math.max(
                        Number(e.target.value),
                        macroRange[0]
                      ),
                    ])
                  }
                />
              </div>

              <div className="field">
                <label>Indicators</label>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {macroColsState.map((c) => (
                    <label
                      key={c}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: "0.9rem",
                        color: "#cbd5e1",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!macroSelection[c]}
                        onChange={() => toggleMacroCol(c)}
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: "var(--accent)",
                        }}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Compare Era</label>
                <select
                  value={macroZoom}
                  onChange={(e) => setMacroZoom(e.target.value)}
                >
                  {Object.keys(zoomRanges).map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                  <option>None</option>
                </select>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            <div className="card chart-card">
              <h3
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "1rem",
                  color: "var(--muted)",
                }}
              >
                Full History
              </h3>
              <div className="chart-container">
                <MacroLineChart
                  series={macroSeries}
                  yTitle={macroNormalization}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 24,
                flexDirection: "row",
                flexWrap: "wrap",
              }}
            >
              {macroZoom !== "None" && (
                <div
                  className="card chart-card"
                  style={{ flex: 1, minWidth: 300 }}
                >
                  <h3
                    style={{
                      margin: "0 0 10px 0",
                      fontSize: "1rem",
                      color: "var(--muted)",
                    }}
                  >
                    Zoom: {macroZoom}
                  </h3>
                  <div
                    className="chart-container"
                    style={{ height: 320 }}
                  >
                    <MacroLineChart
                      series={macroZoomSeries}
                      yTitle={macroNormalization}
                    />
                  </div>
                </div>
              )}

              {macroZoom2 !== "None" && (
                <div
                  className="card chart-card"
                  style={{ flex: 1, minWidth: 300 }}
                >
                  <div style={{ marginBottom: 10 }}>
                    <select
                      value={macroZoom2}
                      onChange={(e) => setMacroZoom2(e.target.value)}
                      style={{
                        fontSize: "1rem",
                        padding: "4px 8px",
                        background: "transparent",
                        border: "none",
                        color: "var(--muted)",
                        cursor: "pointer",
                        outline: "none",
                        fontWeight: 600,
                        textAlign: "left",
                      }}
                    >
                      <option disabled>Select Era...</option>
                      {Object.keys(zoomRanges).map((z) => (
                        <option
                          key={z}
                          value={z}
                          style={{
                            background: "#0f1629",
                            color: "#e2e8f0",
                          }}
                        >
                          {z}
                        </option>
                      ))}
                      <option
                        value="None"
                        style={{
                          background: "#0f1629",
                          color: "#e2e8f0",
                        }}
                      >
                        None
                      </option>
                    </select>
                  </div>
                  <div
                    className="chart-container"
                    style={{ height: 320 }}
                  >
                    <MacroLineChart
                      series={macroZoomSeries2}
                      yTitle={macroNormalization}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
