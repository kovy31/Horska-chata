// assets/view.js

const AIRBNB_IMAGES = [
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/3cc519a7-fdd2-44a7-a44a-870c4d051530.jpeg?im_w=1200",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/3d6a0041-65ad-4ba4-90c1-d971de85fe95.jpeg?im_w=1200",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/3a516abc-1e0d-4f69-9bee-6d5095ac0ef3.jpeg?im_w=1200",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/105b8a30-e224-4bc2-a3a7-602d091d8673.jpeg?im_w=1200",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/06912285-7757-4cf7-bb84-aacf81473236.jpeg?im_w=720",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/4dc64b84-fddc-44a3-8e6c-1686307250dd.jpeg?im_w=720",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/78c8bcc9-b723-4e29-993e-67e8bed7e175.jpeg?aki_policy=xx_large",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/d4d9d4e9-3079-4de3-a293-dfaaac267c92.jpeg?aki_policy=xx_large",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/4d92d376-89a2-4315-9d9f-9c92201f82e5.jpeg?aki_policy=xx_large",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/e52d40af-9273-4008-a836-d9d4be976db8.jpeg?aki_policy=xx_large",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/7a24f910-3391-456f-9728-e7cb4e9d9cd0.jpeg?aki_policy=xx_large",
  // "https://a0.muscache.com/im/pictures/...jpeg?im_w=1200",
  // "https://a0.muscache.com/im/pictures/...jpeg?im_w=1200",
];
const SLIDE_MS = 4500;

// DOM
const elRoomsGrid = document.getElementById("roomsGrid");
const elWhoChips = document.getElementById("whoChips");
const elWhoStat = document.getElementById("whoStat");
const elCapStat = document.getElementById("capStat");

const elPayAccount = document.getElementById("payAccount");

// KPI
const elTotal = document.getElementById("kpiTotal");
const elUnitFull = document.getElementById("kpiUnitFull");
const elUnitKid = document.getElementById("kpiUnitKid");
const elPaid = document.getElementById("kpiPaid");
const elNeed = document.getElementById("kpiNeed");
const elSurplus = document.getElementById("kpiSurplus");

const payTableBody = document.querySelector("#payTable tbody");
const payList = document.getElementById("payList");

const refundTableBody = document.querySelector("#refundTable tbody");
const refundEmpty = document.getElementById("refundEmpty");

// Slider
const slideImg = document.getElementById("airSlideImg");
const dotsWrap = document.getElementById("airDots");

// Info modal
const infoModal = document.getElementById("infoModal");
const infoClose = document.getElementById("infoClose");
const infoSub = document.getElementById("infoSub");
const infoBody = document.getElementById("infoBody");

// QR modal
const qrModal = document.getElementById("qrModal");
const qrClose = document.getElementById("qrClose");
const qrSub = document.getElementById("qrSub");
const qrBox = document.getElementById("qrBox");
const qrDownload = document.getElementById("qrDownload");
const qrCopy = document.getElementById("qrCopy");

let lastSpd = "";

// ---------- UI helpers ----------
function openInfoModal(title, html) {
  infoSub.textContent = title;
  infoBody.innerHTML = html;
  infoModal.classList.add("open");
  infoModal.setAttribute("aria-hidden", "false");
}
function closeInfoModal() {
  infoModal.classList.remove("open");
  infoModal.setAttribute("aria-hidden", "true");
}
infoClose?.addEventListener("click", closeInfoModal);
infoModal?.addEventListener("click", (e) => {
  if (e.target?.dataset?.close) closeInfoModal();
});

function openQrModal({ title, spd }) {
  lastSpd = spd;
  qrSub.textContent = title;
  qrBox.innerHTML = "";
  // eslint-disable-next-line no-undef
  new QRCode(qrBox, { text: spd, width: 260, height: 260, correctLevel: QRCode.CorrectLevel.M });
  qrModal.classList.add("open");
  qrModal.setAttribute("aria-hidden", "false");
}
function closeQrModal() {
  qrModal.classList.remove("open");
  qrModal.setAttribute("aria-hidden", "true");
}
qrClose?.addEventListener("click", closeQrModal);
qrModal?.addEventListener("click", (e) => {
  if (e.target?.dataset?.close) closeQrModal();
});
qrCopy?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastSpd || "");
    qrCopy.textContent = "Zkopírováno ✓";
    setTimeout(() => (qrCopy.textContent = "Zkopírovat SPD"), 1200);
  } catch {
    alert("Nepodařilo se zkopírovat. Zkus to prosím ručně.");
  }
});
qrDownload?.addEventListener("click", () => {
  const canvas = qrBox.querySelector("canvas");
  if (canvas) {
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-platba.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const img = qrBox.querySelector("img");
  if (img?.src) {
    const a = document.createElement("a");
    a.href = img.src;
    a.download = "qr-platba.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  alert("QR se nepodařilo uložit.");
});

// ---------- participants ----------
function uniqSortedNamesFromRooms(data) {
  const set = new Set();
  for (const room of data.rooms) {
    for (const raw of room.people) {
      const name = (raw || "").trim();
      if (name) set.add(name);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "cs"));
}
function totalCapacity(data) {
  return data.rooms.reduce((sum, r) => sum + (Array.isArray(r.people) ? r.people.length : 0), 0);
}
function filledBeds(data) {
  let n = 0;
  for (const r of data.rooms) for (const p of r.people) if ((p || "").trim()) n++;
  return n;
}

function renderWhoGoes(data) {
  const names = uniqSortedNamesFromRooms(data);
  elWhoChips.innerHTML = "";
  if (names.length === 0) {
    elWhoChips.innerHTML = `<div class="emptyNote">Zatím nikdo není zapsaný v pokojích.</div>`;
    elWhoStat.textContent = "0 potvrzených";
    return;
  }
  for (const name of names) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = name;
    elWhoChips.appendChild(chip);
  }
  elWhoStat.textContent = `${names.length} potvrzených`;
}

function renderRooms(data) {
  elRoomsGrid.innerHTML = "";

  const split = computeDueSplit(data);
  const byRoom = new Map();
  for (const r of split.rows) {
    if (!byRoom.has(r.roomId)) byRoom.set(r.roomId, []);
    byRoom.get(r.roomId).push(r);
  }

  for (const room of data.rooms) {
    const card = document.createElement("div");
    card.className = "card";

    const capacity = room.people.length;
    const filled = room.people.filter(p => (p || "").trim()).length;
    const isFull = filled === capacity && capacity > 0;
    const isEmpty = filled === 0;

    const statusClass = isFull ? "roomStatus full" : isEmpty ? "roomStatus empty" : "roomStatus partial";
    const statusText = isFull ? "Plno" : isEmpty ? "Volno" : "Částečně";

    card.innerHTML = `
      <div class="roomHead">
        <div>
          <h2>${room.name}</h2>
          <div class="meta">${room.type === "kids" ? "Dětský pokoj (sleva 25 % pro osoby 15+)" : "Pokoj s manželskou postelí"}</div>
        </div>
        <div class="${statusClass}">${statusText} · ${filled}/${capacity}</div>
      </div>
      <div class="list"></div>
    `;

    const list = card.querySelector(".list");
    const rows = (byRoom.get(room.id) || []).slice();

    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "row";
      empty.innerHTML = `<div class="meta">Zatím nikdo</div><div class="meta">—</div>`;
      list.appendChild(empty);
    } else {
      for (const p of rows) {
        const tag = p.isKid ? " · sleva 25 %" : "";
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML = `
          <div>
            <div class="who">${p.name}</div>
            <div class="meta">potvrzeno${tag}</div>
          </div>
          <div class="meta">${formatCzk(p.due)}</div>
        `;
        list.appendChild(row);
      }
    }

    elRoomsGrid.appendChild(card);
  }

  elCapStat.textContent = `Obsazeno ${filledBeds(data)}/${totalCapacity(data)}`;
}

/* ---------- Czech account -> IBAN (CZ) for QR SPD ---------- */
function parseCzAccount(acc) {
  const s = (acc || "").trim().replace(/\s+/g, "");
  if (!s.includes("/")) return null;
  const [left, bank] = s.split("/");
  if (!bank || !/^\d{4}$/.test(bank)) return null;

  let prefix = "0";
  let number = left;

  if (left.includes("-")) {
    const [p, n] = left.split("-");
    prefix = p || "0";
    number = n || "";
  }
  if (!/^\d{1,6}$/.test(prefix)) return null;
  if (!/^\d{1,10}$/.test(number)) return null;

  return { bankCode: bank, prefix, accountNumber: number };
}
function mod97(numStr) {
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + (numStr.charCodeAt(i) - 48)) % 97;
  }
  return remainder;
}
function czAccountToIban(acc) {
  const p = parseCzAccount(acc);
  if (!p) return null;
  const bank = p.bankCode.padStart(4, "0");
  const prefix = p.prefix.padStart(6, "0");
  const acct = p.accountNumber.padStart(10, "0");
  const bban = bank + prefix + acct;

  const rearranged = bban + "123500"; // CZ00 -> 12 35 00
  const check = 98 - mod97(rearranged);
  const cd = String(check).padStart(2, "0");
  return `CZ${cd}${bban}`;
}
function buildSpd({ accountCz, amountCzk, message }) {
  const iban = czAccountToIban(accountCz);
  if (!iban) return null;
  const am = (Math.round(Number(amountCzk) || 0)).toFixed(2);
  const msg = encodeURIComponent(String(message || "").trim()).replace(/%20/g, " ");
  return `SPD*1.0*ACC:${iban}*AM:${am}*CC:CZK*MSG:${msg}*`;
}

function renderFinance(data) {
  const ledger = computeFinanceLedger(data);

  elPayAccount.textContent = (data.paymentAccount || "").trim() || "Doplň v Edit stránce";

  elTotal.textContent = formatCzk(data.totalCzk);
  elUnitFull.textContent = ledger.split.unitFull ? formatCzk(ledger.split.unitFull) : "—";
  elUnitKid.textContent = ledger.split.unitKid ? formatCzk(ledger.split.unitKid) : "—";

  elPaid.textContent = formatCzk(ledger.totalPaid);
  elNeed.textContent = formatCzk(ledger.need);
  elSurplus.textContent = formatCzk(ledger.surplus);

  const rows = [...ledger.rows].sort((a, b) => a.name.localeCompare(b.name, "cs"));

  // main table
  payTableBody.innerHTML = "";
  payList.innerHTML = "";

  const account = (data.paymentAccount || "").trim();
  const qrDisabled = !account;

  for (const r of rows) {
    const paidInfoBtn = `<button class="iconTiny" data-info="pay" data-name="${r.name.replace(/"/g,'&quot;')}">i</button>`;
    const refundInfoBtn = `<button class="iconTiny" data-info="ref" data-name="${r.name.replace(/"/g,'&quot;')}">i</button>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.name}${r.isKid ? ` <span class="miniTag">sleva 25%</span>` : ""}</td>
      <td>${r.roomName}</td>
      <td><strong>${formatCzk(r.due)}</strong></td>
      <td class="center">${formatCzk(r.paid)} ${paidInfoBtn}</td>
      <td class="center">
        <strong>${r.balanceText}</strong>
        ${r.suggestedRefund > 0 ? ` ${refundInfoBtn}` : ""}
      </td>
      <td class="center">
        <button class="btn tiny" data-qr="${r.name.replace(/"/g,'&quot;')}" ${qrDisabled ? "disabled" : ""}>QR</button>
      </td>
    `;
    payTableBody.appendChild(tr);

    const card = document.createElement("div");
    card.className = "row";
    card.innerHTML = `
      <div>
        <div class="who">${r.name} ${r.isKid ? `<span class="miniTag">sleva 25%</span>` : ""}</div>
        <div class="meta">${r.roomName}</div>
        <div class="meta">Má platit: ${formatCzk(r.due)}</div>
        <div class="meta">Zaplaceno: ${formatCzk(r.paid)} <button class="iconTiny" data-info="pay" data-name="${r.name.replace(/"/g,'&quot;')}">i</button></div>
        <div class="meta"><strong>${r.balanceText}</strong> ${r.suggestedRefund>0 ? `<button class="iconTiny" data-info="ref" data-name="${r.name.replace(/"/g,'&quot;')}">i</button>` : ""}</div>
      </div>
      <div>
        <button class="btn tiny" data-qr="${r.name.replace(/"/g,'&quot;')}" ${qrDisabled ? "disabled" : ""}>QR</button>
      </div>
    `;
    payList.appendChild(card);
  }

  // refund suggestion table
  refundTableBody.innerHTML = "";
  let anyRefund = false;

  for (const r of rows) {
    const suggested = r.suggestedRefund || 0;
    const already = r.refunded || 0;
    const remain = Math.max(0, suggested - 0); // suggested is "now" amount; actual remaining = suggested, since we propose, not enforce
    if (suggested <= 0) continue;
    anyRefund = true;

    const detailBtn = `<button class="btn tiny" data-info="ref" data-name="${r.name.replace(/"/g,'&quot;')}">Detail</button>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${r.name}</strong></td>
      <td class="center"><strong>${formatCzk(suggested)}</strong></td>
      <td class="center">${formatCzk(already)}</td>
      <td class="center">${formatCzk(remain)}</td>
      <td class="center">${detailBtn}</td>
    `;
    refundTableBody.appendChild(tr);
  }

  refundEmpty.style.display = anyRefund ? "none" : "block";

  // handlers: info
  document.querySelectorAll("button[data-info]").forEach(btn => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-info");
      const name = btn.getAttribute("data-name");
      const row = rows.find(x => x.name === name);
      if (!row) return;

      if (kind === "pay") {
        const list = (row.payments || [])
          .slice()
          .sort((a, b) => String(a.date||"").localeCompare(String(b.date||"")))
          .map(p => `<div class="infoRow"><div>${p.date || "—"}</div><div class="mono">${formatCzk(p.amount)}</div></div>`)
          .join("");
        openInfoModal(`${name} – Platby`, list || `<div class="subSmall">Žádné platby.</div>`);
      } else {
        const list = (row.refunds || [])
          .slice()
          .sort((a, b) => String(a.date||"").localeCompare(String(b.date||"")))
          .map(p => `<div class="infoRow"><div>${p.date || "—"}</div><div class="mono">${formatCzk(p.amount)}</div></div>`)
          .join("");
        const extra = `<div class="subSmall" style="margin-top:10px;">Navržená vratka teď: <strong>${formatCzk(row.suggestedRefund || 0)}</strong></div>`;
        openInfoModal(`${name} – Vratky`, (list || `<div class="subSmall">Zatím nic nebylo vráceno.</div>`) + extra);
      }
    });
  });

  // handlers: QR
  document.querySelectorAll("button[data-qr]").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-qr");
      if (!account) return alert("Chybí číslo účtu – doplň ho v Edit stránce a ulož.");
      const row = rows.find(x => x.name === name);
      if (!row) return;

      const spd = buildSpd({ accountCz: account, amountCzk: row.due, message: row.name });
      if (!spd) return alert("Neplatné číslo účtu. Použij např. 123456789/0100 nebo 19-123456789/0100.");
      openQrModal({ title: `${row.name} · ${formatCzk(row.due)}`, spd });
    });
  });
}

// ---------- Slider ----------
function makeDots(count) {
  dotsWrap.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const d = document.createElement("span");
    d.className = "dot" + (i === 0 ? " active" : "");
    d.addEventListener("click", (ev) => {
      ev.preventDefault();
      setSlide(i);
      restartTimer();
    });
    dotsWrap.appendChild(d);
  }
}
function setActiveDot(idx) {
  const dots = dotsWrap.querySelectorAll(".dot");
  dots.forEach((d, i) => d.classList.toggle("active", i === idx));
}
let slideIndex = 0;
let timer = null;

function tryLoadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}
let usableImages = [];

async function initSlider() {
  if (!slideImg || !dotsWrap) return;

  const checks = await Promise.all(AIRBNB_IMAGES.map(u => tryLoadImage(u)));
  usableImages = AIRBNB_IMAGES.filter((_, i) => checks[i]);
  if (usableImages.length === 0) usableImages = [slideImg.src];

  makeDots(usableImages.length);
  slideIndex = 0;
  setSlide(0);

  if (usableImages.length > 1) startTimer();
}
function setSlide(idx) {
  if (!usableImages.length) return;
  slideIndex = (idx + usableImages.length) % usableImages.length;
  slideImg.src = usableImages[slideIndex];
  setActiveDot(slideIndex);
}
function startTimer() {
  timer = setInterval(() => setSlide(slideIndex + 1), SLIDE_MS);
}
function restartTimer() {
  if (timer) clearInterval(timer);
  if (usableImages.length > 1) startTimer();
}

async function loadAndRender() {
  try {
    const data = await loadDataFromGitHub();
    renderWhoGoes(data);
    renderRooms(data);
    renderFinance(data);
  } catch (e) {
    alert("Nepodařilo se načíst data z GitHubu:\n" + e.message);
  }
}

loadAndRender();
initSlider();
