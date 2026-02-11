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
    version: 6,
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

// ---- participants order ----
function listParticipantsInOrder(data) {
  const ordered = [];
  for (const room of data.rooms) {
    for (const pRaw of room.people) {
      const name = normalizeName(pRaw);
      if (!name) continue;
      ordered.push({ name, roomId: room.id, roomName: room.name });
    }
  }
  const seen = new Set();
  const uniq = [];
  for (const x of ordered) {
    if (seen.has(x.name)) continue;
    seen.add(x.name);
    uniq.push(x);
  }
  return uniq;
}

// ---- core pricing rule ----
// - first 14 people (in order) are FULL (weight 1.00)
// - people 15+ are KID (weight 0.75)
// - divisor = max(10, fullCount + 0.75*kidCount)
//
// IMPORTANT FIX:
// If participants < 10, we DO NOT force-sum to totalCzk by "dumping" difference into last person.
// Instead: everyone pays the same (rounded) unit, and "missing amount" stays as remaining need.
function computeDueSplit(data) {
  const people = listParticipantsInOrder(data);

  const rows0 = people.map((p, idx) => {
    const isKid = idx >= 14;
    const weight = isKid ? 0.75 : 1.0;
    return { ...p, idx, weight, isKid };
  });

  const fullCount = rows0.filter(r => !r.isKid).length;
  const kidCount = rows0.filter(r => r.isKid).length;

  const weightedCount = fullCount + 0.75 * kidCount;
  const divisor = Math.max(10, weightedCount);

  if (rows0.length === 0) {
    return { divisor, unitFull: 0, unitKid: 0, rows: [], totalAssigned: 0, missingBecauseNotEnoughPeople: data.totalCzk };
  }

  const unitFull = data.totalCzk / divisor;
  const unitKid = unitFull * 0.75;

  const rows = rows0.map(r => ({
    ...r,
    due: Math.round(unitFull * r.weight)
  }));

  const totalAssigned = rows.reduce((a, r) => a + r.due, 0);

  // Only when divisor == weightedCount (meaning we have >=10 in weighted sense) we fix rounding to match total.
  // When divisor is forced to 10 (not enough people), we do NOT fix.
  const forcedMinTen = weightedCount < 10;

  if (!forcedMinTen) {
    const diff = Math.round(data.totalCzk - totalAssigned);
    if (diff !== 0) rows[rows.length - 1].due += diff;
  }

  const assigned2 = rows.reduce((a, r) => a + r.due, 0);
  const missingBecauseNotEnoughPeople = forcedMinTen ? Math.max(0, data.totalCzk - assigned2) : 0;

  return { divisor, unitFull, unitKid, rows, totalAssigned: assigned2, missingBecauseNotEnoughPeople };
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

// ---- Ledger ----
function computeFinanceLedger(data) {
  const split = computeDueSplit(data);

  const names = split.rows.map(r => r.name);
  const dueByName = new Map(split.rows.map(r => [r.name, r.due]));
  const roomByName = new Map(split.rows.map(r => [r.name, r.roomName]));
  const isKidByName = new Map(split.rows.map(r => [r.name, r.isKid]));

  // base rows (paid/refunded history)
  const rows = names.map(name => {
    const rec = data.people?.[name] || { payments: [], refunds: [] };

    const payments = Array.isArray(rec.payments) ? rec.payments : [];
    const refunds  = Array.isArray(rec.refunds) ? rec.refunds : [];

    const paid = sumEntries(payments);
    const refunded = sumEntries(refunds);
    const netPaid = paid - refunded;

    const due = dueByName.get(name) || 0;

    const over = Math.max(0, netPaid - due);
    const under = Math.max(0, due - netPaid);

    return {
      name,
      roomName: roomByName.get(name) || "",
      isKid: Boolean(isKidByName.get(name)),
      due,
      paid,
      refunded,
      netPaid,
      overpay: over,
      underpay: under,

      // ✅ TOHLE edit.js potřebuje:
      remainingToPay: under,      // kolik má ještě doplatit
      suggestedRefund: 0,         // návrh vratky (doplníme níže)

      // historie pro "i" modaly
      payments,
      refunds,
    };
  });

  const totalPaid = rows.reduce((a, r) => a + r.paid, 0);
  const totalRefunded = rows.reduce((a, r) => a + r.refunded, 0);
  const cashOnHand = totalPaid - totalRefunded;

  // Need/surplus always compared to real totalCzk
  const surplus = Math.max(0, cashOnHand - data.totalCzk);
  const need = Math.max(0, data.totalCzk - cashOnHand);

  // ---------- Suggested refunds (AUTO) ----------
  // Vrací se jen těm, kdo už mají přeplatek (netPaid > due).
  // Pokud existuje přebytek, rozdělí se proporčně dle přeplatku.
  const overRows = rows.filter(r => r.overpay > 0);
  const totalOver = overRows.reduce((a, r) => a + r.overpay, 0);

  const pool = Math.min(surplus, totalOver);

  if (pool > 0 && totalOver > 0) {
    // Largest remainder method -> součet přesně = pool (v Kč)
    const parts = overRows.map(r => {
      const raw = (pool * r.overpay) / totalOver;
      const base = Math.floor(raw);
      return { name: r.name, base, frac: raw - base, cap: r.overpay };
    });

    let assigned = parts.reduce((a, p) => a + p.base, 0);
    let leftover = pool - assigned;

    parts.sort((a, b) => b.frac - a.frac);

    for (let i = 0; i < parts.length && leftover > 0; i++) {
      const p = parts[i];
      if (p.base < p.cap) { // nikdy nepřesáhnout přeplatek
        p.base += 1;
        leftover -= 1;
      }
    }

    const byName = new Map(parts.map(p => [p.name, Math.min(p.base, p.cap)]));
    for (const r of rows) r.suggestedRefund = byName.get(r.name) || 0;
  }

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
