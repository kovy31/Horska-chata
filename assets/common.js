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
function clampInt(n, min, max) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

// ---- data model ----
function defaultData() {
  return {
    version: 5,
    totalCzk: CFG.DEFAULT_TOTAL_CZK,
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
    // ledger keyed by name:
    // people: { "Jan Novak": { payments:[{amount:1234,date:"2026-02-11"}], refunds:[{amount:500,date:"2026-03-01"}] } }
    people: {}
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

function sanitizeEntryList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(x => ({
      amount: clampInt(x?.amount ?? 0, 0, 1_000_000_000),
      date: typeof x?.date === "string" ? x.date.trim() : ""
    }))
    .filter(x => x.amount > 0);
}

// Backward compatibility for older models:
function migrateOldPayments(data, out) {
  // v3: payments[name]={paidCzk,isPaid}
  if (data?.payments && typeof data.payments === "object") {
    for (const [nameRaw, rec] of Object.entries(data.payments)) {
      const name = normalizeName(nameRaw);
      if (!name) continue;
      const paid = clampInt(rec?.paidCzk ?? 0, 0, 1_000_000_000);
      if (paid <= 0) continue;
      if (!out.people[name]) out.people[name] = { payments: [], refunds: [] };
      out.people[name].payments.push({ amount: paid, date: "" });
    }
  }
}

function sanitizeData(data) {
  const d = defaultData();
  if (!data || typeof data !== "object") return d;

  const total = Number(data.totalCzk);
  d.totalCzk = Number.isFinite(total) && total > 0 ? Math.round(total) : d.totalCzk;

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

  // people ledger
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
  } else {
    d.people = {};
  }

  migrateOldPayments(data, d);

  return d;
}

async function loadDataFromGitHub() {
  const issues = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues?state=all&per_page=100`);
  const found = issues.find(i => (i.title || "") === CFG.ISSUE_TITLE);
  if (!found) return defaultData();

  const issue = await ghFetch(`/repos/${CFG.OWNER}/${CFG.REPO}/issues/${found.number}`);
  const jsonText = extractJsonFromIssueBody(issue.body);
  if (!jsonText) return defaultData();

  try {
    return sanitizeData(JSON.parse(jsonText));
  } catch {
    return defaultData();
  }
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

// ---- Participants ordering & weights ----
// Rule:
// - first 14 people (in order) are FULL weight 1.00 (no discount)
// - people 15+ are KID weight 0.75 (discount 25%)
// - divisor = max(10, fullCount + 0.75*kidCount)
function listParticipantsInOrder(data) {
  // order: all doubles R1..R7 then kids room K1 (already that order in data.rooms)
  const ordered = [];
  for (const room of data.rooms) {
    for (const pRaw of room.people) {
      const name = normalizeName(pRaw);
      if (!name) continue;
      ordered.push({ name, roomId: room.id, roomName: room.name });
    }
  }
  // keep first occurrence of a name only (avoid duplicates)
  const seen = new Set();
  const uniq = [];
  for (const x of ordered) {
    if (seen.has(x.name)) continue;
    seen.add(x.name);
    uniq.push(x);
  }
  return uniq;
}

function computeDueSplit(data) {
  const people = listParticipantsInOrder(data);
  const n = people.length;

  // mark weights
  const rows = people.map((p, idx) => {
    const isKid = idx >= 14; // 15th+ person
    const weight = isKid ? 0.75 : 1.0;
    return { ...p, idx, weight, isKid };
  });

  const fullCount = rows.filter(r => !r.isKid).length;
  const kidCount = rows.filter(r => r.isKid).length;

  const divisor = Math.max(10, fullCount + 0.75 * kidCount);
  if (rows.length === 0) {
    return { divisor, unitFull: 0, unitKid: 0, rows: [], totalDue: 0 };
  }

  const unitFull = data.totalCzk / divisor;
  const unitKid = unitFull * 0.75;

  // round per person, then fix last person to match exactly totalCzk
  const dueRows = rows.map(r => {
    const raw = unitFull * r.weight;
    return { ...r, due: Math.round(raw) };
  });

  const sum = dueRows.reduce((a, r) => a + r.due, 0);
  const diff = Math.round(data.totalCzk - sum);
  if (diff !== 0) dueRows[dueRows.length - 1].due += diff;

  const totalDue = dueRows.reduce((a, r) => a + r.due, 0);

  return {
    divisor,
    unitFull,
    unitKid,
    rows: dueRows,
    totalDue
  };
}

function sumEntries(list) {
  if (!Array.isArray(list)) return 0;
  return list.reduce((a, x) => a + (Number(x?.amount) || 0), 0);
}

function ensurePersonRecord(data, name) {
  if (!data.people) data.people = {};
  if (!data.people[name]) data.people[name] = { payments: [], refunds: [] };
  return data.people[name];
}

// ---- Finance ledger with suggested refunds (rule: refund only if person paid & only if surplus exists) ----
function computeFinanceLedger(data) {
  const split = computeDueSplit(data);
  const dueByName = new Map(split.rows.map(r => [r.name, r.due]));
  const roomByName = new Map(split.rows.map(r => [r.name, r.roomName]));
  const isKidByName = new Map(split.rows.map(r => [r.name, r.isKid]));

  const names = split.rows.map(r => r.name);

  // totals paid/refunded per person
  const personRows = names.map(name => {
    const rec = data.people?.[name] || { payments: [], refunds: [] };
    const paid = sumEntries(rec.payments);
    const refunded = sumEntries(rec.refunds);
    const netPaid = paid - refunded;
    const due = dueByName.get(name) || 0;

    return {
      name,
      roomName: roomByName.get(name) || "",
      isKid: Boolean(isKidByName.get(name)),
      due,
      paid,
      refunded,
      netPaid,
      // provisional:
      remainingToPay: Math.max(0, due - netPaid),
      overpay: Math.max(0, netPaid - due),
      payments: rec.payments || [],
      refunds: rec.refunds || []
    };
  });

  const totalPaid = personRows.reduce((a, r) => a + r.paid, 0);
  const totalRefunded = personRows.reduce((a, r) => a + r.refunded, 0);
  const cashOnHand = totalPaid - totalRefunded;
  const surplus = Math.max(0, cashOnHand - data.totalCzk);
  const need = Math.max(0, data.totalCzk - cashOnHand);

  // suggested refunds:
  // only among people who already paid (paid>0) and have overpay>0
  const candidates = personRows.filter(r => r.paid > 0 && r.overpay > 0);
  const totalOverpay = candidates.reduce((a, r) => a + r.overpay, 0);

  const suggestions = new Map();
  if (surplus > 0 && totalOverpay > 0) {
    // proportional allocation, then rounding fix
    let allocated = 0;
    for (const r of candidates) {
      const share = surplus * (r.overpay / totalOverpay);
      const sug = Math.min(r.overpay, Math.floor(share + 0.5));
      suggestions.set(r.name, sug);
      allocated += sug;
    }
    // fix rounding difference by adjusting largest overpay first
    let diff = surplus - allocated;
    if (diff !== 0) {
      const sorted = [...candidates].sort((a, b) => b.overpay - a.overpay);
      let i = 0;
      while (diff !== 0 && sorted.length) {
        const n = sorted[i % sorted.length].name;
        const cur = suggestions.get(n) || 0;
        const cap = (candidates.find(x => x.name === n)?.overpay || 0);
        if (diff > 0 && cur < cap) { suggestions.set(n, cur + 1); diff--; }
        else if (diff < 0 && cur > 0) { suggestions.set(n, cur - 1); diff++; }
        i++;
        if (i > 100000) break;
      }
    }
  }

  // attach suggestedRefund and updated view of "balance" text
  const rows = personRows.map(r => {
    const suggestedRefund = suggestions.get(r.name) || 0;
    const balanceText =
      r.remainingToPay > 0 ? `Doplatit ${formatCzk(r.remainingToPay)}`
      : (suggestedRefund > 0 ? `Vrátit ${formatCzk(suggestedRefund)}`
      : "Srovnáno");

    return { ...r, suggestedRefund, balanceText };
  });

  return {
    split,
    totalPaid,
    totalRefunded,
    cashOnHand,
    surplus,
    need,
    rows
  };
}
