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

// Colorblind-friendly palette for main series (cohorts)
// Using distinct colors that work for all types of colorblindness
// Orange, Cyan, and Purple are distinguishable by brightness/shape even for colorblind users
const SERIES_COLORS = {
  dotcom: { solid: "#f59e0b", fill: "rgba(245, 158, 11, 0.2)" }, // Amber/Orange - warm, distinct
  bigTech: { solid: "#06b6d4", fill: "rgba(6, 182, 212, 0.2)" }, // Cyan - cool, distinct
  pureAi: { solid: "#a855f7", fill: "rgba(168, 85, 247, 0.2)" }, // Purple - distinct from both
};

// Separate colorblind-friendly palette for macro indicators
// Different from SERIES_COLORS to avoid confusion
// Colors chosen for distinct brightness levels and colorblind accessibility
const MACRO_COLORS = ["#9333ea", "#14b8a6", "#eab308", "#ef4444", "#3b82f6"];

const MACRO_COLOR_MAP = {
  Inflation: "#9333ea", // Deep purple/violet - distinct
  Unemployment: "#14b8a6", // Teal - different shade from Big Tech cyan
  "Interest Rate": "#eab308", // Yellow/amber - distinct brightness
  "GDP Yearly Growth": "#ef4444", // Red - distinct from orange Dot-com
  "NASDAQ Yearly Growth": "#3b82f6", // Blue - distinct from cyan Big Tech
};

const MACRO_COLUMNS = [
  "Inflation",
  "Unemployment",
  "Interest Rate",
  "GDP Yearly Growth",
  "NASDAQ Yearly Growth",
];

// Clamp value to the provided range (numeric guard only).
function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// ============================================================
// Financial Term Tooltip Component
// ============================================================

const FINANCIAL_DEFINITIONS = {
  "P/S": {
    term: "Price-to-Sales (P/S) Ratio",
    definition: "A valuation metric that compares a company's market capitalization to its annual revenue. It shows how much investors are willing to pay for each dollar of sales. A lower P/S ratio may indicate a stock is undervalued, while a higher ratio suggests investors expect strong growth. Unlike P/E ratios, P/S can be used for companies that aren't yet profitable.",
  },
  "P/E": {
    term: "Price-to-Earnings (P/E) Ratio",
    definition: "A valuation metric that compares a company's share price to its earnings per share (EPS). It indicates how much investors are willing to pay for each dollar of earnings. A high P/E ratio suggests investors expect strong future growth, while a low P/E may indicate undervaluation or poor growth prospects. P/E ratios are most meaningful for profitable companies.",
  },
  "NASDAQ-100": {
    term: "NASDAQ-100 Index",
    definition: "A stock market index of the 100 largest non-financial companies listed on the NASDAQ stock exchange. It includes major technology companies like Apple, Microsoft, Amazon, and Google. The index is weighted by market capitalization and serves as a benchmark for the performance of large-cap tech stocks. It excludes financial companies and focuses on growth-oriented sectors.",
  },
  "Nasdaq-100": {
    term: "NASDAQ-100 Index",
    definition: "A stock market index of the 100 largest non-financial companies listed on the NASDAQ stock exchange. It includes major technology companies like Apple, Microsoft, Amazon, and Google. The index is weighted by market capitalization and serves as a benchmark for the performance of large-cap tech stocks. It excludes financial companies and focuses on growth-oriented sectors.",
  },
  "Market Cap": {
    term: "Market Capitalization",
    definition: "The total dollar market value of a company's outstanding shares of stock. It's calculated by multiplying the current share price by the total number of outstanding shares. Market cap is used to categorize companies as large-cap, mid-cap, or small-cap, and reflects what investors collectively believe a company is worth.",
  },
  "market cap": {
    term: "Market Capitalization",
    definition: "The total dollar market value of a company's outstanding shares of stock. It's calculated by multiplying the current share price by the total number of outstanding shares. Market cap is used to categorize companies as large-cap, mid-cap, or small-cap, and reflects what investors collectively believe a company is worth.",
  },
  "EPS": {
    term: "Earnings Per Share (EPS)",
    definition: "A company's profit divided by the number of outstanding shares. It represents the portion of a company's profit allocated to each share of common stock. Higher EPS generally indicates greater profitability. EPS is a key metric used in calculating the Price-to-Earnings (P/E) ratio and helps investors assess a company's profitability on a per-share basis.",
  },
  "Revenue": {
    term: "Revenue",
    definition: "The total amount of money a company receives from its business activities, such as selling products or services, before subtracting expenses. Also called 'sales' or 'top line,' revenue is a fundamental measure of a company's business performance and growth. It's used in calculating metrics like Price-to-Sales (P/S) ratio.",
  },
  "revenue": {
    term: "Revenue",
    definition: "The total amount of money a company receives from its business activities, such as selling products or services, before subtracting expenses. Also called 'sales' or 'top line,' revenue is a fundamental measure of a company's business performance and growth. It's used in calculating metrics like Price-to-Sales (P/S) ratio.",
  },
  "revenues": {
    term: "Revenue",
    definition: "The total amount of money a company receives from its business activities, such as selling products or services, before subtracting expenses. Also called 'sales' or 'top line,' revenue is a fundamental measure of a company's business performance and growth. It's used in calculating metrics like Price-to-Sales (P/S) ratio.",
  },
};

function FinancialTooltip({ term, children }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef(null);

  const definition = FINANCIAL_DEFINITIONS[term];
  if (!definition) return <>{children}</>;

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        cursor: "help",
        borderBottom: "1px dotted rgba(148, 163, 184, 0.5)",
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      ref={tooltipRef}
    >
      {children}
      {showTooltip && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: "8px",
            width: "320px",
            padding: "12px 16px",
            backgroundColor: THEME.tooltipBg,
            border: `1px solid ${THEME.tooltipBorder}`,
            borderRadius: "8px",
            fontSize: "0.875rem",
            lineHeight: "1.5",
            color: "#e2e8f0",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: "#fff",
              marginBottom: "6px",
              fontSize: "0.9rem",
            }}
          >
            {definition.term}
          </div>
          <div style={{ color: "#cbd5e1" }}>{definition.definition}</div>
          <div
            style={{
              position: "absolute",
              bottom: "-6px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: `6px solid ${THEME.tooltipBg}`,
            }}
          />
        </div>
      )}
    </span>
  );
}

// Helper function to render text with financial term tooltips
function renderTextWithTooltips(text) {
  if (typeof text !== "string") return text;
  
  // Map of term variations to canonical term keys (for lookup)
  const termMap = {
    "market cap": "Market Cap",
    "revenue": "Revenue",
    "revenues": "Revenue",
    "nasdaq-100": "NASDAQ-100",
  };
  
  // Get all terms to search for (including variations)
  const allTerms = Object.keys(FINANCIAL_DEFINITIONS);
  const parts = [];
  let lastIndex = 0;
  
  // Find all occurrences of financial terms (case-insensitive)
  const matches = [];
  allTerms.forEach((term) => {
    // Escape special regex characters
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Create regex that matches word boundaries or start/end of string
    // Handle special cases like "P/S" and "P/E" which don't have word boundaries
    const pattern = term.includes("/") 
      ? `\\b${escapedTerm}\\b|${escapedTerm}(?=\\s|$|,|\\.|\\?|!|;|:|\\))`
      : `\\b${escapedTerm}\\b`;
    const regex = new RegExp(pattern, "gi");
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Use canonical term key if available, otherwise use the matched term
      const canonicalTerm = termMap[term.toLowerCase()] || term;
      // Only add if the canonical term exists in definitions
      if (FINANCIAL_DEFINITIONS[canonicalTerm]) {
        matches.push({
          term: canonicalTerm,
          index: match.index,
          length: match[0].length,
          text: match[0],
        });
      }
    }
  });
  
  // Sort matches by index
  matches.sort((a, b) => a.index - b.index);
  
  // Remove overlapping matches (keep the first one)
  const filteredMatches = [];
  matches.forEach((match) => {
    const overlaps = filteredMatches.some(
      (m) =>
        match.index < m.index + m.length &&
        match.index + match.length > m.index
    );
    if (!overlaps) {
      filteredMatches.push(match);
    }
  });
  
  // Build the JSX
  filteredMatches.forEach((match) => {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    // Add the tooltip-wrapped term
    parts.push(
      <FinancialTooltip key={`${match.index}-${match.term}`} term={match.term}>
        {match.text}
      </FinancialTooltip>
    );
    lastIndex = match.index + match.length;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  
  return parts.length > 0 ? <>{parts}</> : text;
}

/**
 * DualRangeSlider lets the user drag two thumbs over one shared track
 * to update start/end boundaries.
 */
function DualRangeSlider({ min, max, values, onChange }) {
  const sliderRef = useRef(null);
  const [dragging, setDragging] = useState(null);

  useEffect(() => {
    if (!dragging || !sliderRef.current) return undefined;

    const handleMove = (event) => {
      if (!sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const relativeX = (event.clientX - rect.left) / rect.width;
      const range = max - min || 1;
      const raw = clamp(Math.round(min + relativeX * range), min, max);
      if (dragging === "start") {
        const nextStart = Math.min(raw, values[1]);
        onChange([nextStart, values[1]]);
      } else {
        const nextEnd = Math.max(raw, values[0]);
        onChange([values[0], nextEnd]);
      }
    };

    const handleUp = () => setDragging(null);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging, min, max, values, onChange]);

  const span = Math.max(max - min, 1);
  const startPct = ((values[0] - min) / span) * 100;
  const endPct = ((values[1] - min) / span) * 100;

  const handleCommon = {
    position: "absolute",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: "2px solid var(--accent)",
    background: "#0f1629",
    cursor: "pointer",
  };

  return (
    <div
      ref={sliderRef}
      style={{
        position: "relative",
        height: 40,
        marginTop: 12,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "50% 0 auto",
          transform: "translateY(-50%)",
          height: 6,
          borderRadius: 999,
          background: "rgba(148, 163, 184, 0.4)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "50% auto 0",
          transform: "translateY(-50%)",
          height: 6,
          borderRadius: 999,
          left: `${startPct}%`,
          right: `${100 - endPct}%`,
          background: "var(--accent)",
        }}
      />
      <button
        type="button"
        aria-label="Start range"
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging("start");
        }}
        style={{ ...handleCommon, left: `${startPct}%`, zIndex: 2 }}
      />
      <button
        type="button"
        aria-label="End range"
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging("end");
        }}
        style={{ ...handleCommon, left: `${endPct}%` }}
      />
    </div>
  );
}

const ZOOM_SELECT_STYLE = {
  fontSize: "1rem",
  padding: "4px 8px",
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  cursor: "pointer",
  outline: "none",
  fontWeight: 600,
  textAlign: "left",
};

const ZOOM_OPTION_STYLE = {
  background: "#0f1629",
  color: "#e2e8f0",
};

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

// Extract unique company names from panel data
function extractCompanyNames(panel) {
  const companies = new Set();
  panel.forEach((record) => {
    if (record.Company && record.Company.trim()) {
      companies.add(record.Company.trim());
    }
  });
  return Array.from(companies).sort();
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

// Formats macro tooltip numbers for readability.
function formatMacroTooltipValue(value) {
  if (value == null) return "N/A";
  const num = Number(value);
  if (!Number.isFinite(num)) return "N/A";
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(num);
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

// ================== Collapsible Log Scale Note Component =================

function CollapsibleLogNote({ children }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div style={{ marginTop: "8px" }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: "none",
          border: "none",
          color: "#9ca3af",
          fontSize: "0.7rem",
          cursor: "pointer",
          padding: "4px 0",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: "0.75rem" }}>ℹ️</span>
        <span style={{ textDecoration: "underline" }}>
          {isExpanded ? "Hide note about log scale" : "Show note about log scale"}
        </span>
      </button>
      {isExpanded && (
        <div
          style={{
            fontSize: "0.7rem",
            color: "#9ca3af",
            fontStyle: "italic",
            marginTop: "6px",
            padding: "6px 10px",
            background: "rgba(148, 163, 184, 0.1)",
            borderRadius: "6px",
            borderLeft: "3px solid rgba(148, 163, 184, 0.3)",
            lineHeight: "1.4",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ================== Company List Component =================

function CompanyListCard({ title, companies, color, enabled }) {
  if (!enabled || !companies || companies.length === 0) return null;
  
  return (
    <div
      className="card"
      style={{
        padding: "16px 20px",
        border: `1px solid ${color}40`,
        background: `linear-gradient(145deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.95) 100%)`,
      }}
    >
      <div
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: color,
          marginBottom: "12px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title} ({companies.length} companies)
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        {companies.map((company, idx) => (
          <span
            key={idx}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "0.875rem",
              background: `${color}20`,
              color: "#e2e8f0",
              border: `1px solid ${color}40`,
            }}
          >
            {company}
          </span>
        ))}
      </div>
    </div>
  );
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
              text: "Valuation / Revenue",
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
            return {
              x: Math.log(sharePrice),
              y: Math.log(eps),
              rawPrice: sharePrice,
              rawEps: eps,
              year: r.Year,
            };
          })
          .filter(Boolean)
      : [];

  const dotPoints = makePoints("Dotcom", epsMaps.Dotcom, toggles.dotcom);
  const bigPoints = makePoints("BigTechAI", epsMaps.BigTechAI, toggles.aiPure);
  const purePoints = makePoints("PureAI", epsMaps.PureAI, toggles.aiBroad);
  const datasets = [
    {
      label: "Dot-com",
      data: dotPoints,
      backgroundColor: SERIES_COLORS.dotcom.fill,
      borderColor: SERIES_COLORS.dotcom.solid,
      borderWidth: 1,
      pointRadius: 4,
      pointHoverRadius: 6,
    },
    {
      label: "Big Tech AI",
      data: bigPoints,
      backgroundColor: SERIES_COLORS.bigTech.fill,
      borderColor: SERIES_COLORS.bigTech.solid,
      borderWidth: 1,
      pointRadius: 4,
      pointHoverRadius: 6,
    },
    {
      label: "Pure-play AI",
      data: purePoints,
      backgroundColor: SERIES_COLORS.pureAi.fill,
      borderColor: SERIES_COLORS.pureAi.solid,
      borderWidth: 1,
      pointRadius: 4,
      pointHoverRadius: 6,
    },
  ];

  useChart(
    canvasRef,
    () => ({
      type: "scatter",
      data: {
        datasets,
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
                  const price = Number(c.raw.rawPrice);
                  const eps = Number(c.raw.rawEps);
                  const fmt = (v) =>
                  Number.isFinite(v)
                    ? v.toLocaleString("en-US", { maximumFractionDigits: 2 })
                    : "N/A";
                return `${c.dataset.label}: $${fmt(price)} price, $${fmt(
                  eps
                )} EPS (log price=${c.raw.x.toFixed(
                  2
                )}, log EPS=${c.raw.y.toFixed(2)}, Year ${c.raw.year})`;
              },
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: "Share price" },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: "EPS" },
          },
        },
      },
    }),
    [
      JSON.stringify(dotPoints),
      JSON.stringify(bigPoints),
      JSON.stringify(purePoints),
    ]
  );

  return <canvas ref={canvasRef} />;
}

function PeakBoxplotChart({
  dotVals,
  pureVals,
  broadVals,
  yTitle = "P/S Distribution",
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
            title: { display: true, text: "Revenue" },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: "Market Cap" },
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
              label: (item) => {
                const actual = item.raw?.original;
                const formatted = formatMacroTooltipValue(actual);
                return `${item.dataset.label}: ${formatted}%`;
              },
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
  
  // Company names for each cohort
  const [dotcomCompanies, setDotcomCompanies] = useState([]);
  const [aiPureCompanies, setAiPureCompanies] = useState([]);
  const [aiBroadCompanies, setAiBroadCompanies] = useState([]);

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
  const [macroZoom, setMacroZoom] = useState("Dot-com Bubble (1995–2002)");
  const [macroZoom2, setMacroZoom2] = useState("AI Boom (2022–2025)");
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

        if (dotPanel.length) {
          setDotcom(dotPanel);
          setDotcomCompanies(extractCompanyNames(dotPanel));
        }
        if (purePanel.length) {
          setAiPure(purePanel);
          setAiPureCompanies(extractCompanyNames(purePanel));
        }
        if (broadPanel.length) {
          setAiBroad(broadPanel);
          setAiBroadCompanies(extractCompanyNames(broadPanel));
        }
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
    macroSelectedCols.map((col, i) => {
      const color =
        MACRO_COLOR_MAP[col] || MACRO_COLORS[i % MACRO_COLORS.length];
      return {
        label: col,
        color,
        data: data
          .map((row, idx) => {
            const y = normData[idx]?.[col];
            return y != null
              ? { x: row.Date.getTime(), y, original: row[col] }
              : null;
          })
          .filter(Boolean),
      };
    });

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
    setMacroZoom("Dot-com Bubble (1995–2002)");
    setMacroZoom2("AI Boom (2022–2025)");
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
        bullets: [
      "P/S ratios show clear differences in market behavior over time.",
      "Dot-coms climbed almost vertically, signaling momentum chasing without backing.",
      "Big Tech AI grows steadily, supported by diversified revenue streams.",
      "Pure-play AI rises faster than Big Tech but with more stability than the dot-com peak.",
      "The slope captures how risk appetite shifts across eras."
        ],
      },
      peaks: {
        title: "Peak distributions",
        bullets: [
      "Valuation multiples at peaks vary sharply across eras.",
      "Dot-com companies reached much higher P/S ratios with many outliers, showing bubble behavior.",
      "Big Tech AI is tightly clustered.",
      "Pure-play AI sits between them, elevated but not chaotic.",
      "AI valuations are supported by stronger revenue growth, providing guardrails."
    ],
      },
      scale: {
        title: "Market Cap vs. Revenue",
        bullets: [
      "The pattern separates speculation-driven bubbles from earnings-supported growth.",
      "Dot-com firms are scattered and disconnected from revenue.",
      "Pure-play AI shows a similar scatter pattern.",
      "Big Tech AI aligns closely with revenue, anchored by scale and proven operations.",
      "Overlap between dot-coms and pure-play AI shows moments where valuations run ahead of revenue.",
    ],
      },
      median: {
        title: "Typical peaks",
         bullets: [
      "Median P/S peaks show what investors typically pay per dollar of sales.",
      "Dot-com Peak shows significantly higher median multiples.",
      "Pure-play AI Peak is also highly valued.",
      "Big Tech AI Peak has the lowest median P/S ratio despite massive revenues.",
      "The contrast reflects how smaller, fast-growing firms attract concentrated attention, while diversified firms stay more stable."
    ],
      },
    },
    pe: {
      trend: {
        title: "Heat over time",
        bullets: [
      "P/E ratios track how much investors bet on earnings growth.",
      "Dot-coms stair-stepped upward, chasing potential rather than profits.",
      "Big Tech AI stays stable, grounded in real earnings.",
      "Pure-play AI accelerates sharply in 2024–2025, showing speculative spikes similar to the dot-com era."
    ],
      },
      peaks: {
        title: "Peak distributions",
        bullets: [
      "Peak P/E values show how widely valuations spread at extremes.",
      "Dot-com valuations are moderately spread, typical for speculative periods.",
      "Big Tech AI is tightly clustered.",
      "Pure-play AI spreads widely, signaling uncertainty and disagreement.",
      "Wide distributions show speculative divergence; tight clusters show shared expectations and stability."
    ],
      },
      scale: {
        title: "Share price vs EPS (earnings per share)",
        bullets: [
      "Share price vs earnings reveals how tightly markets price real profits.",
      "Dot-coms cluster lower, with many companies priced on potential, not profit.",
      "Big Tech AI stays tightly aligned with earnings.",
      "Pure-play AI begins near the dot-com slope but jumps later, reflecting optimism for future growth.",
      "Distance from earnings signals moments where enthusiasm overtakes fundamentals."
    ],
      },
      median: {
        title: "Typical peaks",
        bullets: [
      "Median P/E peaks show what investors typically pay for one dollar of earnings.",
      "Dot-com and Pure-play AI have taller bars, with Pure-play AI even surpassing dot-com levels.",
      "Big Tech remains low, showing disciplined valuation.",
      "The contrast shows where investor optimism concentrates, with Pure-play AI leading in extreme valuations."
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
          AI is exploding, valuations are spiking, and everyone’s chasing the next big thing. But history has a way of repeating itself; think back to the dot-com frenzy. Today’s market is a mix of established tech giants and fast-moving pure-play AI startups. The question is: how does this new surge compare to the last era of hype? 
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
          <FinancialTooltip term="P/S">P/S ratio</FinancialTooltip>
        </button>
        <button
          className={`story-btn ${ratioMode === "pe" ? "active" : ""}`}
          onClick={() => {
            setRatioMode("pe");
            setActiveStory("trend");
          }}
        >
          <FinancialTooltip term="P/E">P/E ratio</FinancialTooltip>
        </button>
      </div>

      {/* STORY SECTION (P/S + P/E cohort graphs) */}
      <div className="story-section">
        <div className="section-header">
          <h2>The Data Story</h2>
          <p>Our visualizations explore how valuations differ across Dot-coms, Pure-play AI, and Big Tech AI, using <FinancialTooltip term="P/S">Price-to-Sales (P/S)</FinancialTooltip> and <FinancialTooltip term="P/E">Price-to-Earnings (P/E)</FinancialTooltip> ratios. Each viz highlights a different aspect of market behavior, helping you see where excitement and risk are concentrated today versus the late-1990s bubble.</p>
        </div>

        {/* Company Lists */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "16px",
            marginBottom: "2rem",
          }}
        >
          <CompanyListCard
            title="Dot-com Era Companies"
            companies={dotcomCompanies}
            color={SERIES_COLORS.dotcom.solid}
            enabled={cohortToggles.dotcom}
          />
          <CompanyListCard
            title="Big Tech AI Companies"
            companies={aiPureCompanies}
            color={SERIES_COLORS.bigTech.solid}
            enabled={cohortToggles.aiPure}
          />
          <CompanyListCard
            title="Pure-play AI Companies"
            companies={aiBroadCompanies}
            color={SERIES_COLORS.pureAi.solid}
            enabled={cohortToggles.aiBroad}
          />
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
                  {renderTextWithTooltips(storyContent[ratioMode][k].title)}
                </button>
              ))}
            </div>
            <div className="info-box">
              <div className="info-headline">
                {renderTextWithTooltips(storyContent[ratioMode][activeStory]?.title)}
              </div>
              <p className="info-body">
                {storyContent[ratioMode][activeStory]?.body}
              </p>
              <ul>
                {(storyContent[ratioMode][activeStory]?.bullets || []).map(
                  (b, i) => (
                    <li key={i}>{renderTextWithTooltips(b)}</li>
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
                    yTitle="P/S Distribution"
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
                    label="Median P/S"
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
                "This view shows how each era builds momentum; Dot-coms shot up on hype alone, while AI valuations rise with steadier revenue support."}
              {ratioMode === "pe" &&
                activeStory === "trend" &&
                <>Tracking earnings valuations shows discipline vs. hype; Big Tech stays calm, Pure-play AI ramps quickly, and Dot-coms climbed without earnings to justify it. (<FinancialTooltip term="P/E">P/E</FinancialTooltip> ratios)</>}
              {ratioMode === "ps" &&
                activeStory === "peaks" &&
                "The spread of peak ratios reveals risk levels: Big Tech stays disciplined, Pure-play AI stretches, and Dot-coms blow past reasonable bounds."}
              {ratioMode === "pe" &&
                activeStory === "peaks" &&
                "Tight clusters of peak ratios signal shared expectations; wide spreads signal uncertainty. The Dot-com era shows the widest disagreement, Pure-play AI sits in the middle, and Big Tech is most aligned."}
              {ratioMode === "ps" &&
                activeStory === "scale" &&
                <>Mapping <FinancialTooltip term="Market Cap">market cap</FinancialTooltip> to <FinancialTooltip term="Revenue">revenue</FinancialTooltip> exposes who's earning their price; AI firms generally track fundamentals, while Dot-coms often floated far above them.</>}
              {ratioMode === "pe" &&
                activeStory === "scale" &&
                <>Log scatter of share price vs <FinancialTooltip term="EPS">EPS</FinancialTooltip>: dot-com clusters mid-low, Big Tech sits up-right on stronger earnings, and pure AI rides the dot-com slope before leaping late.</>}
              {ratioMode === "ps" &&
                activeStory === "median" &&
                <>Median <FinancialTooltip term="P/S">P/S</FinancialTooltip> values show the "typical" investor mindset: Big Tech keeps things anchored, while smaller AI and Dot-com firms attract sharper speculative bets.</>}
              {ratioMode === "pe" &&
                activeStory === "median" &&
                <>Median <FinancialTooltip term="P/E">P/E</FinancialTooltip> at peak windows: pure-play AI leads, dot-com trails it, and Big Tech holds mid-30s discipline.</>}
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
            {/* Log scale notes */}
            {(ratioMode === "ps" && activeStory === "trend") && (
              <CollapsibleLogNote>
                <strong>Note:</strong> This chart uses logarithmic scale on the y-axis (log of P/S ratio). Values are log-transformed to better visualize wide ranges of valuation multiples—from single digits to hundreds—on a single chart. Tooltips show the actual P/S ratio values.
              </CollapsibleLogNote>
            )}
            {(ratioMode === "ps" && activeStory === "peaks") && (
              <CollapsibleLogNote>
                <strong>Note:</strong> This chart uses logarithmic scale on the y-axis (log of P/S distribution). Values are log-transformed to better visualize and compare the spread of valuation multiples across different eras, which can range from very low to extremely high values.
              </CollapsibleLogNote>
            )}
            {(ratioMode === "ps" && activeStory === "scale") && (
              <CollapsibleLogNote>
                <strong>Note:</strong> This chart uses logarithmic scale on both axes (log of Revenue and log of Market Cap). Values are log-transformed to better visualize relationships across wide ranges of company sizes—from small startups to tech giants—allowing patterns to emerge that would be hidden on a linear scale.
              </CollapsibleLogNote>
            )}
            {(ratioMode === "pe" && activeStory === "scale") && (
              <CollapsibleLogNote>
                <strong>Note:</strong> This chart uses logarithmic scale on both axes (log of Share price and log of EPS). Values are log-transformed to better visualize relationships between share prices and earnings across wide ranges—from low-priced stocks to high-flyers. Tooltips show actual dollar values.
              </CollapsibleLogNote>
            )}
            {(ratioMode === "ps" && activeStory === "median") && (
              <CollapsibleLogNote>
                <strong>Note:</strong> This chart uses logarithmic scale (log of median P/S). Values are log-transformed to better visualize and compare median valuation multiples across different eras, which helps reveal relative differences when values span multiple orders of magnitude.
              </CollapsibleLogNote>
            )}
          </div>
        </div>
      </div>

      {/* NASDAQ-100 INDEX-LEVEL SECTION (shares metric toggle above) */}
      <div className="story-section">
        <div className="section-header">
          <h2><FinancialTooltip term="NASDAQ-100">Nasdaq-100</FinancialTooltip> Index Valuation Metrics</h2>
          <p>The <FinancialTooltip term="NASDAQ-100">Nasdaq-100</FinancialTooltip> offers a clean view of how markets price growth across eras, making it ideal for comparing the dot-com bubble with today's AI-driven surge. In the late 1990s, valuations routinely stretched far beyond what <FinancialTooltip term="Revenue">revenue</FinancialTooltip> or earnings could justify, as many companies in the index had limited sales and little profit yet traded at extreme multiples. In contrast, the modern AI era shows elevated ratios as well, but they rise alongside massive <FinancialTooltip term="Revenue">revenue</FinancialTooltip> and robust profitability from established tech leaders. The result is a market still shaped by excitement, but far more anchored in real economic performance than during the dot-com peak.</p>
          <p className="section-subtitle">
            Comparing the dot-com bubble (1996–2000) vs the modern AI era
            (2022–2025) using index-level {ratioMode === "ps" ? <FinancialTooltip term="P/S">{metricName}</FinancialTooltip> : <FinancialTooltip term="P/E">{metricName}</FinancialTooltip>} ratios.
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
              Side-by-side view of <FinancialTooltip term="NASDAQ-100">Nasdaq-100</FinancialTooltip> index {ratioMode === "ps" ? <FinancialTooltip term="P/S">{metricName}</FinancialTooltip> : <FinancialTooltip term="P/E">{metricName}</FinancialTooltip>} during the
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

      {/* INDEX CONCENTRATION SECTION */}
      <div className="story-section">
        <div className="section-header">
          <h2>Index Concentration: Top 3 Companies</h2>
        </div>

        <div className="card chart-card">
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.95rem",
              fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid rgba(148, 163, 184, 0.3)",
                  textAlign: "left",
                }}
              >
                <th
                  style={{
                    padding: "12px 16px",
                    color: "#cbd5e1",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Era
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    color: "#cbd5e1",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Top 3 Companies
                </th>
                <th
                  style={{
                    padding: "12px 16px",
                    color: "#cbd5e1",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    textAlign: "right",
                  }}
                >
                  % of Index
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                style={{
                  borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
                }}
              >
                <td
                  style={{
                    padding: "16px",
                    color: SERIES_COLORS.dotcom.solid,
                    fontWeight: 600,
                  }}
                >
                  Dot Com Era (2000)
                </td>
                <td
                  style={{
                    padding: "16px",
                    color: "#e2e8f0",
                  }}
                >
                  Microsoft, Intel, Cisco
                </td>
                <td
                  style={{
                    padding: "16px",
                    color: SERIES_COLORS.dotcom.solid,
                    textAlign: "right",
                    fontFamily: "'Space Mono', ui-monospace, SFMono-Regular, Menlo, Monaco",
                    fontWeight: 600,
                  }}
                >
                  21.5%
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    padding: "16px",
                    color: SERIES_COLORS.bigTech.solid,
                    fontWeight: 600,
                  }}
                >
                  AI Era (2025)
                </td>
                <td
                  style={{
                    padding: "16px",
                    color: "#e2e8f0",
                  }}
                >
                  NVIDIA, Apple, Alphabet
                </td>
                <td
                  style={{
                    padding: "16px",
                    color: SERIES_COLORS.bigTech.solid,
                    textAlign: "right",
                    fontFamily: "'Space Mono', ui-monospace, SFMono-Regular, Menlo, Monaco",
                    fontWeight: 600,
                  }}
                >
                  36.7%
                </td>
              </tr>
            </tbody>
          </table>
          <p
            style={{
              marginTop: "20px",
              padding: "16px",
              color: "#9ca3af",
              fontSize: "0.9rem",
              lineHeight: "1.6",
              borderTop: "1px solid rgba(148, 163, 184, 0.2)",
            }}
          >
            Today's AI era shows higher concentration than the dot-com bubble—the top 3 companies now command over a third of the index. However, these giants have diversified revenue streams and proven earnings, unlike the speculative single-product bets of 2000.
          </p>
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
                ? "Despite volatility, economic fundamentals remain solid. Productivity gains, steady demand, and stable employment support continued expansion. The data suggests normalization rather than deterioration, allowing room for gradual, sustainable growth. Takeaway: Yes, it's true that the stock market growth is outpacing GDP growth, but viewing it in the bigger picture it's not as bad as it seems, and not close to the dot-com bubble.  Unemployment is rising, but still low by historical standards."
                : "Stubborn inflation keeps interest rates high, leaving limited room for policy easing. Elevated borrowing costs can restrict investment and pressure corporate margins. With financial conditions tightening and historical parallels hinting at vulnerability, the risk remains that persistent inflation and high rates could trigger a sharper slowdown. Takeaway: Inflation and rates are still concerning, but not a full-on crisis signal yet. The pressure is real, and it could reflect the past downturns more closely if it lasts longer."}
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
                <DualRangeSlider
                  min={0}
                  max={Math.max(macroRows.length - 1, 0)}
                  values={macroRange}
                  onChange={(nextRange) => {
                    const sorted = [
                      Math.min(nextRange[0], nextRange[1]),
                      Math.max(nextRange[0], nextRange[1]),
                    ];
                    setMacroRange(sorted);
                  }}
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
                  <div style={{ marginBottom: 10 }}>
                    <select
                      value={macroZoom}
                      onChange={(e) => setMacroZoom(e.target.value)}
                      style={ZOOM_SELECT_STYLE}
                    >
                      <option disabled value="">
                        Select Era...
                      </option>
                      {Object.keys(zoomRanges).map((z) => (
                        <option
                          key={z}
                          value={z}
                          style={ZOOM_OPTION_STYLE}
                        >
                          {z}
                        </option>
                      ))}
                      <option
                        value="None"
                        style={ZOOM_OPTION_STYLE}
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
                      style={ZOOM_SELECT_STYLE}
                    >
                      <option disabled value="">
                        Select Era...
                      </option>
                      {Object.keys(zoomRanges).map((z) => (
                        <option
                          key={z}
                          value={z}
                          style={ZOOM_OPTION_STYLE}
                        >
                          {z}
                        </option>
                      ))}
                      <option
                        value="None"
                        style={ZOOM_OPTION_STYLE}
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
