// assets/view.js
const elTotalTop = document.getElementById("totalTop");
const elRoomsGrid = document.getElementById("roomsGrid");
const elPeople = document.getElementById("kpiPeople");
const elUnit = document.getElementById("kpiUnit");
const elSum = document.getElementById("kpiSum");
const btnReload = document.getElementById("btnReload");
const btnCopy = document.getElementById("btnCopy");
const payTableBody = document.querySelector("#payTable tbody");
const payList = document.getElementById("payList");

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
      <div class="badge">
        <span>Typ:</span>
        <strong>${isKids ? "Dětský (0.75)" : "Manželský (1.00)"}</strong>
      </div>
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

  elPeople.textContent = String(rows.length);
  elUnit.textContent = payments.unit ? formatCzk(payments.unit) : "—";
  elSum.textContent = formatCzk(payments.totalRounded);
  elTotalTop.textContent = formatCzk(data.totalCzk);
}

async function loadAndRender() {
  btnReload.disabled = true;
  btnReload.textContent = "Načítám…";
  try {
    const data = await loadDataFromGitHub();
    const payments = computePayments(data);
    renderRooms(data, payments);
    renderPeopleTable(data, payments);
  } catch (e) {
    alert("Nepodařilo se načíst data z GitHubu:\n" + e.message);
  } finally {
    btnReload.disabled = false;
    btnReload.textContent = "Načíst z GitHubu";
  }
}

btnReload.addEventListener("click", loadAndRender);

btnCopy.addEventListener("click", async () => {
  const data = await loadDataFromGitHub();
  const payments = computePayments(data);
  const lines = [
    `Celkem: ${formatCzk(data.totalCzk)}`,
    `Lidé: ${payments.rows.length}`,
    "",
    ...payments.rows
      .slice()
      .sort((a,b)=>a.name.localeCompare(b.name,"cs"))
      .map(r => `${r.name} – ${formatCzk(r.pay)} (${r.roomName})`)
  ];
  await navigator.clipboard.writeText(lines.join("\n"));
  alert("Souhrn zkopírován do schránky.");
});

loadAndRender();
