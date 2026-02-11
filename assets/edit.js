// assets/edit.js
const editGrid = document.getElementById("editGrid");
const btnLoad = document.getElementById("btnLoad");
const btnSave = document.getElementById("btnSave");

const inpTotal = document.getElementById("inpTotal");
const inpKids = document.getElementById("inpKids");
const inpAccount = document.getElementById("inpAccount");
const inpToken = document.getElementById("inpToken");

const payEditBody = document.querySelector("#payEditTable tbody");
const payEmpty = document.getElementById("payEmpty");

const kpiPaid = document.getElementById("kpiPaid");
const kpiNeed = document.getElementById("kpiNeed");
const kpiRefund = document.getElementById("kpiRefund");

let state = defaultData();

// --- helpers ---
function ensurePaymentRecord(name) {
  if (!state.payments) state.payments = {};
  if (!state.payments[name]) state.payments[name] = { paidCzk: 0, isPaid: false };
}

function migratePaymentRecord(oldName, newName) {
  oldName = normalizeName(oldName);
  newName = normalizeName(newName);
  if (!oldName || !newName || oldName === newName) return;
  if (!state.payments) state.payments = {};

  if (state.payments[oldName]) {
    if (!state.payments[newName]) state.payments[newName] = state.payments[oldName];
    delete state.payments[oldName];
  }
}

// --- rooms editor ---
function renderRoomsEditor(data) {
  editGrid.innerHTML = "";

  for (const room of data.rooms) {
    const card = document.createElement("div");
    card.className = "card";

    const fields = room.people.map((val, idx) => {
      return `
        <div class="fieldRow">
          <label class="label">${idx + 1}. osoba</label>
          <input data-room="${room.id}" data-idx="${idx}" value="${(val || "").replace(/"/g,'&quot;')}" placeholder="Jméno" />
        </div>
      `;
    }).join("");

    const isKids = room.type === "kids";
    card.innerHTML = `
      <div class="roomHead">
        <div>
          <h2>${room.name}</h2>
          <div class="subSmall">${isKids ? "Dětský pokoj · sleva 25 %" : "Pokoj s manželskou postelí"}</div>
        </div>
        <div class="subSmall">${room.people.length} místa</div>
      </div>
      ${fields}
    `;

    editGrid.appendChild(card);
  }

  editGrid.querySelectorAll("input[data-room]").forEach(inp => {
    inp.addEventListener("focus", (e) => {
      e.target.dataset.prev = e.target.value;
    });

    inp.addEventListener("input", (e) => {
      const roomId = e.target.getAttribute("data-room");
      const idx = Number(e.target.getAttribute("data-idx"));
      const room = state.rooms.find(r => r.id === roomId);

      const prev = e.target.dataset.prev || "";
      const next = normalizeName(e.target.value);

      room.people[idx] = next;
      migratePaymentRecord(prev, next);
      e.target.dataset.prev = next;

      // full re-render is OK here (names changed)
      renderPaymentsPanel();
    });
  });
}

// --- KPIs only (no re-render table) ---
function renderPaymentKpis() {
  const ledger = computeFinanceLedger(state);
  kpiPaid.textContent = formatCzk(ledger.totalPaid);
  kpiNeed.textContent = formatCzk(ledger.remainingToCollect);
  kpiRefund.textContent = formatCzk(ledger.refundTotal);

  // Also update status texts in existing rows (if present)
  ledger.rows.forEach(r => {
    const statusEl = payEditBody.querySelector(`[data-status="${cssEscape(r.name)}"]`);
    if (!statusEl) return;

    const statusText = r.refund > 0
      ? `Vrátit ${formatCzk(r.refund)}`
      : r.remaining > 0
        ? `Doplatit ${formatCzk(r.remaining)}`
        : "Srovnáno";

    statusEl.textContent = statusText;
  });
}

// CSS escape for dataset selectors
function cssEscape(s) {
  return String(s).replace(/["\\]/g, "\\$&");
}

// --- payments panel (FULL render table) ---
function renderPaymentsPanel() {
  const total = Number(inpTotal.value);
  const kids = Number(inpKids.value);

  if (Number.isFinite(total) && total > 0) state.totalCzk = Math.round(total);
  if (Number.isFinite(kids) && kids > 0 && kids <= 1) state.kidsDiscount = kids;

  state.paymentAccount = (inpAccount.value || "").trim();

  const ledger = computeFinanceLedger(state);

  kpiPaid.textContent = formatCzk(ledger.totalPaid);
  kpiNeed.textContent = formatCzk(ledger.remainingToCollect);
  kpiRefund.textContent = formatCzk(ledger.refundTotal);

  payEditBody.innerHTML = "";

  if (ledger.rows.length === 0) {
    payEmpty.style.display = "block";
    return;
  }
  payEmpty.style.display = "none";

  for (const r of ledger.rows) {
    ensurePaymentRecord(r.name);
    const rec = state.payments[r.name];

    // auto isPaid
    rec.isPaid = (Number(rec.paidCzk) || 0) >= r.due && r.due > 0;

    const statusText = r.refund > 0
      ? `Vrátit ${formatCzk(r.refund)}`
      : r.remaining > 0
        ? `Doplatit ${formatCzk(r.remaining)}`
        : "Srovnáno";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${r.name}</strong></td>
      <td>${r.roomName}${r.isKids ? " · sleva 25 %" : ""}</td>
      <td><strong>${formatCzk(r.due)}</strong></td>
      <td>
        <input class="paidInput" type="number" min="0" step="1"
          data-paidinp="${r.name.replace(/"/g,'&quot;')}"
          value="${String(Math.round(Number(rec.paidCzk) || 0))}" />
      </td>
      <td><span data-status="${r.name.replace(/"/g,'&quot;')}">${statusText}</span></td>
    `;
    payEditBody.appendChild(tr);

    // IMPORTANT: do NOT re-render whole table on every keystroke
    const inp = tr.querySelector(`input[data-paidinp]`);
    inp.addEventListener("input", () => {
      const v = Number(inp.value);
      rec.paidCzk = Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
      rec.isPaid = rec.paidCzk >= r.due && r.due > 0;

      // just refresh KPIs + status text (no table rebuild, so typing is smooth)
      renderPaymentKpis();
    });
  }
}

// --- Load/save ---
async function loadFromGitHub() {
  btnLoad.disabled = true;
  btnLoad.textContent = "Načítám…";
  try {
    state = await loadDataFromGitHub();
    inpTotal.value = String(state.totalCzk);
    inpKids.value = String(state.kidsDiscount);
    inpAccount.value = state.paymentAccount || "";

    renderRoomsEditor(state);
    renderPaymentsPanel();
  } catch (e) {
    alert("Nepodařilo se načíst:\n" + e.message);
  } finally {
    btnLoad.disabled = false;
    btnLoad.textContent = "Načíst";
  }
}

async function saveToGitHub() {
  const token = (inpToken.value || "").trim();
  if (!token) return alert("Pro uložení zadej GitHub token.");

  const total = Number(inpTotal.value);
  const kids = Number(inpKids.value);
  if (!Number.isFinite(total) || total <= 0) return alert("Neplatná celková cena.");
  if (!Number.isFinite(kids) || kids <= 0 || kids > 1) return alert("Neplatný koeficient dětského pokoje (0–1).");

  state.totalCzk = Math.round(total);
  state.kidsDiscount = kids;
  state.paymentAccount = (inpAccount.value || "").trim();

  // cleanup payments: remove names not in rooms
  const namesNow = new Set();
  for (const room of state.rooms) for (const p of room.people) {
    const n = normalizeName(p);
    if (n) namesNow.add(n);
  }
  for (const key of Object.keys(state.payments || {})) {
    if (!namesNow.has(key)) delete state.payments[key];
  }

  btnSave.disabled = true;
  btnSave.textContent = "Ukládám…";
  try {
    await saveDataToGitHub(state, token);
    alert("Uloženo do GitHub Issue.");
  } catch (e) {
    alert("Nepodařilo se uložit:\n" + e.message);
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = "Uložit";
  }
}

btnLoad.addEventListener("click", loadFromGitHub);
btnSave.addEventListener("click", saveToGitHub);

// init
inpTotal.value = String(state.totalCzk);
inpKids.value = String(state.kidsDiscount);
inpAccount.value = state.paymentAccount || "";
renderRoomsEditor(state);
renderPaymentsPanel();
