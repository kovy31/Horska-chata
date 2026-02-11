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
const elAirWrap = document.querySelector(".airWrap");

// KPI
const elTotal = document.getElementById("kpiTotal");
const elPaid = document.getElementById("kpiPaid");
const elNeed = document.getElementById("kpiNeed");
const elSurplus = document.getElementById("kpiSurplus");

// Table / list
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

// -------- modal helpers --------
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

// -------- helpers --------
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

function countPeopleByType(rooms) {
  let total = 0;
  let kids = 0;
  for (const r of rooms || []) {
    const isKidsRoom = r.type === "kids";
    for (const p of (r.people || [])) {
      const n = normalizeName(p);
      if (!n) continue;
      total++;
      if (isKidsRoom) kids++;
    }
  }
  return { total, kids, adults: Math.max(0, total - kids) };
}

function priceForFuturePosition(idx) {
  return idx === 0 ? "A" : idx === 1 ? "B" : String(idx + 1);
}

/**
 * Pricing rules:
 * - If n <= 10: everyone share = total/10 (minimum)
 * - If 11 <= n <= 13: everyone share = total/n
 * - If n >= 14: kids share = 0.75 * standardShare, adults share = 1.0 * standardShare
 *   where standardShare = total / (adults + 0.75*kids)
 */
function computeShares(totalCzk, nAdults, nKids) {
  const total = Math.round(Number(totalCzk) || 0);
  const n = Math.max(0, nAdults + nKids);

  // minimum "lákací" cena
  if (n <= 10) {
    const per = total / 10;
    return { mode: "min10", standard: per, kids: per, adults: per };
  }

  if (n <= 13) {
    const per = total / n;
    return { mode: "divide", standard: per, kids: per, adults: per };
  }

  // >= 14, kids discount 25%
  const weight = (nAdults + 0.75 * nKids);
  const std = weight > 0 ? (total / weight) : 0;
  return { mode: "kids25", standard: std, kids: 0.75 * std, adults: std };
}

function roundCzk(x) {
  // keep it clean, round to whole CZK
  return Math.round(Number(x) || 0);
}

/**
 * Returns price for a person in a given room type under:
 * - current counts (actual)
 * - or hypothetical counts if someone joins an empty slot
 */
function priceForRoomType(totalCzk, rooms, roomType, addOneToThatSlot) {
  const { total, kids, adults } = countPeopleByType(rooms);
  const add = addOneToThatSlot ? 1 : 0;

  let nKids = kids;
  let nAdults = adults;

  if (addOneToThatSlot) {
    if (roomType === "kids") nKids += 1;
    else nAdults += 1;
  }

  const shares = computeShares(totalCzk, nAdults, nKids);
  const p = (roomType === "kids") ? shares.kids : shares.adults;
  return { shares, price: roundCzk(p), totalPeople: nAdults + nKids };
}

// -------- airNote layout (desktop right / mobile under) --------
function ensureAirHousingLayout() {
  if (!elAirNote || !elAirWrap) return;

  // Create wrapper once and move nodes
  let row = document.getElementById("airHousingRow");
  if (!row) {
    row = document.createElement("div");
    row.id = "airHousingRow";
    // insert row where airNote currently is (airNote exists in DOM already)
    const parent = elAirWrap.parentElement;
    parent.insertBefore(row, elAirWrap); // place before airWrap

    // move airWrap into row
    row.appendChild(elAirWrap);
    // move airNote into row (right on desktop)
    row.appendChild(elAirNote);
  }

  // Apply responsive inline styles
  const mq = window.matchMedia("(min-width: 900px)");
  const apply = () => {
    if (mq.matches) {
      // desktop: card left, note right
      row.style.display = "flex";
      row.style.gap = "16px";
      row.style.alignItems = "flex-start";
      row.style.justifyContent = "center";
      elAirWrap.style.margin = "28px 0 12px";
      elAirWrap.style.flex = "0 0 auto";

      elAirNote.style.margin = "28px 0 0";
      elAirNote.style.maxWidth = "360px";
      elAirNote.style.width = "100%";
      elAirNote.style.flex = "0 1 360px";
    } else {
      // mobile: note under card
      row.style.display = "block";
      row.style.gap = "";
      row.style.alignItems = "";
      row.style.justifyContent = "";

      elAirWrap.style.margin = "28px 0 8px";
      elAirNote.style.margin = "10px auto 0";
      elAirNote.style.maxWidth = "560px";
      elAirNote.style.width = "";
      elAirNote.style.flex = "";
    }
  };

  apply();
  // keep updated on resize
  mq.addEventListener?.("change", apply);
}

// -------- render: who goes --------
function renderWhoGoes(data) {
  const names = uniqSortedNamesFromRooms(data.rooms);
  elWhoChips.innerHTML = names.map(n => `<span class="chip">${n}</span>`).join("");
  elWhoStat.textContent = `${names.length} osob`;
}

// -------- render: rooms (with estimates for empty slots) --------
function renderRooms(data) {
  elRoomsGrid.innerHTML = "";

  const cap = totalCapacity(data.rooms);
  const used = filledBeds(data.rooms);
  elCapStat.textContent = `${used}/${cap} obsazeno`;

  const total = Math.round(Number(data.totalCzk) || 0);

  for (const r of data.rooms || []) {
    const roomType = r.type === "kids" ? "kids" : "adult";
    const people = (r.people || []).map(x => normalizeName(x));

    const bedsHtml = people.map((p, i) => {
      const label = priceForFuturePosition(i);

      if (p) {
        // confirmed person -> show current computed price for their room type
        const cur = priceForRoomType(total, data.rooms, r.type === "kids" ? "kids" : "adult", false);
        const priceText = formatCzk(cur.price);
        const hint = (cur.shares.mode === "kids25" && r.type === "kids")
          ? `Cena: ${priceText} · sleva dětský pokoj`
          : `Cena: ${priceText}`;

        return `
          <div class="bed">
            <div>
              <div class="bedName">${p}</div>
              <div class="bedHint">${hint} · Místo ${label}</div>
            </div>
          </div>`;
      }

      // empty slot -> show estimate if someone joins this slot
      const hypo = priceForRoomType(total, data.rooms, r.type === "kids" ? "kids" : "adult", true);
      const est = formatCzk(hypo.price);
      const extra =
        hypo.shares.mode === "min10"
          ? "minimum (celkem/10)"
          : hypo.shares.mode === "divide"
            ? `děleno ${hypo.totalPeople} lidmi`
            : (r.type === "kids" ? "sleva dětský pokoj -25%" : `od ${hypo.totalPeople} lidí`);

      return `
        <div class="bed">
          <div>
            <div class="bedName">—</div>
            <div class="bedHint">Odhad: <b>${est}</b> · ${extra} · Místo ${label}</div>
          </div>
        </div>`;
    }).join("");

    const card = document.createElement("div");
    card.className = "roomCard";
    card.innerHTML = `
      <div class="roomTop">
        <div>
          <div class="roomName">${r.name || "Pokoj"}</div>
          <div class="roomMeta">${r.type === "kids" ? "Dětský pokoj (horší úroveň)" : "Dvoulůžko"}</div>
        </div>
      </div>
      <div class="beds">${bedsHtml}</div>
    `;
    elRoomsGrid.appendChild(card);
  }
}

// -------- QR: render via QR API to canvas (always works) --------
async function drawQrToCanvas(canvas, text) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Using public QR generator (PNG) -> draw to canvas
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${canvas.width}x${canvas.height}&data=${encodeURIComponent(text)}`;

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve();
    };
    img.onerror = () => {
      ctx.font = "12px monospace";
      ctx.fillText("QR se nepodařilo načíst", 10, 24);
      reject(new Error("QR load failed"));
    };
    img.src = url;
  }).catch(() => {});
}

// -------- finance helpers (SPD) --------
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

// convert CZ account to IBAN (basic)
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

// SPD amount must be in CZK with 2 decimals (not haléře)
function buildSpd({ iban, amountCzk, msg }) {
  const a = Math.max(0, Number(amountCzk) || 0);
  const m = (msg || "").trim();
  const parts = [
    "SPD",
    "1.0",
    `ACC:${iban}`,
    `AM:${a.toFixed(2)}`,
    "CC:CZK",
  ];
  if (m) parts.push(`MSG:${m}`);
  return parts.join("*");
}

// -------- render finance (table + QR + modals) --------
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

  // room for each name
  const nameToRoom = new Map();
  const nameToType = new Map(); // kids/adult by room type
  for (const r of data.rooms || []) {
    for (const p of (r.people || [])) {
      const n = normalizeName(p);
      if (n) {
        nameToRoom.set(n, r.name || "—");
        nameToType.set(n, r.type === "kids" ? "kids" : "adult");
      }
    }
  }

  payTableBody.innerHTML = "";
  payList.innerHTML = "";

  // precompute current share amounts
  const { kids, adults } = countPeopleByType(data.rooms);
  const sharesNow = computeShares(total, adults, kids);

  function shouldPayFor(name) {
    const t = nameToType.get(name) === "kids" ? "kids" : "adult";
    const raw = t === "kids" ? sharesNow.kids : sharesNow.adults;
    return roundCzk(raw);
  }

  for (const name of names) {
    const rec = data.people?.[name] || { payments: [], refunds: [] };
    const paidOne = (rec.payments || []).reduce((s, x) => s + (Math.round(Number(x.amount) || 0)), 0);

    const room = nameToRoom.get(name) || "—";
    const mustPay = shouldPayFor(name);

    const delta = paidOne - mustPay; // + means overpaid
    const deltaText =
      delta === 0 ? "OK" :
        (delta > 0 ? `+${formatCzk(delta)}` : `-${formatCzk(Math.abs(delta))}`);

    // QR if needs to pay
    let qrBtn = "";
    if (delta < 0 && data.paymentAccount) {
      const parsed = parseCzAccount(data.paymentAccount);
      if (parsed) {
        const iban = czAccountToIban(parsed.prefix, parsed.number, parsed.bank);
        const toPay = Math.abs(delta);
        const spd = buildSpd({ iban, amountCzk: toPay, msg: name });
        qrBtn = `<button class="btn" data-qr="1" data-name="${name}" data-amount="${toPay}" data-spd="${spd}">QR</button>`;
      }
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td class="center">${room}</td>
      <td class="center">${formatCzk(mustPay)}</td>
      <td class="center">${formatCzk(paidOne)}</td>
      <td class="center"><button class="btn" data-info="1" data-name="${name}">${deltaText}</button></td>
      <td class="center">${qrBtn || "—"}</td>
    `;
    payTableBody.appendChild(tr);

    // mobile card
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
      <div class="subSmall" style="margin-top:8px;">
        Má platit: <b>${formatCzk(mustPay)}</b> · Zaplaceno: <b>${formatCzk(paidOne)}</b>
      </div>
      <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn" data-info="1" data-name="${name}">Detail</button>
        ${qrBtn || ""}
      </div>
    `;
    payList.appendChild(div);
  }

  // info modal
  document.querySelectorAll("[data-info='1']").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      const rec = data.people?.[name] || { payments: [], refunds: [] };

      const p = (rec.payments || [])
        .map(x => `<li>${formatCzk(x.amount)} · ${x.date || "—"}</li>`)
        .join("") || "<li>—</li>";

      const r = (rec.refunds || [])
        .map(x => `<li>${formatCzk(x.amount)} · ${x.date || "—"}</li>`)
        .join("") || "<li>—</li>";

      const mustPay = shouldPayFor(name);
      openInfoModal("Vyrovnání", name, `
        <div><b>Má platit:</b> ${formatCzk(mustPay)}</div>
        <div style="margin-top:10px;"><b>Platby</b><ul>${p}</ul></div>
        <div style="margin-top:10px;"><b>Vratky</b><ul>${r}</ul></div>
      `);
    });
  });

  // QR modal
  document.querySelectorAll("[data-qr='1']").forEach(btn => {
    btn.addEventListener("click", async () => {
      const name = btn.getAttribute("data-name");
      const amount = Number(btn.getAttribute("data-amount") || 0);
      const spd = btn.getAttribute("data-spd") || "";
      if (!spd) return;

      await drawQrToCanvas(qrCanvas, spd);
      openQrModal(`${name} · ${formatCzk(amount)}`, spd);
    });
  });
}
