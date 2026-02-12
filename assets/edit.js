// assets/edit.js
let state = defaultData();
let selectedName = "";

// dom
const inpTotal = document.getElementById("inpTotal");
const inpActualCzk = document.getElementById("inpActualCzk");
const inpAccount = document.getElementById("inpAccount");
const inpAirNote = document.getElementById("inpAirNote");
const inpMapAddress = document.getElementById("inpMapAddress");
const inpMapNote = document.getElementById("inpMapNote");
const inpMapZoom = document.getElementById("inpMapZoom");
const mapZoomVal = document.getElementById("mapZoomVal");
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
const suggestPayDate = document.getElementById("suggestPayDate");
const suggestRefundDate = document.getElementById("suggestRefundDate");
const suggestHint = document.getElementById("suggestHint");

const btnAddPay = document.getElementById("btnAddPay");
const btnAddRefund = document.getElementById("btnAddRefund");
const btnLoad = document.getElementById("btnLoad");
const btnSave = document.getElementById("btnSave");

const editGrid = document.getElementById("editGrid");
const unassignedWrap = document.getElementById("unassignedWrap");
const unassignedList = document.getElementById("unassignedList");
const inpUnassignedAdd = document.getElementById("inpUnassignedAdd");
const btnUnassignedAdd = document.getElementById("btnUnassignedAdd");

const loadingOverlay = document.getElementById("loadingOverlay");
const loadingTitle = document.getElementById("loadingTitle");
const loadingText = document.getElementById("loadingText");
const loadingNote = document.getElementById("loadingNote");

function enforceHiddenTotalWhenLoggedOut() {
  const hasToken = (inpToken.value || "").trim().length > 0;
  if (!hasToken) {
    inpTotal.value = "";
    inpTotal.placeholder = "Přihlaste se tokenem";
  } else if (inpTotal.placeholder === "Přihlaste se tokenem") {
    inpTotal.placeholder = "";
  }
}

function showLoading(mode) {
  if (!loadingOverlay) return;
  if (mode === "load") {
    if (loadingTitle) loadingTitle.textContent = "Načítám data z GitHubu…";
    if (loadingText) loadingText.textContent = "Tahám poslední verzi dat z Issue.";
  } else if (mode === "save") {
    if (loadingTitle) loadingTitle.textContent = "Ukládám do GitHubu…";
    if (loadingText) loadingText.textContent = "Zapisuji změny do Issue jako JSON.";
  } else {
    if (loadingTitle) loadingTitle.textContent = "Pracuji s GitHubem…";
    if (loadingText) loadingText.textContent = "Chvíli strpení.";
  }
  if (loadingNote) loadingNote.textContent = "Nezavírej stránku, github občas reaguje pomaleji (několik vteřin).";
  loadingOverlay.classList.add("open");
  loadingOverlay.setAttribute("aria-hidden", "false");
}

function hideLoading() {
  if (!loadingOverlay) return;
  loadingOverlay.classList.remove("open");
  loadingOverlay.setAttribute("aria-hidden", "true");
}

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

function applyStateFromData(newState) {
  state = sanitizeData ? sanitizeData(newState) : newState;
  inpTotal.value = String(state.totalCzk);
  if (inpActualCzk) inpActualCzk.value = state.actualCzk > 0 ? String(state.actualCzk) : "";
  inpAccount.value = state.paymentAccount || "";
  if (inpAirNote) inpAirNote.value = state.airNote || "";
  if (inpMapAddress) inpMapAddress.value = state.mapAddress || "";
  if (inpMapNote) inpMapNote.value = state.mapNote || "";
  if (inpMapZoom) { inpMapZoom.value = String(state.mapZoom || 14); mapZoomVal.textContent = inpMapZoom.value; }
  if (inpBanner) inpBanner.value = state.banner || "";
  if (inpBannerVisible) inpBannerVisible.checked = !!state.bannerVisible;
  selectedName = "";
  renderRoomsEditor(state);
  renderUnassigned();
  renderAdminTable();
  renderSelectedPanel();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDisplayDateDDMMYYYY(y, m, d) {
  return `${pad2(d)}-${pad2(m)}-${String(y)}`;
}

function parseFlexibleDate(rawDate) {
  const d = String(rawDate || "").trim();
  if (!d) return null;

  let y, m, day;
  let match = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    day = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
  } else {
    // Backward compatibility for older stored entries.
    match = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    y = Number(match[1]);
    m = Number(match[2]);
    day = Number(match[3]);
  }

  const dt = new Date(y, m - 1, day);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return { y, m, d: day };
}

function todayDisplayDate() {
  const t = parseFlexibleDate(todayISO());
  return t ? toDisplayDateDDMMYYYY(t.y, t.m, t.d) : "01-01-1970";
}

function displayDate(rawDate) {
  const p = parseFlexibleDate(rawDate);
  if (!p) return String(rawDate || "").trim();
  return toDisplayDateDDMMYYYY(p.y, p.m, p.d);
}

function dateSortValue(rawDate) {
  const p = parseFlexibleDate(rawDate);
  if (!p) return -Infinity;
  return new Date(p.y, p.m - 1, p.d).getTime();
}

function normalizeEntryDateInput(rawDate) {
  const d = String(rawDate || "").trim();
  if (!d) return todayDisplayDate();
  const parsed = parseFlexibleDate(d);
  if (!parsed) return null;
  return toDisplayDateDDMMYYYY(parsed.y, parsed.m, parsed.d);
}

// ---- rooms editor ----
function freeSlots(data, excludeRoomId) {
  const out = [];
  for (const r of data.rooms || []) {
    for (let i = 0; i < (r.people || []).length; i++) {
      if (!normalizeName(r.people[i])) {
        out.push({ roomId: r.id, idx: i, label: `${r.name || r.id} · Místo ${i + 1}` });
      }
    }
  }
  return out;
}

function renderRoomsEditor(data) {
  editGrid.innerHTML = "";
  for (const r of data.rooms || []) {
    const card = document.createElement("div");
    card.className = "roomEdit";
    const slots = (r.people || []).map((p, idx) => {
      const id = `${r.id}_${idx}`;
      const name = normalizeName(p);

      // move button only for filled slots
      const moveBtn = name
        ? `<button class="btn" data-move-from="${r.id}" data-move-idx="${idx}" type="button">Přesunout</button>`
        : "";

      return `
        <div class="slotRow">
          <input data-room="${r.id}" data-idx="${idx}" id="${id}" type="text" placeholder="jméno" value="${(p || "").replace(/"/g, "&quot;")}" />
          ${moveBtn}
          <button class="btn" data-clear="${id}" type="button">Smazat</button>
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <div class="roomEditTop">
        <div>
          <div class="roomEditName">${r.name || "Pokoj"}</div>
          <div class="roomEditMeta">${r.type === "kids" ? "Dvě palandy" : "Manželská postel"} · ${r.id}</div>
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

  // move buttons
  editGrid.querySelectorAll("button[data-move-from]").forEach(btn => {
    btn.addEventListener("click", () => {
      const fromRoomId = btn.getAttribute("data-move-from");
      const fromIdx = Number(btn.getAttribute("data-move-idx"));
      const fromRoom = state.rooms.find(x => x.id === fromRoomId);
      if (!fromRoom) return;
      const personName = normalizeName(fromRoom.people[fromIdx]);
      if (!personName) return;

      const free = freeSlots(state);
      // always add "outside" option
      const options = free.map((s, i) => `${i + 1}. ${s.label}`);
      options.push(`${free.length + 1}. Mimo pokoje (nepřiřazení)`);

      const choice = prompt(`Kam přesunout ${personName}?\n\n${options.join("\n")}\n\nZadej číslo:`);
      if (choice === null) return;

      const ci = Number(choice) - 1;
      if (!Number.isFinite(ci) || ci < 0 || ci > free.length) return alert("Neplatná volba.");

      if (ci === free.length) {
        // move to unassigned
        fromRoom.people[fromIdx] = "";
        if (!state.unassigned) state.unassigned = [];
        state.unassigned.push(personName);
      } else {
        const target = free[ci];
        const toRoom = state.rooms.find(x => x.id === target.roomId);
        if (!toRoom) return;
        toRoom.people[target.idx] = personName;
        fromRoom.people[fromIdx] = "";
      }

      renderRoomsEditor(state);
      renderUnassigned();
      renderAdminTable();
      if (selectedName) renderSelectedPanel();
    });
  });
}

// ---- unassigned people ----
function renderUnassigned() {
  if (!state.unassigned) state.unassigned = [];
  const list = state.unassigned.filter(n => normalizeName(n));

  if (!list.length) {
    unassignedWrap.style.display = "none";
    return;
  }

  unassignedWrap.style.display = "block";
  unassignedList.innerHTML = list.map((name, idx) => `
    <div class="slotRow">
      <input type="text" value="${name.replace(/"/g, "&quot;")}" disabled style="opacity:.7;" />
      <button class="btn" data-assign="${idx}" type="button">Přiřadit do pokoje</button>
      <button class="btn" data-remove-unassigned="${idx}" type="button">Smazat</button>
    </div>
  `).join("");

  // assign to room
  unassignedList.querySelectorAll("button[data-assign]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-assign"));
      const personName = state.unassigned[idx];
      if (!personName) return;

      const free = freeSlots(state);
      if (!free.length) return alert("Nejsou volné sloty v žádném pokoji.");

      const options = free.map((s, i) => `${i + 1}. ${s.label}`).join("\n");
      const choice = prompt(`Kam přiřadit ${personName}?\n\n${options}\n\nZadej číslo:`);
      if (choice === null) return;

      const ci = Number(choice) - 1;
      if (!Number.isFinite(ci) || ci < 0 || ci >= free.length) return alert("Neplatná volba.");

      const target = free[ci];
      const toRoom = state.rooms.find(x => x.id === target.roomId);
      if (!toRoom) return;

      toRoom.people[target.idx] = personName;
      state.unassigned.splice(idx, 1);

      renderRoomsEditor(state);
      renderUnassigned();
      renderAdminTable();
      if (selectedName) renderSelectedPanel();
    });
  });

  // remove from unassigned
  unassignedList.querySelectorAll("button[data-remove-unassigned]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-remove-unassigned"));
      if (!confirm(`Smazat ${state.unassigned[idx]}?`)) return;
      state.unassigned.splice(idx, 1);
      renderUnassigned();
      renderAdminTable();
      if (selectedName) renderSelectedPanel();
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
  const { price: total } = effectivePrice(data);
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
    const reallyPaid = paid - refunded; // skutečně uhrazeno po odečtení vratek
    const toReturn = Math.max(0, reallyPaid - mustPay); // kolik vrátit

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><button class="btn tiny" data-sel="${p.name}" type="button">${p.name}</button></td>
      <td class="center">${p.room}</td>
      <td class="center">${formatCzk(mustPay)}</td>
      <td class="center">${formatCzk(paid)}</td>
      <td class="center">${formatCzk(refunded)}</td>
      <td class="center">${formatCzk(reallyPaid)}</td>
      <td class="center" style="${toReturn > 0 ? 'color:var(--warn);font-weight:700;' : ''}">${toReturn > 0 ? formatCzk(toReturn) : '—'}</td>
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
  const rec0 = state.people[selectedName] || { payments: [], refunds: [] };
  const paidTotal = sumEntries(rec0.payments);
  const refundedTotal = sumEntries(rec0.refunds);
  const reallyPaid0 = paidTotal - refundedTotal;
  const toReturn0 = Math.max(0, reallyPaid0 - mustPay);
  const toPay0 = Math.max(0, mustPay - reallyPaid0);

  selTitle.textContent = selectedName;
  let metaText = (meta ? meta.room : "—") + ` · Má platit: ${formatCzk(mustPay)} · Reálně uhrazeno: ${formatCzk(reallyPaid0)}`;
  if (toReturn0 > 0) metaText += ` · ⚠️ K vrácení: ${formatCzk(toReturn0)}`;
  else if (toPay0 > 0) metaText += ` · Nedoplatek: ${formatCzk(toPay0)}`;
  else metaText += ` · ✅ Vyrovnáno`;
  selMeta.textContent = metaText;

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
  const arr = (list || []).slice().sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date));
  if (!arr.length) return `<div class="subSmall">—</div>`;
  return arr.map((x, idx) => `
    <div class="roomCard" style="margin-bottom:8px;">
      <div class="roomTop">
        <div>
          <div class="roomName">${formatCzk(x.amount)}</div>
          <div class="roomMeta">${displayDate(x.date) || "—"}</div>
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

      const date = prompt("Datum (DD-MM-YYYY):", displayDate(item.date) || todayDisplayDate());
      if (date === null) return;
      const d = normalizeEntryDateInput(date);
      if (!d) return alert("Neplatné datum (použij DD-MM-YYYY).");

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
  const d = normalizeEntryDateInput(suggestPayDate?.value);
  if (!d) return alert("Neplatné datum platby (použij DD-MM-YYYY).");
  const rec = state.people[selectedName] || (state.people[selectedName] = { payments: [], refunds: [] });
  rec.payments.push({ amount: a, date: d });
  cleanupEmptyEntries(rec);
  renderAdminTable();
  renderSelectedPanel();
});

btnAddRefund.addEventListener("click", () => {
  if (!selectedName) return alert("Nejdřív vyber jméno.");
  const a = Math.round(Number(suggestRefund.value) || 0);
  if (!(a > 0)) return alert("Neplatná částka.");
  const d = normalizeEntryDateInput(suggestRefundDate?.value);
  if (!d) return alert("Neplatné datum vratky (použij DD-MM-YYYY).");
  const rec = state.people[selectedName] || (state.people[selectedName] = { payments: [], refunds: [] });
  rec.refunds.push({ amount: a, date: d });
  cleanupEmptyEntries(rec);
  renderAdminTable();
  renderSelectedPanel();
});

// ---- load/save ----
function formatSaveErrorMessage(err) {
  const base = (err && err.message) ? err.message : "Neznama chyba pri komunikaci s GitHub API.";
  const steps = [
    "Over, ze token je Fine-grained PAT.",
    `Over pristup tokenu k repozitari ${CFG.OWNER}/${CFG.REPO}.`,
    "Nastav repository permission: Issues -> Read and write.",
  ];
  return `${base}\n\nCo zkontrolovat:\n- ${steps.join("\n- ")}`;
}

async function loadFromGitHub() {
  const token = (inpToken.value || "").trim();
  if (!token) {
    alert("Nejdřív se přihlas tokenem.");
    return;
  }

  btnLoad.disabled = true;
  btnLoad.textContent = "Načítám…";
  try {
    showLoading("load");
    const data = await loadDataFromGitHub(token);
    applyStateFromData(data);
  } catch (e) {
    alert("Nepodařilo se načíst:\n" + e.message);
  } finally {
    hideLoading();
    btnLoad.disabled = false;
    btnLoad.textContent = "Načíst";
  }
}

async function saveToGitHubNow() {
  const token = (inpToken.value || "").trim();
  if (!token) {
    return alert("Pro ulozeni zadej GitHub token (Fine-grained PAT s pravem Issues: Read and write).");
  }

  const total = Number(inpTotal.value);
  if (!Number.isFinite(total) || total <= 0) return alert("Neplatná celková cena.");

  state.totalCzk = Math.round(total);
  const actualVal = Number(inpActualCzk?.value);
  state.actualCzk = Number.isFinite(actualVal) && actualVal > 0 ? Math.round(actualVal) : 0;
  state.paymentAccount = (inpAccount.value || "").trim();
  state.airNote = (inpAirNote?.value || "").trim();
  state.mapAddress = (inpMapAddress?.value || "").trim();
  state.mapNote = (inpMapNote?.value || "").trim();
  state.mapZoom = Number(inpMapZoom?.value) || 14;
  state.banner = (inpBanner?.value || "").trim();
  state.bannerVisible = inpBannerVisible?.checked || false;

  cleanupPeopleNotInRooms();
  for (const name of Object.keys(state.people || {})) {
    cleanupEmptyEntries(state.people[name]);
  }

  btnSave.disabled = true;
  btnSave.textContent = "Ukládám…";
  try {
    showLoading("save");
    await saveDataToGitHub(state, token);
    // Po uložení necháme lokální stav tak, jak je.
    // GitHub může mít mírné zpoždění, ale edit stránka zůstává zdrojem pravdy.
  } catch (e) {
    alert("Nepodarilo se ulozit:\n\n" + formatSaveErrorMessage(e));
  } finally {
    hideLoading();
    btnSave.disabled = false;
    btnSave.textContent = "Uložit";
  }
}

btnLoad.addEventListener("click", loadFromGitHub);
btnSave.addEventListener("click", saveToGitHubNow);

// init
applyStateFromData(state);
enforceHiddenTotalWhenLoggedOut();
if (suggestPayDate) suggestPayDate.value = todayDisplayDate();
if (suggestRefundDate) suggestRefundDate.value = todayDisplayDate();

// zoom slider live update
if (inpMapZoom) {
  inpMapZoom.addEventListener("input", () => {
    mapZoomVal.textContent = inpMapZoom.value;
  });
}

// add unassigned person
btnUnassignedAdd.addEventListener("click", () => {
  const name = normalizeName(inpUnassignedAdd.value);
  if (!name) return alert("Zadej jméno.");
  if (!state.unassigned) state.unassigned = [];
  state.unassigned.push(name);
  inpUnassignedAdd.value = "";
  renderUnassigned();
});
inpUnassignedAdd.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); btnUnassignedAdd.click(); }
});

// Hide sensitive prefilled value until token is provided.
inpToken.addEventListener("input", () => {
  enforceHiddenTotalWhenLoggedOut();
});

// Browser can restore form values from session history; clear again when page becomes visible.
window.addEventListener("pageshow", enforceHiddenTotalWhenLoggedOut);
setTimeout(enforceHiddenTotalWhenLoggedOut, 0);
