// assets/view.js

// ====== SLIDER CONFIG ======
// Sem dej URL fotek z Airbnb (muscache). 1. už tam je.
// Přidej další 3–6 URL (když nějaká neexistuje, slider ji přeskočí).
const AIRBNB_IMAGES = [
  "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1509296019313360437/original/3cc519a7-fdd2-44a7-a44a-870c4d051530.jpeg?im_w=1200",
  // DOPLŇ DALŠÍ:
  // "https://a0.muscache.com/im/pictures/....jpeg?im_w=1200",
  // "https://a0.muscache.com/im/pictures/....jpeg?im_w=1200",
];

const SLIDE_MS = 4500;

const elRoomsGrid = document.getElementById("roomsGrid");
const elPeople = document.getElementById("kpiPeople");
const elUnit = document.getElementById("kpiUnit");
const elSum = document.getElementById("kpiSum");
const payTableBody = document.querySelector("#payTable tbody");
const payList = document.getElementById("payList");

// Slider els
const slideImg = document.getElementById("airSlideImg");
const dotsWrap = document.getElementById("airDots");

function safeSetText(el, text) {
  if (el) el.textContent = text;
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
    const isKids = room.type === "kids";

    card.innerHTML = `
      <h2>${room.name}</h2>
      <div class="meta">${isKids ? "Dětský pokoj (0.75)" : "Manželský pokoj (1.00)"}</div>
      <div class="list"></div>
    `;

    const list = card.querySelector(".list");
    const rows = byRoom.get(room.id) || [];

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
            <div class="meta">váha ${p.weight.toFixed(2)}</div>
          </div>
          <div class="who">${formatCzk(p.pay)}</div>
        `;
        list.appendChild(row);
      }
    }

    elRoomsGrid.appendChild(card);
  }
}

function renderPeopleTable(data, payments) {
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

  safeSetText(elPeople, String(rows.length));
  safeSetText(elUnit, payments.unit ? formatCzk(payments.unit) : "—");
  safeSetText(elSum, formatCzk(payments.totalRounded));
}

async function loadAndRender() {
  try {
    const data = await loadDataFromGitHub();
    const payments = computePayments(data);

    renderRooms(data, payments);
    renderPeopleTable(data, payments);
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
      ev.preventDefault(); // nekliknout na link
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

// otestuje URL obrázku – když failne, přeskočí
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

  // vyfiltruj jen funkční obrázky (ať to nespadne na rozbité URL)
  const checks = await Promise.all(AIRBNB_IMAGES.map(u => tryLoadImage(u)));
  usableImages = AIRBNB_IMAGES.filter((_, i) => checks[i]);

  if (usableImages.length === 0) {
    // nech tam defaultní src z HTML
    usableImages = [slideImg.src];
  }

  makeDots(usableImages.length);

  slideIndex = 0;
  setSlide(0);

  if (usableImages.length > 1) {
    startTimer();
  }
}

function setSlide(idx) {
  if (!usableImages.length) return;
  slideIndex = (idx + usableImages.length) % usableImages.length;
  slideImg.src = usableImages[slideIndex];
  setActiveDot(slideIndex);
}

function startTimer() {
  timer = setInterval(() => {
    setSlide(slideIndex + 1);
  }, SLIDE_MS);
}

function restartTimer() {
  if (timer) clearInterval(timer);
  if (usableImages.length > 1) startTimer();
}

// ====== INIT ======
loadAndRender();
initSlider();
