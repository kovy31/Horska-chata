// assets/view.js

// ====== SLIDER CONFIG ======
// DOPLŇ si sem další URL fotek (muscache) z Airbnb.
// Slider poběží i s jednou fotkou.
const AIRBNB_IMAGES = [
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/3cc519a7-fdd2-44a7-a44a-870c4d051530.jpeg?im_w=1200",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/3d6a0041-65ad-4ba4-90c1-d971de85fe95.jpeg?aki_policy=xx_large",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/3a516abc-1e0d-4f69-9bee-6d5095ac0ef3.jpeg?aki_policy=xx_large",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/105b8a30-e224-4bc2-a3a7-602d091d8673.jpeg?aki_policy=xx_large",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/78c8bcc9-b723-4e29-993e-67e8bed7e175.jpeg?aki_policy=xx_large",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/06912285-7757-4cf7-bb84-aacf81473236.jpeg?aki_policy=xx_large",
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/af9bb574-7d11-4a70-8036-d81f24b4bd9e.jpeg?aki_policy=xx_large",

  // "https://a0.muscache.com/im/pictures/...jpeg?im_w=1200",
  // "https://a0.muscache.com/im/pictures/...jpeg?im_w=1200",
];

const SLIDE_MS = 4500;

// --- DOM ---
const elRoomsGrid = document.getElementById("roomsGrid");

const elWhoChips = document.getElementById("whoChips");
const elWhoStat = document.getElementById("whoStat");
const elCapStat = document.getElementById("capStat");

// Finance
const elTotal = document.getElementById("kpiTotal");
const elUnit = document.getElementById("kpiUnit");
const elSum = document.getElementById("kpiSum");
const payTableBody = document.querySelector("#payTable tbody");
const payList = document.getElementById("payList");

// Slider els
const slideImg = document.getElementById("airSlideImg");
const dotsWrap = document.getElementById("airDots");

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

  const cap = totalCapacity(data);
  elWhoStat.textContent = `${names.length} potvrzených`;
  // volitelně: ukázat i kapacitu
  // elWhoStat.textContent = `${names.length} / ${cap} potvrzených`;
}

function renderRooms(data, payments) {
  elRoomsGrid.innerHTML = "";

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
      <div class="meta">${isKids ? "Dětský pokoj" : "Pokoj s manželskou postelí"}</div>
    </div>
        <div class="${statusClass}">
          ${statusText} · ${filled}/${capacity}
        </div>
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

function renderFinance(data, payments) {
  elTotal.textContent = formatCzk(data.totalCzk);
  elUnit.textContent = payments.unit ? formatCzk(payments.unit) : "—";
  elSum.textContent = formatCzk(payments.totalRounded);

  const rows = [...payments.rows].sort((a, b) => a.name.localeCompare(b.name, "cs"));

  payTableBody.innerHTML = "";
  payList.innerHTML = "";

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.roomName}</td>
      <td>${r.weight.toFixed(2)}</td>
      <td><strong>${formatCzk(r.pay)}</strong></td>
    `;
    payTableBody.appendChild(tr);

    const card = document.createElement("div");
    card.className = "row";
    card.innerHTML = `
      <div>
        <div class="who">${r.name}</div>
        <div class="meta">${r.roomName} · váha ${r.weight.toFixed(2)}</div>
      </div>
      <div class="who">${formatCzk(r.pay)}</div>
    `;
    payList.appendChild(card);
  }
}

async function loadAndRender() {
  try {
    const data = await loadDataFromGitHub();
    const payments = computePayments(data);

    renderWhoGoes(data);
    renderRooms(data, payments);
    renderFinance(data, payments);
  } catch (e) {
    alert("Nepodařilo se načíst data z GitHubu:\n" + e.message);
  }
}

// ====== SLIDER ======
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

  if (usableImages.length === 0) {
    usableImages = [slideImg.src];
  }

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

// INIT
loadAndRender();
initSlider();
