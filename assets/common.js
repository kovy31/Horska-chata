// assets/common.js
const CFG = window.APP_CONFIG;

function formatCzk(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("cs-CZ") + " Kč";
}

function normalizeName(s) {
  return (s || "").trim().replace(/\s+/g, " ");
}

function defaultData() {
  return {
    version: 3,
    totalCzk: CFG.DEFAULT_TOTAL_CZK,
    kidsDiscount: CFG.KIDS_DISCOUNT, // 0.75 = sleva 25 %
    paymentAccount: "",              // např. "123456789/0100"
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
    // payments keyed by person name (exact string)
    payments: {}
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
  const issues = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues?state=all&per_page=100`);
  const found = issues.find(i => (i.title || "") === CFG.ISSUE_TITLE);
  if (found) return found.number;

  if (!token) throw new Error("Issue neexistuje a chybí token pro vytvoření.");
  const created = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues`, {
    method: "POST",
    token,
    body: { title: CFG.ISSUE_TITLE, body: buildIssueBody(JSON.stringify(defaultData(), null, 2)) }
  });
  return created.number;
}

async function loadDataFromGitHub() {
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
  d.totalCzk = Number.isFinite(totalCzk) && totalCzk > 0 ? Math.round(totalCzk) : d.totalCzk;

  const kidsDiscount = Number(data.kidsDiscount);
  d.kidsDiscount = Number.isFinite(kidsDiscount) && kidsDiscount > 0 && kidsDiscount <= 1 ? kidsDiscount : d.kidsDiscount;

  d.paymentAccount = typeof data.paymentAccount === "string" ? data.paymentAccount.trim() : "";

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

  if (data.payments && typeof data.payments === "object") {
    d.payments = {};
    for (const [name, rec] of Object.entries(data.payments)) {
      const n = normalizeName(name);
      if (!n) continue;
      const paidCzk = Number(rec?.paidCzk);
      const isPaid = Boolean(rec?.isPaid);
      d.payments[n] = {
        paidCzk: Number.isFinite(paidCzk) && paidCzk >= 0 ? Math.round(paidCzk) : 0,
        isPaid
      };
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

// ---- Pricing core (internal weights, user-facing = sleva 25 %) ----
function computePayments(data) {
  const peopleEntries = []; // { name, roomId, roomName, weight }
  const kidsWeight = data.kidsDiscount; // 0.75
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

  const rows = peopleEntries.map(p => ({
    ...p,
    pay: Math.round(unit * p.weight)
  }));

  const totalRounded = rows.reduce((a, r) => a + r.pay, 0);
  const diff = Math.round(data.totalCzk - totalRounded);
  if (diff !== 0) rows[rows.length - 1].pay += diff;

  return { unit, rows, totalRounded: rows.reduce((a, r) => a + r.pay, 0), remainderFix: diff };
}

function computeFinanceLedger(data) {
  const payments = computePayments(data);

  const dueByName = new Map();
  const roomByName = new Map();
  const isKidsByName = new Map();

  for (const r of payments.rows) {
    dueByName.set(r.name, (dueByName.get(r.name) || 0) + r.pay);
    if (!roomByName.has(r.name)) roomByName.set(r.name, r.roomName);
    if (!isKidsByName.has(r.name)) isKidsByName.set(r.name, r.weight < 1);
  }

  const names = Array.from(dueByName.keys()).sort((a, b) => a.localeCompare(b, "cs"));

  const rows = names.map(name => {
    const due = dueByName.get(name) || 0;
    const rec = data.payments?.[name] || { paidCzk: 0, isPaid: false };
    const paid = Math.round(Number(rec.paidCzk) || 0);
    const delta = paid - due;
    return {
      name,
      roomName: roomByName.get(name) || "",
      due,
      paid,
      remaining: delta < 0 ? -delta : 0,
      refund: delta > 0 ? delta : 0,
      isKids: Boolean(isKidsByName.get(name)),
      isPaid: Boolean(rec.isPaid)
    };
  });

  const totalPaid = rows.reduce((a, r) => a + r.paid, 0);
  const totalDue = payments.totalRounded;
  const overallDelta = totalPaid - totalDue;

  return {
    unit: payments.unit,
    totalDue,
    totalPaid,
    remainingToCollect: overallDelta < 0 ? -overallDelta : 0,
    refundTotal: overallDelta > 0 ? overallDelta : 0,
    rows
  };
}
