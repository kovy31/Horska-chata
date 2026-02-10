// assets/common.js
const CFG = window.APP_CONFIG;

function formatCzk(n) {
  const v = Math.round(n);
  return v.toLocaleString("cs-CZ") + " Kč";
}

function normalizeName(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

function defaultData() {
  return {
    version: 1,
    totalCzk: CFG.DEFAULT_TOTAL_CZK,
    kidsDiscount: CFG.KIDS_DISCOUNT,
    rooms: [
      { id: "R1", type: "double", name: "Pokoj 1", people: ["", ""] },
      { id: "R2", type: "double", name: "Pokoj 2", people: ["", ""] },
      { id: "R3", type: "double", name: "Pokoj 3", people: ["", ""] },
      { id: "R4", type: "double", name: "Pokoj 4", people: ["", ""] },
      { id: "R5", type: "double", name: "Pokoj 5", people: ["", ""] },
      { id: "R6", type: "double", name: "Pokoj 6", people: ["", ""] },
      { id: "R7", type: "double", name: "Pokoj 7", people: ["", ""] },
      { id: "K1", type: "kids",   name: "Dětský pokoj", people: ["", "", "", ""] }
    ]
  };
}

// ---- GitHub Issue storage ----
const DATA_START = "<!--DATA_START-->";
const DATA_END   = "<!--DATA_END-->";

function buildIssueBody(jsonString) {
  return [
    "Tento Issue slouží jako databáze pro rezervační kalkulačku.",
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
    throw new Error(`GitHub API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

async function findOrCreateIssueNumber(token) {
  // Find issue by title
  const issues = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues?state=all&per_page=100`);
  const found = issues.find(i => (i.title || "") === CFG.ISSUE_TITLE);
  if (found) return found.number;

  // Create if not found (needs token)
  if (!token) throw new Error("Issue neexistuje a chybí token pro vytvoření.");
  const created = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues`, {
    method: "POST",
    token,
    body: { title: CFG.ISSUE_TITLE, body: buildIssueBody(JSON.stringify(defaultData(), null, 2)) }
  });
  return created.number;
}

async function loadDataFromGitHub() {
  // Read-only: search issues, then read single issue
  const issues = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues?state=all&per_page=100`);
  const found = issues.find(i => (i.title || "") === CFG.ISSUE_TITLE);
  if (!found) return defaultData();

  const issue = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues/${found.number}`);
  const jsonText = extractJsonFromIssueBody(issue.body);
  if (!jsonText) return defaultData();

  try {
    const data = JSON.parse(jsonText);
    return sanitizeData(data);
  } catch {
    return defaultData();
  }
}

function sanitizeData(data) {
  const d = defaultData();
  if (!data || typeof data !== "object") return d;
  const totalCzk = Number(data.totalCzk);
  d.totalCzk = Number.isFinite(totalCzk) && totalCzk > 0 ? totalCzk : d.totalCzk;

  const kidsDiscount = Number(data.kidsDiscount);
  d.kidsDiscount = Number.isFinite(kidsDiscount) && kidsDiscount > 0 && kidsDiscount <= 1 ? kidsDiscount : d.kidsDiscount;

  if (Array.isArray(data.rooms)) {
    // map by id
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
  return d;
}

async function saveDataToGitHub(data, token) {
  const issueNumber = await findOrCreateIssueNumber(token);
  const jsonString = JSON.stringify(data, null, 2);
  await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues/${issueNumber}`, {
    method: "PATCH",
    token,
    body: { body: buildIssueBody(jsonString) }
  });
}

// ---- Pricing ----
function computePayments(data) {
  const peopleEntries = []; // { name, roomId, roomName, weight }
  const kidsWeight = data.kidsDiscount;
  for (const room of data.rooms) {
    const weight = room.type === "kids" ? kidsWeight : 1.0;
    for (const raw of room.people) {
      const name = normalizeName(raw);
      if (!name) continue;
      peopleEntries.push({ name, roomId: room.id, roomName: room.name, weight });
    }
  }

  const sumWeights = peopleEntries.reduce((a, p) => a + p.weight, 0);
  if (peopleEntries.length === 0 || sumWeights <= 0) {
    return { unit: 0, rows: [], totalRounded: 0, remainderFix: 0 };
  }

  const unit = data.totalCzk / sumWeights;

  // Round to whole CZK and fix last person to match total exactly
  const rows = peopleEntries.map(p => ({
    ...p,
    raw: unit * p.weight,
    pay: Math.round(unit * p.weight)
  }));

  const totalRounded = rows.reduce((a, r) => a + r.pay, 0);
  const diff = Math.round(data.totalCzk - totalRounded); // can be negative/positive
  if (diff !== 0) rows[rows.length - 1].pay += diff;

  return { unit, rows, totalRounded: rows.reduce((a, r) => a + r.pay, 0), remainderFix: diff };
}
