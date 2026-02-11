// assets/view.js
// Renders: rooms, who goes, finance + QR + modals, and Airbnb slider

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

const SLIDE_MS = 4200;

// DOM
const elRoomsGrid = document.getElementById("roomsGrid");
const elWhoChips = document.getElementById("whoChips");
const elWhoStat = document.getElementById("whoStat");
const elCapStat = document.getElementById("capStat");

const elPayAccount = document.getElementById("payAccount");
const elAirNote = document.getElementById("airNoteText");

// KPI
const elTotal = document.getElementById("kpiTotal");
const elPaid = document.getElementById("kpiPaid");
const elNeed = document.getElementById("kpiNeed");
const elSurplus = document.getElementById("kpiSurplus");

const payTableBody = document.querySelector("#payTable tbody");
const payList = document.getElementById("payList");

// Slider
const slideImg = document.getElementById("airSlideImg");
const dotsWrap = document.getElementById("airDots");

// Modals
const infoModal = document.getElementById("infoModal");
const infoTitle = document.getElementById("infoTitle");
const infoSub = document.getElementById("infoSub");
const infoBody = document.getElementById("infoBody");
const infoCloseBtn = document.getElementById("infoCloseBtn");

const qrModal = document.getElementById("qrModal");
const qrSub = document.getElementById("qrSub");
const qrCanvas = document.getElementById("qrCanvas");
const qrSpd = document.getElementById("qrSpd");
const qrCloseBtn = document.getElementById("qrCloseBtn");

function openInfoModal(title, sub, bodyHtml) {
  infoTitle.textContent = title || "Vyrovnání";
  infoSub.textContent = sub || "—";
  infoBody.innerHTML = bodyHtml || "—";
  infoModal.setAttribute("aria-hidden", "false");
}
function closeInfoModal() { infoModal.setAttribute("aria-hidden", "true"); }

function openQrModal(subText, spdText) {
  qrSub.textContent = subText || "—";
  qrSpd.textContent = spdText || "—";
  qrModal.setAttribute("aria-hidden", "false");
}
function closeQrModal() { qrModal.setAttribute("aria-hidden", "true"); }

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t && t.dataset && t.dataset.close) {
    closeInfoModal();
    closeQrModal();
  }
});

infoCloseBtn?.addEventListener("click", closeInfoModal);
qrCloseBtn?.addEventListener("click", closeQrModal);

// ---- helpers ----
function uniqSortedNamesFromRooms(rooms) {
  const set = new Set();
  for (const r of rooms || []) {
    for (const p of (r.people || [])) {
      const n = normalizeName(p);
      if (n) set.add(n);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "cs"));
}

function totalCapacity(rooms) {
  let cap = 0;
  for (const r of rooms || []) cap += Array.isArray(r.people) ? r.people.length : 0;
  return cap;
}
function filledBeds(rooms) {
  let used = 0;
  for (const r of rooms || []) {
    for (const p of (r.people || [])) if (normalizeName(p)) used++;
  }
  return used;
}

// ---- render: who goes ----
function renderWhoGoes(data) {
  const names = uniqSortedNamesFromRooms(data.rooms);
  elWhoChips.innerHTML = names.map(n => `<span class="chip">${n}</span>`).join("");
  elWhoStat.textContent = `${names.length} osob`;
}

// ---- rooms ----
function priceForFuturePosition(idx) {
  return idx === 0 ? "A" : idx === 1 ? "B" : String(idx + 1);
}

function renderRooms(data) {
  elRoomsGrid.innerHTML = "";
  const cap = totalCapacity(data.rooms);
  const used = filledBeds(data.rooms);
  elCapStat.textContent = `${used}/${cap} obsazeno`;

  for (const r of data.rooms || []) {
    const people = (r.people || []).map(x => normalizeName(x));
    const bedsHtml = people.map((p, i) => {
      const label = priceForFuturePosition(i);
      return `
        <div class="bed">
          <div>
            <div class="bedName">${p || "—"}</div>
            <div class="bedHint">Místo ${label}</div>
          </div>
        </div>`;
    }).join("");

    const card = document.createElement("div");
    card.className = "roomCard";
    card.innerHTML = `
      <div class="roomTop">
        <div>
          <div class="roomName">${r.name || "Pokoj"}</div>
          <div class="roomMeta">${r.type === "kids" ? "Dětský pokoj" : "Dvoulůžko"}</div>
        </div>
      </div>
      <div class="beds">${bedsHtml}</div>
    `;
    elRoomsGrid.appendChild(card);
  }
}

// ---- finance helpers ----
function parseCzAccount(acc) {
  const t = (acc || "").trim();
  const m = t.match(/^(\d{1,10})\/(\d{4})$/);
  if (m) return { prefix: "", number: m[1], bank: m[2] };
  const m2 = t.match(/^(\d{1,6})-(\d{1,10})\/(\d{4})$/);
  if (m2) return { prefix: m2[1], number: m2[2], bank: m2[3] };
  return null;
}

// mod97
function mod97(ibanNumeric) {
  let rem = 0;
  for (const ch of ibanNumeric) {
    rem = (rem * 10 + (ch.charCodeAt(0) - 48)) % 97;
  }
  return rem;
}

// convert CZ account to IBAN
function czAccountToIban(prefix, number, bank) {
  const pad = (s, len) => String(s || "").padStart(len, "0");
  const bban = pad(bank, 4) + pad(prefix, 6) + pad(number, 10);
  const country = "CZ";
  const check = "00";
  const rearr = bban + country + check;
  let numeric = "";
  for (const c of rearr) {
    if (c >= "A" && c <= "Z") numeric += String(c.charCodeAt(0) - 55);
    else numeric += c;
  }
  const r = mod97(numeric);
  const cd = String(98 - r).padStart(2, "0");
  return country + cd + bban;
}

function buildSpd({ iban, amount, msg }) {
  const a = Math.round(Number(amount) || 0);
  const m = (msg || "").trim();
  const parts = [
    "SPD",
    "1.0",
    `ACC:${iban}`,
    `AM:${(a / 100).toFixed(2)}`,
    "CC:CZK",
  ];
  if (m) parts.push(`MSG:${m}`);
  return parts.join("*");
}

// ---- render finance ----
function renderFinance(data) {
  elPayAccount.textContent = data.paymentAccount ? data.paymentAccount : "—";

  const total = Math.round(Number(data.totalCzk) || 0);
  let paid = 0;
  let refunded = 0;

  for (const rec of Object.values(data.people || {})) {
    for (const p of (rec.payments || [])) paid += Math.round(Number(p.amount) || 0);
    for (const r of (rec.refunds || [])) refunded += Math.round(Number(r.amount) || 0);
  }

  const need = Math.max(0, total - paid);
  const surplus = Math.max(0, paid - total);

  elTotal.textContent = formatCzk(total);
  elPaid.textContent = formatCzk(paid);
  elNeed.textContent = formatCzk(need);
  elSurplus.textContent = formatCzk(surplus);

  const names = uniqSortedNamesFromRooms(data.rooms);
  const count = Math.max(1, names.length);
  const per = Math.round(total / count);

  const nameToRoom = new Map();
  for (const r of data.rooms || []) {
    for (const p of (r.people || [])) {
      const n = normalizeName(p);
      if (n) nameToRoom.set(n, r.name || "—");
    }
  }

  payTableBody.innerHTML = "";
  payList.innerHTML = "";

  for (const name of names) {
    const rec = data.people?.[name] || { payments: [], refunds: [] };
    const paidOne = (rec.payments || []).reduce((s, x) => s + (Math.round(Number(x.amount) || 0)), 0);
    const room = nameToRoom.get(name) || "—";

    const delta = paidOne - per;
    const deltaText = delta === 0 ? "OK" : (delta > 0 ? `+${formatCzk(delta)}` : `-${formatCzk(Math.abs(delta))}`);

    let qrBtn = "";
    if (delta < 0 && data.paymentAccount) {
      const parsed = parseCzAccount(data.paymentAccount);
      if (parsed) {
        const iban = czAccountToIban(parsed.prefix, parsed.number, parsed.bank);
        const spd = buildSpd({ iban, amount: Math.abs(delta), msg: name });
        qrBtn = `<button class="btn" data-qr="1" data-name="${name}" data-amount="${Math.abs(delta)}" data-spd="${spd}">QR</button>`;
      }
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td class="center">${room}</td>
      <td class="center">${formatCzk(per)}</td>
      <td class="center">${formatCzk(paidOne)}</td>
      <td class="center"><button class="btn" data-info="1" data-name="${name}">${deltaText}</button></td>
      <td class="center">${qrBtn || "—"}</td>
    `;
    payTableBody.appendChild(tr);

    const div = document.createElement("div");
    div.className = "roomCard";
    div.innerHTML = `
      <div class="roomTop">
        <div>
          <div class="roomName">${name}</div>
          <div class="roomMeta">${room}</div>
        </div>
        <div class="roomName">${deltaText}</div>
      </div>
      <div class="subSmall" style="margin-top:8px;">Má platit: <b>${formatCzk(per)}</b> · Zaplaceno: <b>${formatCzk(paidOne)}</b></div>
      <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" data-info="1" data-name="${name}">Detail</button>
        ${qrBtn || ""}
      </div>
    `;
    payList.appendChild(div);
  }

  document.querySelectorAll("[data-info='1']").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      const rec = data.people?.[name] || { payments: [], refunds: [] };
      const p = (rec.payments || []).map(x => `<li>${formatCzk(x.amount)} · ${x.date || "—"}</li>`).join("") || "<li>—</li>";
      const r = (rec.refunds || []).map(x => `<li>${formatCzk(x.amount)} · ${x.date || "—"}</li>`).join("") || "<li>—</li>";
      openInfoModal("Vyrovnání", name, `
        <div><b>Platby</b><ul>${p}</ul></div>
        <div style="margin-top:10px;"><b>Vratky</b><ul>${r}</ul></div>
      `);
    });
  });

  document.querySelectorAll("[data-qr='1']").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      const amount = Number(btn.getAttribute("data-amount") || 0);
      const spd = btn.getAttribute("data-spd") || "";
      if (!spd) return;

      const ctx = qrCanvas.getContext("2d");
      ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);

      if (window.QRCode && window.QRCode.toCanvas) {
        window.QRCode.toCanvas(qrCanvas, spd, { width: 240 }, () => {});
      } else {
        ctx.font = "12px monospace";
        ctx.fillText("QR knihovna chybí", 10, 24);
      }

      openQrModal(`${name} · ${formatCzk(amount)}`, spd);
    });
  });
}

// ---- slider ----
function makeDots(n) {
  dotsWrap.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const d = document.createElement("span");
    d.className = "dot" + (i === 0 ? " active" : "");
    d.addEventListener("click", () => { setSlide(i); restartTimer(); });
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
  if (!usableImages.length || !slideImg) return;
  slideIndex = (idx + usableImages.length) % usableImages.length;
  slideImg.src = usableImages[slideIndex];
  setActiveDot(slideIndex);
}
function startTimer() { timer = setInterval(() => setSlide(slideIndex + 1), SLIDE_MS); }
function restartTimer() {
  if (timer) clearInterval(timer);
  if (usableImages.length > 1) startTimer();
}

async function loadAndRender() {
  try {
    const data = await loadDataFromGitHub();

    if (elAirNote) {
      const t = (data.airNote || "").trim();
      elAirNote.innerHTML = t ? t : "";
      elAirNote.style.display = t ? "block" : "none";
    }

    renderWhoGoes(data);
    renderRooms(data);
    renderFinance(data);
    await initSlider();
  } catch (e) {
    console.error(e);
    alert("Nepodařilo se načíst data z GitHub Issue:\n" + e.message);
  }
}

loadAndRender();
