// assets/view.js

const elRoomsGrid = document.getElementById("roomsGrid");
const elWhoChips = document.getElementById("whoChips");
const elWhoStat = document.getElementById("whoStat");

async function loadAndRender() {
  try {
    const data = await loadDataFromGitHub();
    renderWhoGoes(data);
    renderRooms(data);
  } catch (e) {
    alert("Nepodařilo se načíst data z GitHubu:\n" + e.message);
  }
}

function renderWhoGoes(data) {
  const names = [];
  for (const room of data.rooms) {
    for (const p of room.people) {
      if ((p || "").trim()) names.push(p.trim());
    }
  }

  elWhoChips.innerHTML = "";
  if (names.length === 0) {
    elWhoChips.innerHTML = `<div class="emptyNote">Zatím nikdo není zapsaný.</div>`;
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

/* ===============================
   🔥 HLAVNÍ NOVÁ LOGIKA
   Cena podle pořadí lůžka
================================ */

function computePriceForPosition(data, positionIndex) {
  const total = data.totalCzk;

  // kolik lidí už je aktuálně zapsáno
  const currentCount = countFilledBeds(data);

  // tato pozice bude (currentCount + offset)
  const newCount = positionIndex;

  // zjistíme kolik z nich je full a kolik kids
  let full = 0;
  let kids = 0;

  if (newCount <= 14) {
    full = newCount;
  } else {
    full = 14;
    kids = newCount - 14;
  }

  const weighted = full + kids * 0.75;

  const divisor = Math.max(10, weighted);

  const unit = total / divisor;

  return Math.round(unit);
}

function countFilledBeds(data) {
  let n = 0;
  for (const r of data.rooms) {
    for (const p of r.people) {
      if ((p || "").trim()) n++;
    }
  }
  return n;
}

function renderRooms(data) {
  elRoomsGrid.innerHTML = "";

  let currentFilled = countFilledBeds(data);
  let positionCounter = currentFilled;

  for (const room of data.rooms) {

    const card = document.createElement("div");
    card.className = "card";

    const capacity = room.people.length;
    const filled = room.people.filter(p => (p || "").trim()).length;

    card.innerHTML = `
      <div class="roomHead">
        <div>
          <h2>${room.name}</h2>
          <div class="meta">
            ${room.type === "kids"
              ? "Nižší komfort (sleva až po 14 osobě)"
              : "Pokoj s manželskou postelí"}
          </div>
        </div>
      </div>
      <div class="list"></div>
    `;

    const list = card.querySelector(".list");

    for (let i = 0; i < capacity; i++) {
      const person = (room.people[i] || "").trim();

      const row = document.createElement("div");
      row.className = "row";

      if (person) {
        row.innerHTML = `
          <div class="who">${person}</div>
          <div class="meta">potvrzeno</div>
        `;
      } else {
        positionCounter++;
        const price = computePriceForPosition(data, positionCounter);

        row.innerHTML = `
          <div>
            <div class="who">zatím nikdo</div>
            <div class="meta">cena ${formatCzk(price)}</div>
          </div>
        `;
      }

      list.appendChild(row);
    }

    elRoomsGrid.appendChild(card);
  }
}

loadAndRender();
