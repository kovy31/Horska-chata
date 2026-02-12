// assets/common.js
const CFG = window.APP_CONFIG;

// ---- utils ----
function formatCzk(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("cs-CZ") + " Kč";
}
function normalizeName(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---- pricing helpers (shared by view + edit) ----
function countPeopleByType(rooms) {
  let total = 0;
  let kids = 0;
  for (const r of rooms || []) {
    const isKidsRoom = r.type === "kids";
    for (const p of (r.people || [])) {
      const n = normalizeName(p);
      if (!n) continue;
      total++;
      if (isKidsRoom) kids++;
    }
  }
  return { total, kids, adults: Math.max(0, total - kids) };
}

/**
 * Pricing rules:
 * - If n <= 10: everyone share = total/10 (minimum)
 * - If 11 <= n <= 14: everyone share = total/n
 * - If n >= 15: kids share = 0.75 * standardShare, adults share = 1.0 * standardShare
 *   where standardShare = total / (adults + 0.75*kids)
 */
function computeShares(totalCzk, nAdults, nKids) {
  const total = Math.round(Number(totalCzk) || 0);
  const n = Math.max(0, nAdults + nKids);

  // minimum "lákací" cena
  if (n <= 10) {
    const per = total / 10;
    return { mode: "min10", standard: per, kids: per, adults: per };
  }

  if (n <= 14) {
    const per = total / n;
    return { mode: "divide", standard: per, kids: per, adults: per };
  }

  // >= 15, kids discount 25%
  const weight = (nAdults + 0.75 * nKids);
  const std = weight > 0 ? (total / weight) : 0;
  return { mode: "kids25", standard: std, kids: 0.75 * std, adults: std };
}

function roundCzk(x) {
  return Math.round(Number(x) || 0);
}

/**
 * Effective price for all calculations:
 * - If actualCzk is set (chata zaplacena), use it
 * - Otherwise use totalCzk * 1.05 (5% navýšení pro kurzový rozdíl)
 */
function effectivePrice(data) {
  const actual = Number(data.actualCzk);
  if (Number.isFinite(actual) && actual > 0) {
    return { price: Math.round(actual), isEstimate: false };
  }
  const base = Math.round(Number(data.totalCzk) || 0);
  return { price: Math.round(base * 1.05), isEstimate: true };
}

// ---- data model ----
function defaultData() {
  return {
    version: 8,
    airNote: "",
    banner: "",        // text banneru nad pokoji (např. "Pro rezervaci chaty...")
    bannerVisible: false, // zobrazit banner na hlavní stránce?
    mapAddress: "",    // adresa pro Google Maps embed
    mapZoom: 14,       // zoom úroveň pro Google Maps (3-18)
    mapNote: "",       // editovatelný text pod mapou (adresa ubytování apod.)
    totalCzk: CFG.DEFAULT_TOTAL_CZK,
    actualCzk: 0,  // skutečná cena po zaplacení chaty (0 = neznámá)
    paymentAccount: "",
    rooms: [
      { id: "R1", type: "double", name: "Pokoj 1", people: ["", ""] },
      { id: "R2", type: "double", name: "Pokoj 2", people: ["", ""] },
      { id: "R3", type: "double", name: "Pokoj 3", people: ["", ""] },
      { id: "R4", type: "double", name: "Pokoj 4", people: ["", ""] },
      { id: "R5", type: "double", name: "Pokoj 5", people: ["", ""] },
      { id: "R6", type: "double", name: "Pokoj 6", people: ["", ""] },
      { id: "R7", type: "double", name: "Pokoj 7", people: ["", ""] },
      { id: "K1", type: "kids",   name: "Dětský pokoj", people: ["", "", "", ""] }
    ],
    unassigned: [], // names parked outside rooms
    people: {} // { name: { payments:[{amount,date}], refunds:[{amount,date}] } }
  };
}

// ---- GitHub Issue storage ----
const DATA_START = "<!--DATA_START-->";
const DATA_END   = "<!--DATA_END-->";

function buildIssueBody(jsonString) {
  return [
    "Tento Issue slouží jako databáze pro přehled ubytování + finance.",
    "",
    DATA_START,
    jsonString,
    DATA_END,
    ""
  ].join("\n");
}

function extractJsonFromIssueBody(body) {
  if (!body) return null;
  const s = body.indexOf(DATA_START);
  const e = body.indexOf(DATA_END);
  if (s === -1 || e === -1 || e <= s) return null;
  const jsonText = body.slice(s + DATA_START.length, e).trim();

  return jsonText || null;
}

function parseGitHubErrorText(text) {
  if (!text) return "";
  try {
    const parsed = JSON.parse(text);
    const main = parsed?.message ? String(parsed.message) : "";
    const errs = Array.isArray(parsed?.errors)
      ? parsed.errors
          .map((e) => {
            if (typeof e === "string") return e;
            if (e && typeof e === "object") {
              const parts = [e.code, e.field, e.resource].filter(Boolean);
              return parts.join(" / ");
            }
            return "";
          })
          .filter(Boolean)
          .join("; ")
      : "";
    return [main, errs].filter(Boolean).join(" | ");
  } catch {
    return String(text).trim();
  }
}

function explainGitHubApiError(status, detail) {
  const d = detail ? ` Detaily: ${detail}` : "";
  if (status === 401) {
    return "Token je neplatny nebo expirovany. Vytvor novy Fine-grained PAT a vloz ho znovu." + d;
  }
  if (status === 403) {
    return "Token nema prava pro zapis do Issues. Zkontroluj repository permissions: Issues (Read and write)." + d;
  }
  if (status === 404) {
    return "Repo nebo API endpoint nebyl nalezen. Zkontroluj OWNER/REPO v assets/config.js a ze token ma pristup k tomuto repozitari." + d;
  }
  return `GitHub API vratilo chybu ${status}.${d}`;
}

async function ghFetch(path, opts = {}) {
  const url = `https://api.github.com${path}`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      ...(opts.token ? { "Authorization": `Bearer ${opts.token}` } : {})
    },
    method: opts.method || "GET",
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const detail = parseGitHubErrorText(text || res.statusText);
    const err = new Error(explainGitHubApiError(res.status, detail));
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return res.json();
}

async function loadDataFromGitHub(token = "") {
  const auth = token ? { token } : {};
  const issues = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues?state=all&per_page=100`, auth);
  const found = issues.find(i => (i.title || "") === CFG.ISSUE_TITLE);
  if (!found) return defaultData();

  // Prefer issue body from list response to avoid extra API calls.
  let jsonText = extractJsonFromIssueBody(found.body || "");
  if (!jsonText && found.number) {
    const issue = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues/${found.number}`, auth);
    jsonText = extractJsonFromIssueBody(issue.body);
  }
  if (!jsonText) return defaultData();

  try {
    return sanitizeData(JSON.parse(jsonText));
  } catch {
    return defaultData();
  }
}

async function saveDataToGitHub(data, token) {
  const issues = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues?state=all&per_page=100`, { token });
  let found = issues.find(i => (i.title || "") === CFG.ISSUE_TITLE);

  const jsonString = JSON.stringify(data, null, 2);
  const body = buildIssueBody(jsonString);

  if (!found) {
    const created = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues`, {
      token,
      method: "POST",
      body: { title: CFG.ISSUE_TITLE, body }
    });
    found = created;
  } else {
    await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues/${found.number}`, {
      token,
      method: "PATCH",
      body: { body }
    });
  }
}

function sanitizeEntryList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const it of list) {
    if (!it || typeof it !== "object") continue;
    const a = Math.round(Number(it.amount) || 0);
    const d = typeof it.date === "string" ? it.date.trim() : "";
    if (a > 0) out.push({ amount: a, date: d || todayISO() });
  }
  return out;
}

function sanitizeData(data) {
  const d = defaultData();
  if (!data || typeof data !== "object") return d;

  const total = Number(data.totalCzk);
  d.totalCzk = Number.isFinite(total) && total > 0 ? Math.round(total) : d.totalCzk;

  const actualCzk = Number(data.actualCzk);
  d.actualCzk = Number.isFinite(actualCzk) && actualCzk > 0 ? Math.round(actualCzk) : 0;

  d.paymentAccount = typeof data.paymentAccount === "string" ? data.paymentAccount.trim() : "";
  d.airNote = typeof data.airNote === "string" ? data.airNote.trim() : "";
  d.banner = typeof data.banner === "string" ? data.banner.trim() : "";
  d.bannerVisible = !!data.bannerVisible;
  d.mapAddress = typeof data.mapAddress === "string" ? data.mapAddress.trim() : "";
  d.mapNote = typeof data.mapNote === "string" ? data.mapNote.trim() : "";
  const mz = Number(data.mapZoom);
  d.mapZoom = Number.isFinite(mz) && mz >= 3 && mz <= 18 ? Math.round(mz) : 14;

  if (Array.isArray(data.unassigned)) {
    d.unassigned = data.unassigned
      .map(x => normalizeName(typeof x === "string" ? x : ""))
      .filter(Boolean);
  }

  if (Array.isArray(data.rooms)) {
    const map = new Map(d.rooms.map(r => [r.id, r]));
    for (const r of data.rooms) {
      if (!r || typeof r !== "object") continue;
      const base = map.get(r.id);
      if (!base) continue;
      base.name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : base.name;
      if (Array.isArray(r.people)) {
        base.people = base.people.map((_, idx) => normalizeName(r.people[idx] || ""));
      }
    }
  }

  if (data.people && typeof data.people === "object") {
    d.people = {};
    for (const [nameRaw, rec] of Object.entries(data.people)) {
      const name = normalizeName(nameRaw);
      if (!name) continue;
      d.people[name] = {
        payments: sanitizeEntryList(rec?.payments),
        refunds: sanitizeEntryList(rec?.refunds),
      };
    }
  }

  return d;
}
