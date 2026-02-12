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

const elPriceScaleBody = document.getElementById("priceScaleBody");
const elBannerWrap = document.getElementById("bannerWrap");
const elMapWrap = document.getElementById("mapWrap");

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

function priceForFuturePosition(idx) {
  return idx === 0 ? "A" : idx === 1 ? "B" : String(idx + 1);
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

/**
 * Returns price for a hypothetical Nth empty slot,
 * given extra adults/kids already counted before this slot.
 */
function priceForNthEmpty(totalCzk, rooms, roomType, extraAdults, extraKids) {
  const { kids, adults } = countPeopleByType(rooms);
  const nAdults = adults + extraAdults;
  const nKids = kids + extraKids;
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
      elAirWrap.style.margin = "14px 0 0";
      elAirWrap.style.flex = "0 0 auto";

      elAirNote.style.margin = "14px 0 0";
      elAirNote.style.maxWidth = "360px";
      elAirNote.style.width = "100%";
      elAirNote.style.flex = "0 1 360px";
    } else {
      // mobile: note under card
      row.style.display = "block";
      row.style.gap = "";
      row.style.alignItems = "";
      row.style.justifyContent = "";

      elAirWrap.style.margin = "14px 0 0";
      elAirNote.style.margin = "8px auto 0";
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

// -------- render: price scale (collapsible info + table) --------
function renderPriceScale(data) {
  if (!elPriceScaleBody) return;

  const total = Math.round(Number(data.totalCzk) || 0);
  const { total: currentN } = countPeopleByType(data.rooms);
  const cap = totalCapacity(data.rooms);

  // Build price table rows for 10..cap people
  let tableRows = "";
  for (let n = 10; n <= cap; n++) {
    // Assume worst case: all adults (no kids discount) for standard price
    const sharesAdult = computeShares(total, n, 0);
    const priceAdult = roundCzk(sharesAdult.adults);

    // For kids room price (assume at least 1 kid at this count)
    const sharesKids = computeShares(total, n - 1, 1);
    const priceKids = roundCzk(sharesKids.kids);

    const isCurrent = n === currentN;
    const highlight = isCurrent ? ' style="background:var(--accent);color:#000;font-weight:700;"' : "";
    const marker = isCurrent ? " (aktuálně)" : "";

    const kidsCell = sharesKids.mode === "kids25"
      ? `<td class="center">${formatCzk(priceKids)}</td>`
      : `<td class="center" style="opacity:.4">—</td>`;

    tableRows += `<tr${highlight}>
      <td class="center">${n} osob${marker}</td>
      <td class="center">${formatCzk(priceAdult)}</td>
      ${kidsCell}
      <td class="center">${sharesAdult.mode === "min10" ? "min. cena (celkem\u00f710)" : sharesAdult.mode === "kids25" ? "d\u011btsk\u00fd \u221225 %" : "d\u011bleno " + n}</td>
    </tr>`;
  }

  elPriceScaleBody.innerHTML = `
    <div style="line-height:1.7; margin-bottom:18px;">
      <p>Aby bylo v\u0161echno f\u00e9r a bez zbyte\u010dn\u00fdch nedorozum\u011bn\u00ed, tady je jednoduch\u00e9 vysv\u011btlen\u00ed, jak budeme \u0159e\u0161it pokoje a pen\u00edze.</p>

      <h3>\ud83d\udecf Pokoje</h3>
      <p>M\u00e1me:<br>
      \u2022 7 standardn\u00edch pokoj\u016f \u2013 ka\u017ed\u00fd s man\u017eelskou postel\u00ed (pro 2 osoby)<br>
      \u2022 1 d\u011btsk\u00fd pokoj \u2013 2 palandy (4 samostatn\u00e1 l\u016f\u017eka)</p>
      <p>Standardn\u00ed pokoje jsou hlavn\u011b pro p\u00e1ry.<br>
      D\u011btsk\u00fd pokoj je ide\u00e1ln\u00ed pro jednotlivce nebo kamar\u00e1dy.</p>

      <h3>\ud83d\udc64 Kdy\u017e jede n\u011bkdo s\u00e1m</h3>
      <p>Pokud jede\u0161 single:<br>
      \u2022 m\u016f\u017ee\u0161 se domluvit s n\u011bk\u00fdm dal\u0161\u00edm a sd\u00edlet standardn\u00ed pokoj,<br>
      \u2022 nebo m\u016f\u017ee\u0161 b\u00fdt v d\u011btsk\u00e9m pokoji.</p>
      <p>Nechceme, aby byly dva standardn\u00ed pokoje obsazen\u00e9 po jednom \u010dlov\u011bku, kdy\u017e se ti dva lid\u00e9 m\u016f\u017eou d\u00e1t dohromady.<br>
      C\u00edlem je vyu\u017e\u00edt pokoje rozumn\u011b.</p>

      <h3>\ud83d\udc91 P\u00e1ry maj\u00ed p\u0159ednost</h3>
      <p>Proto\u017ee standardn\u00ed pokoje maj\u00ed man\u017eelsk\u00e9 postele a v\u00edc soukrom\u00ed, tak pokud bude v\u00edc p\u00e1r\u016f, maj\u00ed p\u0159ednost ve standardn\u00edch pokoj\u00edch.</p>
      <p>Kdy\u017e bude n\u011bkdo s\u00e1m ve standardn\u00edm pokoji a objev\u00ed se p\u00e1r, m\u016f\u017ee b\u00fdt p\u0159esunut do d\u011btsk\u00e9ho pokoje \u2014 pokud si mezit\u00edm nenajde spolubydl\u00edc\u00edho.<br>
      Nic osobn\u00edho \u2013 jde jen o f\u00e9rov\u00e9 rozd\u011blen\u00ed.</p>

      <h3>\ud83d\udd04 Rozd\u011blen\u00ed se m\u016f\u017ee upravit</h3>
      <p>Zapisov\u00e1n\u00ed do pokoj\u016f ber jako orienta\u010dn\u00ed. Pokud se po\u010det lid\u00ed zm\u011bn\u00ed, m\u016f\u017eeme pokoje je\u0161t\u011b p\u0159eskl\u00e1dat tak, aby to d\u00e1valo smysl v\u0161em.<br>
      Kone\u010dn\u00e9 rozd\u011blen\u00ed potvrd\u00edme a\u017e podle fin\u00e1ln\u00ed \u00fa\u010dasti.</p>

      <h3>\ud83d\udcb0 Jak se po\u010d\u00edt\u00e1 cena</h3>
      <p>Cena za osobu se odv\u00edj\u00ed od celkov\u00e9 ceny ubytov\u00e1n\u00ed a po\u010dtu lid\u00ed.<br>
      \u2022 Do 10 lid\u00ed se cena po\u010d\u00edt\u00e1 jako celkov\u00e1 \u010d\u00e1stka d\u011blen\u00e1 10 (aby nebyla p\u0159ehnan\u011b vysok\u00e1).<br>
      \u2022 Od 11 lid\u00ed se cena d\u011bl\u00ed skute\u010dn\u00fdm po\u010dtem osob.<br>
      \u2022 Od 15 lid\u00ed m\u00e1 d\u011btsk\u00fd pokoj slevu 25 %.</p>
      <p><b>\u010c\u00edm v\u00edc n\u00e1s pojede, t\u00edm ni\u017e\u0161\u00ed cena vyjde.</b></p>
      <p>V aplikaci v\u017edy vid\u00ed\u0161:<br>
      \u2022 kolik m\u00e1\u0161 platit,<br>
      \u2022 kolik u\u017e jsi zaplatil,<br>
      \u2022 p\u0159\u00edpadn\u00fd nedoplatek nebo p\u0159eplatek.</p>

      <h3>\ud83c\udfe6 Platby a vratky</h3>
      <p>Ka\u017ed\u00fd m\u00e1 p\u0159ehled:<br>
      \u2022 \u201eM\u00e1 platit\u201c = tvoje aktu\u00e1ln\u00ed \u010d\u00e1stka<br>
      \u2022 \u201eZaplaceno\u201c = co u\u017e jsi poslal<br>
      \u2022 Pokud vznikne p\u0159eplatek, vy\u0159e\u0161\u00ed se vratka.</p>
      <p>QR k\u00f3d ti umo\u017en\u00ed zaplatit rovnou spr\u00e1vnou \u010d\u00e1stku.</p>

      <h3>\ud83e\udd1d Shrnut\u00ed</h3>
      <p>Nejde o p\u0159\u00edsn\u00e1 pravidla, ale o to, aby:<br>
      \u2022 m\u011bli p\u00e1ry soukrom\u00ed,<br>
      \u2022 pokoje byly vyu\u017eit\u00e9 rozumn\u011b,<br>
      \u2022 cena byla f\u00e9rov\u00e1,<br>
      \u2022 a nikdo nem\u011bl pocit, \u017ee na n\u011bj n\u011bco zbylo.</p>
      <p>V\u0161echno je o domluv\u011b a pohod\u011b \u2764\ufe0f</p>
    </div>

    <h3 style="margin-bottom:8px;">Cenov\u00fd p\u0159ehled podle po\u010dtu lid\u00ed</h3>
    <div style="overflow-x:auto;">
      <table class="table">
        <thead>
          <tr>
            <th>Po\u010det lid\u00ed</th>
            <th>Cena / osoba</th>
            <th>D\u011btsk\u00fd pokoj</th>
            <th>Pozn\u00e1mka</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}

// -------- render: rooms (with estimates for empty slots) --------
function renderRooms(data) {
  elRoomsGrid.innerHTML = "";

  const cap = totalCapacity(data.rooms);
  const used = filledBeds(data.rooms);
  elCapStat.textContent = `${used}/${cap} obsazeno`;

  const total = Math.round(Number(data.totalCzk) || 0);

  // count per type for the stat line
  let doubleUsed = 0, doubleCap = 0, kidsUsed = 0, kidsCap = 0;
  for (const r of data.rooms || []) {
    const ppl = (r.people || []);
    const filled = ppl.filter(p => normalizeName(p)).length;
    if (r.type === "kids") { kidsUsed += filled; kidsCap += ppl.length; }
    else { doubleUsed += filled; doubleCap += ppl.length; }
  }

  // 1st pass: collect all empty slots in order to assign incremental pricing
  const currentCounts = countPeopleByType(data.rooms);
  const emptySlots = []; // { roomIdx, slotIdx, roomType }
  const roomsNormalized = (data.rooms || []).map(r => ({
    ...r,
    rType: r.type === "kids" ? "kids" : "adult",
    people: (r.people || []).map(x => normalizeName(x)),
  }));

  for (let ri = 0; ri < roomsNormalized.length; ri++) {
    const r = roomsNormalized[ri];
    for (let si = 0; si < r.people.length; si++) {
      if (!r.people[si]) {
        emptySlots.push({ roomIdx: ri, slotIdx: si, roomType: r.rType });
      }
    }
  }

  // Pre-compute price for each empty slot position (cumulative)
  const emptySlotPrices = new Map(); // key: "ri-si" -> { price, shares, totalPeople }
  let extraAdults = 0, extraKids = 0;
  for (const slot of emptySlots) {
    if (slot.roomType === "kids") extraKids++;
    else extraAdults++;
    const hypo = priceForNthEmpty(total, data.rooms, slot.roomType, extraAdults, extraKids);
    emptySlotPrices.set(`${slot.roomIdx}-${slot.slotIdx}`, hypo);
  }

  // 2nd pass: render room cards
  for (let ri = 0; ri < roomsNormalized.length; ri++) {
    const r = roomsNormalized[ri];
    const origRoom = data.rooms[ri];
    const people = r.people;
    const roomFilled = people.filter(Boolean).length;

    const bedsHtml = people.map((p, i) => {
      const label = priceForFuturePosition(i);

      if (p) {
        // confirmed person -> show current computed price for their room type
        const cur = priceForRoomType(total, data.rooms, r.rType, false);
        const priceText = formatCzk(cur.price);
        const hint = (cur.shares.mode === "kids25" && origRoom.type === "kids")
          ? `${priceText} · sleva dětský pokoj`
          : priceText;

        return `
          <div class="bed bed--filled">
            <div class="bedIcon">&#10003;</div>
            <div>
              <div class="bedName">${p}</div>
              <div class="bedHint">${hint} · Místo ${label}</div>
            </div>
          </div>`;
      }

      // empty slot -> show estimate based on cumulative position
      const key = `${ri}-${i}`;
      const hypo = emptySlotPrices.get(key);
      const est = formatCzk(hypo.price);
      const personNum = hypo.totalPeople;
      const isKidsDiscount = hypo.shares.mode === "kids25" && origRoom.type === "kids";
      const extra =
        hypo.shares.mode === "min10"
          ? `min. cena (celkem÷10)`
          : isKidsDiscount
            ? `jako ${personNum}. osoba · sleva dětský −25 %`
            : `jako ${personNum}. osoba`;

      return `
        <div class="bed bed--empty">
          <div class="bedIcon bedIconEmpty">?</div>
          <div>
            <div class="bedName bedNameEmpty">zatím volno</div>
            <div class="bedHint">Odhad: <b>${est}</b> · ${extra} · Místo ${label}</div>
          </div>
        </div>`;
    }).join("");

    const typeLabel = origRoom.type === "kids" ? "Dětský pokoj (nižší komfort)" : "Dvoulůžko (standard)";
    const occupancy = `${roomFilled}/${people.length}`;

    const card = document.createElement("div");
    card.className = "roomCard";
    card.innerHTML = `
      <div class="roomTop">
        <div>
          <div class="roomName">${origRoom.name || "Pokoj"}</div>
          <div class="roomMeta">${typeLabel}</div>
        </div>
        <span class="roomOccupancy">${occupancy}</span>
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
    const deltaClass = delta === 0 ? "settlement-ok" : (delta > 0 ? "settlement-over" : "settlement-under");
    const deltaText =
      delta === 0 ? "OK" :
        (delta > 0 ? `+${formatCzk(delta)}` : `${formatCzk(Math.abs(delta))}`);

    // QR if needs to pay
    let qrBtn = "";
    if (delta < 0 && data.paymentAccount) {
      const parsed = parseCzAccount(data.paymentAccount);
      if (parsed) {
        const iban = czAccountToIban(parsed.prefix, parsed.number, parsed.bank);
        const toPay = Math.abs(delta);
        const spd = buildSpd({ iban, amountCzk: toPay, msg: name });
        qrBtn = `<button class="btn tiny" data-qr="1" data-name="${name}" data-amount="${toPay}" data-spd="${spd}">QR</button>`;
      }
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td class="center">${room}</td>
      <td class="center">${formatCzk(mustPay)}</td>
      <td class="center">${formatCzk(paidOne)}</td>
      <td class="center"><button class="btn tiny ${deltaClass}" data-info="1" data-name="${name}">${deltaText}</button></td>
      <td class="center">${qrBtn || "—"}</td>
    `;
    payTableBody.appendChild(tr);

    // mobile card
    const div = document.createElement("div");
    div.className = "mobileCard";
    div.innerHTML = `
      <div class="mobileCardHead">
        <div>
          <div class="mobileCardName">${name}</div>
          <div class="mobileCardMeta">${room}</div>
        </div>
        <span class="btn tiny ${deltaClass}" data-info="1" data-name="${name}">${deltaText}</span>
      </div>
      <div class="mobileCardBody">
        <span>Má platit: <b>${formatCzk(mustPay)}</b></span>
        <span>Zaplaceno: <b>${formatCzk(paidOne)}</b></span>
      </div>
      <div class="mobileCardActions">
        <button class="btn tiny" data-info="1" data-name="${name}">Detail</button>
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
        .map(x => `<li>${formatCzk(x.amount)} <span class="modalDate">${x.date || "—"}</span></li>`)
        .join("") || "<li class='emptyNote'>Žádné platby</li>";

      const r = (rec.refunds || [])
        .map(x => `<li>${formatCzk(x.amount)} <span class="modalDate">${x.date || "—"}</span></li>`)
        .join("") || "<li class='emptyNote'>Žádné vratky</li>";

      const mustPay = shouldPayFor(name);
      const paidOne = (rec.payments || []).reduce((s, x) => s + (Math.round(Number(x.amount) || 0)), 0);
      const delta = paidOne - mustPay;
      const deltaClass = delta === 0 ? "settlement-ok" : (delta > 0 ? "settlement-over" : "settlement-under");
      const deltaText = delta === 0 ? "OK" : (delta > 0 ? `+${formatCzk(delta)}` : `${formatCzk(Math.abs(delta))}`);

      openInfoModal("Vyrovnání", name, `
        <div class="infoKpi">
          <div class="infoKpiItem"><span class="infoKpiLabel">Má platit</span><span class="infoKpiValue">${formatCzk(mustPay)}</span></div>
          <div class="infoKpiItem"><span class="infoKpiLabel">Zaplaceno</span><span class="infoKpiValue">${formatCzk(paidOne)}</span></div>
          <div class="infoKpiItem"><span class="infoKpiLabel">Vyrovnání</span><span class="infoKpiValue ${deltaClass}">${deltaText}</span></div>
        </div>
        <div class="infoSection"><b>Platby</b><ul>${p}</ul></div>
        <div class="infoSection"><b>Vratky</b><ul>${r}</ul></div>
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

// -------- Airbnb slider --------
function initSlider() {
  if (!slideImg || !dotsWrap || AIRBNB_IMAGES.length < 2) return;

  let current = 0;

  // create dots
  dotsWrap.innerHTML = AIRBNB_IMAGES.map((_, i) =>
    `<span class="dot${i === 0 ? " active" : ""}" data-slide="${i}"></span>`
  ).join("");

  function goTo(idx) {
    current = ((idx % AIRBNB_IMAGES.length) + AIRBNB_IMAGES.length) % AIRBNB_IMAGES.length;
    slideImg.src = AIRBNB_IMAGES[current];
    dotsWrap.querySelectorAll(".dot").forEach((d, i) => {
      d.classList.toggle("active", i === current);
    });
  }

  // click dots
  dotsWrap.addEventListener("click", (e) => {
    const idx = e.target.dataset?.slide;
    if (idx != null) goTo(Number(idx));
  });

  // auto-rotate
  let timer = setInterval(() => goTo(current + 1), SLIDE_MS);

  // pause on hover
  const wrap = slideImg.closest(".airImgWrap");
  if (wrap) {
    wrap.addEventListener("mouseenter", () => clearInterval(timer));
    wrap.addEventListener("mouseleave", () => {
      clearInterval(timer);
      timer = setInterval(() => goTo(current + 1), SLIDE_MS);
    });
  }
}

// -------- INITIALIZATION --------
(async function init() {
  // show loading state
  elRoomsGrid.innerHTML = '<div class="loadingMsg">Načítám data…</div>';
  elWhoChips.innerHTML = '<div class="loadingMsg">Načítám…</div>';

  // start slider immediately (doesn't need data)
  initSlider();

  try {
    const data = await loadDataFromGitHub();

    // airNote
    if (data.airNote) {
      elAirNote.innerHTML = data.airNote;
      elAirNote.style.display = "block";
    }

    // map
    if (data.mapAddress && elMapWrap) {
      const q = encodeURIComponent(data.mapAddress);
      elMapWrap.innerHTML = `<div class="mapEmbed"><iframe src="https://maps.google.com/maps?q=${q}&output=embed&z=14" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`;
      elMapWrap.style.display = "block";
    }

    // banner
    if (data.bannerVisible && data.banner) {
      elBannerWrap.innerHTML = `<div class="banner">${data.banner}</div>`;
      elBannerWrap.style.display = "block";
    }

    renderWhoGoes(data);
    renderPriceScale(data);
    renderRooms(data);
    renderFinance(data);
    ensureAirHousingLayout();
  } catch (e) {
    console.error("Failed to load data:", e);
    elRoomsGrid.innerHTML = '<div class="loadingMsg" style="color:var(--bad)">Nepodařilo se načíst data. Zkuste obnovit stránku.</div>';
  }
})();
