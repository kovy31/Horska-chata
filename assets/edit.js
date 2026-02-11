// assets/edit.js

const editGrid = document.getElementById("editGrid");
const btnLoad = document.getElementById("btnLoad");
const btnSave = document.getElementById("btnSave");

const inpTotal = document.getElementById("inpTotal");
const inpAccount = document.getElementById("inpAccount");
const inpToken = document.getElementById("inpToken");

const kpiPaid = document.getElementById("kpiPaid");
const kpiRefunded = document.getElementById("kpiRefunded");
const kpiSurplus = document.getElementById("kpiSurplus");

const adminBody = document.querySelector("#adminTable tbody");
const adminEmpty = document.getElementById("adminEmpty");

const selTitle = document.getElementById("selTitle");
const selMeta = document.getElementById("selMeta");

const payListAdmin = document.getElementById("payListAdmin");
const refundListAdmin = document.getElementById("refundListAdmin");
const btnAddPay = document.getElementById("btnAddPay");
const btnAddRefund = document.getElementById("btnAddRefund");

const suggestRefund = document.getElementById("suggestRefund");
const suggestHint = document.getElementById("suggestHint");

let state = defaultData();
let selectedName = "";

// ---- Rooms editor ----
function migratePersonKey(oldName, newName) {
  oldName = normalizeName(oldName);
  newName = normalizeName(newName);
  if (!oldName || !newName || oldName === newName) return;
  if (!state.people) state.people = {};
  if (state.people[oldName]) {
    if (!state.people[newName]) state.people[newName] = state.people[oldName];
    delete state.people[oldName];
  }
}

function renderRoomsEditor(data) {
  editGrid.innerHTML = "";

  for (const room of data.rooms) {
    const card = document.createElement("div");
    card.className = "card";

    const fields = room.people.map((val, idx) => `
      <div class="fieldRow">
        <label class="label">${idx + 1}. osoba</label>
        <input data-room="${room.id}" data-idx="${idx}" value="${(val||"").replace(/"/g,'&quot;')}" placeholder="Jméno" />
      </div>
    `).join("");

    card.innerHTML = `
      <div class="roomHead">
        <div>
          <h2>${room.name}</h2>
          <div class="subSmall">${room.type==="kids" ? "Dětský pokoj (sleva 25 % pro osoby 15+)" : "Pokoj s manželskou postelí"}</div>
        </div>
        <div class="subSmall">${room.people.length} místa</div>
      </div>
      ${fields}
    `;

    editGrid.appendChild(card);
  }

  editGrid.querySelectorAll("input[data-room]").forEach(inp => {
    inp.addEventListener("focus", (e) => { e.target.dataset.prev = e.target.value; });

    inp.addEventListener("input", (e) => {
      const roomId = e.target.getAttribute("data-room");
      const idx = Number(e.target.getAttribute("data-idx"));
      const room = state.rooms.find(r => r.id === roomId);

      const prev = e.target.dataset.prev || "";
      const next = normalizeName(e.target.value);

      room.people[idx] = next;
      migratePersonKey(prev, next);
      e.target.dataset.prev = next;

      // just refresh the admin table + suggestion (safe)
      renderAdminTable();
      if (selectedName && !existsInRooms(selectedName)) {
        selectedName = "";
        renderSelectedPanel();
      } else {
        renderSelectedPanel();
      }
    });
  });
}

function existsInRooms(name) {
  const n = normalizeName(name);
  if (!n) return false;
  for (const room of state.rooms) {
    for (const p of room.people) if (normalizeName(p) === n) return true;
  }
  return false;
}

// ---- Admin finance table ----
function renderAdminTable() {
  // sync settings to state (do not rerender inputs while typing elsewhere)
  const total = Number(inpTotal.value);
  if (Number.isFinite(total) && total > 0) state.totalCzk = Math.round(total);
  state.paymentAccount = (inpAccount.value || "").trim();

  const ledger = computeFinanceLedger(state);

  kpiPaid.textContent = formatCzk(ledger.totalPaid);
  kpiRefunded.textContent = formatCzk(ledger.totalRefunded);
  kpiSurplus.textContent = formatCzk(ledger.surplus);

  adminBody.innerHTML = "";
  if (ledger.rows.length === 0) {
    adminEmpty.style.display = "block";
    return;
  }
  adminEmpty.style.display = "none";

  const rows = [...ledger.rows].sort((a, b) => a.name.localeCompare(b.name, "cs"));

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.className = "clickRow" + (r.name === selectedName ? " activeRow" : "");
    tr.setAttribute("data-name", r.name);

    const status =
      r.remainingToPay > 0 ? `Doplatit ${formatCzk(r.remainingToPay)}`
      : (r.suggestedRefund > 0 ? `Vrátit ${formatCzk(r.suggestedRefund)}` : "Srovnáno");

    tr.innerHTML = `
      <td><strong>${r.name}</strong>${r.isKid ? ` <span class="miniTag">sleva 25%</span>` : ""}</td>
      <td class="center"><strong>${formatCzk(r.due)}</strong></td>
      <td class="center">${formatCzk(r.paid)}</td>
      <td class="center">${formatCzk(r.refunded)}</td>
      <td class="center"><strong>${status}</strong></td>
    `;
    adminBody.appendChild(tr);
  }

  // row click
  adminBody.querySelectorAll("tr[data-name]").forEach(tr => {
    tr.addEventListener("click", () => {
      selectedName = tr.getAttribute("data-name") || "";
      renderAdminTable();
      renderSelectedPanel();
    });
  });
}

// ---- Selected person editor panel ----
function entryRowHTML(kind, idx, entry) {
  // kind = "pay" or "ref"
  const amount = entry?.amount ?? 0;
  const date = entry?.date ?? "";
  return `
    <div class="entryRow">
      <input class="entryAmount" type="number" min="0" step="1"
        data-kind="${kind}" data-idx="${idx}" data-field="amount"
        value="${String(amount)}" />
      <input class="entryDate" type="date"
        data-kind="${kind}" data-idx="${idx}" data-field="date"
        value="${date}" />
      <button class="iconBtnSmall" type="button" data-del="${kind}" data-idx="${idx}" aria-label="Smazat">✕</button>
    </div>
  `;
}

function renderSelectedPanel() {
  const ledger = computeFinanceLedger(state);
  const row = ledger.rows.find(r => r.name === selectedName);

  if (!selectedName || !row) {
    selTitle.textContent = "Vyber člověka v tabulce výše…";
    selMeta.textContent = "";
    payListAdmin.innerHTML = "";
    refundListAdmin.innerHTML = "";
    btnAddPay.disabled = true;
    btnAddRefund.disabled = true;
    suggestRefund.textContent = "—";
    suggestHint.textContent = "";
    return;
  }

  // ensure record exists
  const rec = ensurePersonRecord(state, selectedName);

  selTitle.textContent = selectedName;
  selMeta.textContent =
    `${row.roomName}${row.isKid ? " · sleva 25 % (osoba 15+)" : ""} · Má platit: ${formatCzk(row.due)} · Zbývá doplatit: ${formatCzk(row.remainingToPay)}`;

  btnAddPay.disabled = false;
  btnAddRefund.disabled = false;

  // suggested refund
  suggestRefund.textContent = formatCzk(row.suggestedRefund || 0);
  suggestHint.textContent = row.suggestedRefund > 0
    ? "Návrh vrácení teď (podle dostupného přebytku)."
    : "Momentálně není co vracet (nebo ještě není přebytek).";

  // lists
  const pays = (rec.payments || []);
  const refs = (rec.refunds || []);

  payListAdmin.innerHTML =
    pays.length ? pays.map((e, i) => entryRowHTML("pay", i, e)).join("") : `<div class="subSmall">Zatím žádná platba.</div>`;

  refundListAdmin.innerHTML =
    refs.length ? refs.map((e, i) => entryRowHTML("ref", i, e)).join("") : `<div class="subSmall">Zatím žádná vratka.</div>`;

  // listeners: inputs (IMPORTANT: no full rerender while typing)
  function bindEntries(container, kind) {
    container.querySelectorAll("input[data-kind]").forEach(inp => {
      // Update state on blur/change only (prevents jumping while typing)
      const isDate = inp.getAttribute("data-field") === "date";
      const evt = isDate ? "change" : "blur";
      inp.addEventListener(evt, () => {
        const idx = Number(inp.getAttribute("data-idx"));
        const field = inp.getAttribute("data-field");
        const list = kind === "pay" ? rec.payments : rec.refunds;
        if (!list[idx]) return;

        if (field === "amount") {
          list[idx].amount = clampInt(inp.value, 0, 1_000_000_000);
          inp.value = String(list[idx].amount);
        } else {
          list[idx].date = String(inp.value || "").trim();
        }

        cleanupEmptyEntries(rec);
        renderAdminTable();
        renderSelectedPanel(); // OK because blur/change, not every keystroke
      });
    });

    container.querySelectorAll("button[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-idx"));
        const list = kind === "pay" ? rec.payments : rec.refunds;
        list.splice(idx, 1);
        cleanupEmptyEntries(rec);
        renderAdminTable();
        renderSelectedPanel();
      });
    });
  }

  bindEntries(payListAdmin, "pay");
  bindEntries(refundListAdmin, "ref");
}

function cleanupEmptyEntries(rec) {
  rec.payments = (rec.payments || []).filter(x => (Number(x.amount)||0) > 0 || (x.date||"").trim());
  rec.refunds = (rec.refunds || []).filter(x => (Number(x.amount)||0) > 0 || (x.date||"").trim());
  // Normalize
  rec.payments = rec.payments.map(x => ({ amount: clampInt(x.amount,0,1_000_000_000), date: (x.date||"").trim() }));
  rec.refunds = rec.refunds.map(x => ({ amount: clampInt(x.amount,0,1_000_000_000), date: (x.date||"").trim() }));
  // Remove zero-amount entries
  rec.payments = rec.payments.filter(x => x.amount > 0);
  rec.refunds = rec.refunds.filter(x => x.amount > 0);
}

btnAddPay.addEventListener("click", () => {
  if (!selectedName) return;
  const rec = ensurePersonRecord(state, selectedName);
  rec.payments.push({ amount: 0, date: todayISO() });
  renderSelectedPanel();
});

btnAddRefund.addEventListener("click", () => {
  if (!selectedName) return;
  const rec = ensurePersonRecord(state, selectedName);
  rec.refunds.push({ amount: 0, date: todayISO() });
  renderSelectedPanel();
});

// ---- load/save ----
async function loadFromGitHub() {
  btnLoad.disabled = true;
  btnLoad.textContent = "Načítám…";
  try {
    state = await loadDataFromGitHub();
    inpTotal.value = String(state.totalCzk);
    inpAccount.value = state.paymentAccount || "";
    selectedName = "";
    renderRoomsEditor(state);
    renderAdminTable();
    renderSelectedPanel();
  } catch (e) {
    alert("Nepodařilo se načíst:\n" + e.message);
  } finally {
    btnLoad.disabled = false;
    btnLoad.textContent = "Načíst";
  }
}

function cleanupPeopleNotInRooms() {
  const alive = new Set(listParticipantsInOrder(state).map(x => x.name));
  for (const k of Object.keys(state.people || {})) {
    if (!alive.has(k)) delete state.people[k];
  }
}

async function saveToGitHubNow() {
  const token = (inpToken.value || "").trim();
  if (!token) return alert("Pro uložení zadej GitHub token.");

  const total = Number(inpTotal.value);
  if (!Number.isFinite(total) || total <= 0) return alert("Neplatná celková cena.");

  state.totalCzk = Math.round(total);
  state.paymentAccount = (inpAccount.value || "").trim();

  // cleanup
  cleanupPeopleNotInRooms();
  // normalize all entries
  for (const name of Object.keys(state.people || {})) {
    cleanupEmptyEntries(state.people[name]);
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
btnSave.addEventListener("click", saveToGitHubNow);

// init
inpTotal.value = String(state.totalCzk);
inpAccount.value = state.paymentAccount || "";
renderRoomsEditor(state);
renderAdminTable();
renderSelectedPanel();
