// assets/edit.js
let state = defaultData();
let selectedName = "";

// dom
const inpTotal = document.getElementById("inpTotal");
const inpAccount = document.getElementById("inpAccount");
const inpAirNote = document.getElementById("inpAirNote");
const inpBanner = document.getElementById("inpBanner");
const inpBannerVisible = document.getElementById("inpBannerVisible");
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

const suggestPay = document.getElementById("suggestPay");
const suggestRefund = document.getElementById("suggestRefund");
const suggestHint = document.getElementById("suggestHint");

const btnAddPay = document.getElementById("btnAddPay");
const btnAddRefund = document.getElementById("btnAddRefund");
const btnLoad = document.getElementById("btnLoad");
const btnSave = document.getElementById("btnSave");

const editGrid = document.getElementById("editGrid");

// ---- helpers ----
function listParticipantsInOrder(data) {
  const arr = [];
  for (const r of data.rooms || []) {
    for (const p of (r.people || [])) {
      const name = normalizeName(p);
      if (name) arr.push({ name, room: r.name || "—" });
    }
  }
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (seen.has(x.name)) continue;
    seen.add(x.name);
    out.push(x);
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "cs"));
  return out;
}

function sumEntries(list) {
  return (list || []).reduce((s, x) => s + (Math.round(Number(x.amount) || 0)), 0);
}

function cleanupEmptyEntries(rec) {
  if (!rec) return;
  rec.payments = (rec.payments || []).filter(x => Number(x.amount) > 0);
  rec.refunds = (rec.refunds || []).filter(x => Number(x.amount) > 0);
}

function cleanupPeopleNotInRooms() {
  const alive = new Set(listParticipantsInOrder(state).map(x => x.name));
  for (const k of Object.keys(state.people || {})) {
    if (!alive.has(k)) delete state.people[k];
  }
}

// ---- rooms editor ----
function renderRoomsEditor(data) {
  editGrid.innerHTML = "";
  for (const r of data.rooms || []) {
    const card = document.createElement("div");
    card.className = "roomEdit";
    const slots = (r.people || []).map((p, idx) => {
      const id = `${r.id}_${idx}`;
      return `
        <div class="slotRow">
          <input data-room="${r.id}" data-idx="${idx}" id="${id}" type="text" placeholder="jméno" value="${(p || "").replace(/"/g, "&quot;")}" />
          <button class="btn" data-clear="${id}" type="button">Smazat</button>
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <div class="roomEditTop">
        <div>
          <div class="roomEditName">${r.name || "Pokoj"}</div>
          <div class="roomEditMeta">${r.type === "kids" ? "Dětský pokoj" : "Dvoulůžko"} · ${r.id}</div>
        </div>
      </div>
      <div class="slots">${slots}</div>
    `;

    editGrid.appendChild(card);
  }

  editGrid.querySelectorAll("input[data-room]").forEach(inp => {
    inp.addEventListener("input", () => {
      const rid = inp.getAttribute("data-room");
      const idx = Number(inp.getAttribute("data-idx"));
      const room = state.rooms.find(x => x.id === rid);
      if (!room) return;
      room.people[idx] = normalizeName(inp.value);
      renderAdminTable();
      if (selectedName) renderSelectedPanel();
    });
  });

  editGrid.querySelectorAll("button[data-clear]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-clear");
      const inp = document.getElementById(id);
      if (!inp) return;
      inp.value = "";
      inp.dispatchEvent(new Event("input"));
    });
  });
}

// ---- pricing for admin ----
function nameToRoomType(data, name) {
  for (const r of data.rooms || []) {
    for (const p of (r.people || [])) {
      if (normalizeName(p) === name) return r.type === "kids" ? "kids" : "adult";
    }
  }
  return "adult";
}

function shouldPayAmount(data, name) {
  const total = Math.round(Number(data.totalCzk) || 0);
  const { kids, adults } = countPeopleByType(data.rooms);
  const shares = computeShares(total, adults, kids);
  const t = nameToRoomType(data, name);
  const raw = t === "kids" ? shares.kids : shares.adults;
  return roundCzk(raw);
}

// ---- admin table ----
function renderAdminTable() {
  const people = listParticipantsInOrder(state);
  adminBody.innerHTML = "";

  if (!people.length) {
    adminEmpty.style.display = "block";
  } else {
    adminEmpty.style.display = "none";
  }

  let totalPaid = 0;
  let totalRefunded = 0;

  for (const p of people) {
    const rec = state.people[p.name] || { payments: [], refunds: [] };
    const paid = sumEntries(rec.payments);
    const refunded = sumEntries(rec.refunds);
    totalPaid += paid;
    totalRefunded += refunded;

    const mustPay = shouldPayAmount(state, p.name);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><button class="btn" data-sel="${p.name}" type="button">${p.name}</button></td>
      <td class="center">${p.room}</td>
      <td class="center">${formatCzk(mustPay)}</td>
      <td class="center">${formatCzk(paid)}</td>
      <td class="center">${formatCzk(refunded)}</td>
    `;
    adminBody.appendChild(tr);
  }

  const surplus = Math.max(0, totalPaid - Math.round(Number(state.totalCzk) || 0));
  kpiPaid.textContent = formatCzk(totalPaid);
  kpiRefunded.textContent = formatCzk(totalRefunded);
  kpiSurplus.textContent = formatCzk(surplus);

  adminBody.querySelectorAll("button[data-sel]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedName = btn.getAttribute("data-sel") || "";
      renderSelectedPanel();
    });
  });
}

// ---- selected panel ----
function renderSelectedPanel() {
  if (!selectedName) {
    selTitle.textContent = "—";
    selMeta.textContent = "Vyber jméno vlevo.";
    payListAdmin.innerHTML = "";
    refundListAdmin.innerHTML = "";
    suggestHint.style.display = "none";
    return;
  }

  const meta = listParticipantsInOrder(state).find(x => x.name === selectedName);
  const mustPay = shouldPayAmount(state, selectedName);
  selTitle.textContent = selectedName;
  selMeta.textContent = (meta ? meta.room : "—") + ` · Má platit: ${formatCzk(mustPay)}`;

  if (!state.people[selectedName]) state.people[selectedName] = { payments: [], refunds: [] };
  const rec = state.people[selectedName];

  suggestHint.style.display = "block";
  suggestHint.textContent = "Přidání položky nastaví dnešní datum – případně ho uprav níž.";

  payListAdmin.innerHTML = renderHistoryList(rec.payments, "payments");
  refundListAdmin.innerHTML = renderHistoryList(rec.refunds, "refunds");

  bindHistoryButtons(rec);

  suggestPay.value = "";
  suggestRefund.value = "";
}

function renderHistoryList(list, kind) {
  const arr = (list || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (!arr.length) return `<div class="subSmall">—</div>`;
  return arr.map((x, idx) => `
    <div class="roomCard" style="margin-bottom:8px;">
      <div class="roomTop">
        <div>
          <div class="roomName">${formatCzk(x.amount)}</div>
          <div class="roomMeta">${x.date || "—"}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn" data-edit="${kind}" data-idx="${idx}" type="button">Upravit</button>
          <button class="btn" data-del="${kind}" data-idx="${idx}" type="button">Smazat</button>
        </div>
      </div>
    </div>
  `).join("");
}

function bindHistoryButtons(rec) {
  document.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-del");
      const idx = Number(btn.getAttribute("data-idx"));
      if (!Number.isFinite(idx)) return;
      if (!confirm("Smazat položku?")) return;
      rec[kind].splice(idx, 1);
      cleanupEmptyEntries(rec);
      renderAdminTable();
      renderSelectedPanel();
    });
  });

  document.querySelectorAll("button[data-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-edit");
      const idx = Number(btn.getAttribute("data-idx"));
      const item = rec[kind]?.[idx];
      if (!item) return;

      const amount = prompt("Částka (Kč):", String(item.amount || ""));
      if (amount === null) return;
      const a = Math.round(Number(amount) || 0);
      if (!(a > 0)) return alert("Neplatná částka.");

      const date = prompt("Datum (YYYY-MM-DD):", item.date || todayISO());
      if (date === null) return;
      const d = String(date || "").trim() || todayISO();

      item.amount = a;
      item.date = d;

      cleanupEmptyEntries(rec);
      renderAdminTable();
      renderSelectedPanel();
    });
  });
}

// ---- add quick entries ----
btnAddPay.addEventListener("click", () => {
  if (!selectedName) return alert("Nejdřív vyber jméno.");
  const a = Math.round(Number(suggestPay.value) || 0);
  if (!(a > 0)) return alert("Neplatná částka.");
  const rec = state.people[selectedName] || (state.people[selectedName] = { payments: [], refunds: [] });
  rec.payments.push({ amount: a, date: todayISO() });
  cleanupEmptyEntries(rec);
  renderAdminTable();
  renderSelectedPanel();
});

btnAddRefund.addEventListener("click", () => {
  if (!selectedName) return alert("Nejdřív vyber jméno.");
  const a = Math.round(Number(suggestRefund.value) || 0);
  if (!(a > 0)) return alert("Neplatná částka.");
  const rec = state.people[selectedName] || (state.people[selectedName] = { payments: [], refunds: [] });
  rec.refunds.push({ amount: a, date: todayISO() });
  cleanupEmptyEntries(rec);
  renderAdminTable();
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
    if (inpAirNote) inpAirNote.value = state.airNote || "";
    if (inpBanner) inpBanner.value = state.banner || "";
    if (inpBannerVisible) inpBannerVisible.checked = !!state.bannerVisible;
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

async function saveToGitHubNow() {
  const token = (inpToken.value || "").trim();
  if (!token) return alert("Pro uložení zadej GitHub token.");

  const total = Number(inpTotal.value);
  if (!Number.isFinite(total) || total <= 0) return alert("Neplatná celková cena.");

  state.totalCzk = Math.round(total);
  state.paymentAccount = (inpAccount.value || "").trim();
  state.airNote = (inpAirNote?.value || "").trim();
  state.banner = (inpBanner?.value || "").trim();
  state.bannerVisible = inpBannerVisible?.checked || false;

  cleanupPeopleNotInRooms();
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
if (inpAirNote) inpAirNote.value = state.airNote || "";
if (inpBanner) inpBanner.value = state.banner || "";
if (inpBannerVisible) inpBannerVisible.checked = !!state.bannerVisible;
renderRoomsEditor(state);
renderAdminTable();
renderSelectedPanel();
