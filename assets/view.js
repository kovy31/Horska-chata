// assets/view.js
// QR Platba SPD: ACC expects IBAN (we convert Czech account number locally).
// Spec: qr-platba.cz (ACC is IBAN, AM is decimal with dot, CC:CZK, MSG message).  [oai_citation:0‡qr-platba.cz](https://qr-platba.cz/pro-vyvojare/specifikace-formatu/)

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

// Pay box
const elPayAccount = document.getElementById("payAccount");

// Finance KPI
const elTotal = document.getElementById("kpiTotal");
const elUnit = document.getElementById("kpiUnit");
const elSum = document.getElementById("kpiSum");
const elPaid = document.getElementById("kpiPaid");
const elNeed = document.getElementById("kpiNeed");
const elRefund = document.getElementById("kpiRefund");

const payTableBody = document.querySelector("#payTable tbody");
const payList = document.getElementById("payList");

// Slider
const slideImg = document.getElementById("airSlideImg");
const dotsWrap = document.getElementById("airDots");

// QR modal
const qrModal = document.getElementById("qrModal");
const qrClose = document.getElementById("qrClose");
const qrSub = document.getElementById("qrSub");
const qrBox = document.getElementById("qrBox");
const qrDownload = document.getElementById("qrDownload");
const qrCopy = document.getElementById("qrCopy");

let lastSpd = "";

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
  for (const r of data.rooms) {
    for (const p of r.people) if ((p || "").trim()) n++;
  }
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
  const payments = computePayments(data);
  const byRoom = new Map();
  for (const r of payments.rows) {
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

    const isKids = room.type === "kids";
    card.innerHTML = `
      <div class="roomHead">
        <div>
          <h2>${room.name}</h2>
          <div class="meta">${isKids ? "Dětský pokoj · sleva 25 %" : "Pokoj s manželskou postelí"}</div>
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
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML = `
          <div>
            <div class="who">${p.name}</div>
            <div class="meta">potvrzeno</div>
          </div>
          <div class="meta">${formatCzk(p.pay)}</div>
        `;
        list.appendChild(row);
      }
    }

    elRoomsGrid.appendChild(card);
  }

  const cap = totalCapacity(data);
  const filledTotal = filledBeds(data);
  elCapStat.textContent = `Obsazeno ${filledTotal}/${cap}`;
}

/* ---------- Czech account -> IBAN (CZ) ---------- */
function parseCzAccount(acc) {
  // accepts: "123456789/0100" or "19-123456789/0100"
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

  return {
    bankCode: bank,
    prefix: prefix,
    accountNumber: number
  };
}

function mod97(numStr) {
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    const ch = numStr.charCodeAt(i) - 48;
    remainder = (remainder * 10 + ch) % 97;
  }
  return remainder;
}

function czAccountToIban(acc) {
  const p = parseCzAccount(acc);
  if (!p) return null;

  const bank = p.bankCode.padStart(4, "0");
  const prefix = p.prefix.padStart(6, "0");
  const acct = p.accountNumber.padStart(10, "0");
  const bban = bank + prefix + acct; // 20 digits for CZ

  // IBAN check digits:
  // Move country + "00" to end, convert letters (C=12, Z=35)
  // check = 98 - mod97(bban + "123500")
  const rearranged = bban + "123500"; // "CZ00" => C=12 Z=35 + "00"
  const check = 98 - mod97(rearranged);
  const cd = String(check).padStart(2, "0");

  return `CZ${cd}${bban}`;
}

/* ---------- SPD + QR ---------- */
function buildSpd({ accountCz, amountCzk, message }) {
  const iban = czAccountToIban(accountCz);
  if (!iban) return null;

  const am = (Math.round(Number(amountCzk) || 0)).toFixed(2); // 2 decimals with dot
  const msg = encodeURIComponent(String(message || "").trim()).replace(/%20/g, " ");
  // Spec allows URL encoding and MSG field.  [oai_citation:1‡qr-platba.cz](https://qr-platba.cz/pro-vyvojare/specifikace-formatu/)
  return `SPD*1.0*ACC:${iban}*AM:${am}*CC:CZK*MSG:${msg}*`;
}

function openQrModal({ title, spd }) {
  lastSpd = spd;

  qrSub.textContent = title;

  // clear QR
  qrBox.innerHTML = "";
  // QRCode library renders either <canvas> or <img> inside qrBox
  // eslint-disable-next-line no-undef
  new QRCode(qrBox, {
    text: spd,
    width: 260,
    height: 260,
    correctLevel: QRCode.CorrectLevel.M
  });

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
  // Prefer canvas
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

  // fallback to image
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

  alert("QR se nepodařilo uložit (nenašel jsem canvas/img).");
});

function renderFinance(data) {
  // Account number (CZ domestic)
  const account = (data.paymentAccount || "").trim();
  elPayAccount.textContent = account ? account : "Doplní se v Edit stránce";

  const ledger = computeFinanceLedger(data);

  elTotal.textContent = formatCzk(ledger.totalDue);
  elUnit.textContent = ledger.unit ? formatCzk(ledger.unit) : "—";
  elSum.textContent = formatCzk(ledger.totalDue);

  elPaid.textContent = formatCzk(ledger.totalPaid);
  elNeed.textContent = formatCzk(ledger.remainingToCollect);
  elRefund.textContent = formatCzk(ledger.refundTotal);

  const rows = [...ledger.rows].sort((a, b) => a.name.localeCompare(b.name, "cs"));
  payTableBody.innerHTML = "";
  payList.innerHTML = "";

  for (const r of rows) {
    const stateText = r.refund > 0
      ? `Vrátit ${formatCzk(r.refund)}`
      : r.remaining > 0
        ? `Doplatit ${formatCzk(r.remaining)}`
        : "Srovnáno";

    // desktop table row (6 columns)
    const tr = document.createElement("tr");

    const qrBtnDisabled = !account;
    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.roomName}${r.isKids ? " · sleva 25 %" : ""}</td>
      <td><strong>${formatCzk(r.due)}</strong></td>
      <td>${formatCzk(r.paid)}</td>
      <td><strong>${stateText}</strong></td>
      <td>
        <button class="btn tiny" data-qr="${r.name.replace(/"/g, "&quot;")}" ${qrBtnDisabled ? "disabled" : ""}>
          QR
        </button>
      </td>
    `;
    payTableBody.appendChild(tr);

    // mobile row with QR button
    const card = document.createElement("div");
    card.className = "row";
    card.innerHTML = `
      <div>
        <div class="who">${r.name}</div>
        <div class="meta">${r.roomName}${r.isKids ? " · sleva 25 %" : ""}</div>
        <div class="meta">Má platit: ${formatCzk(r.due)} · Zaplaceno: ${formatCzk(r.paid)}</div>
        <div class="meta"><strong>${stateText}</strong></div>
      </div>
      <div>
        <button class="btn tiny" data-qr="${r.name.replace(/"/g, "&quot;")}" ${qrBtnDisabled ? "disabled" : ""}>QR</button>
      </div>
    `;
    payList.appendChild(card);
  }

  // attach QR handlers (both desktop + mobile)
  document.querySelectorAll("button[data-qr]").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-qr");
      if (!account) return alert("Chybí číslo účtu – doplň ho v Edit stránce a ulož.");

      const target = rows.find(x => x.name === name);
      if (!target) return;

      const spd = buildSpd({
        accountCz: account,
        amountCzk: target.due,
        message: target.name // user requested: just name
      });

      if (!spd) {
        alert("Neplatné číslo účtu. Použij formát např. 123456789/0100 nebo 19-123456789/0100.");
        return;
      }

      openQrModal({
        title: `${target.name} · ${formatCzk(target.due)}`,
        spd
      });
    });
  });
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

/* ---------- Slider ---------- */
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

loadAndRender();
initSlider();
