// assets/edit.js
const editGrid = document.getElementById("editGrid");
const btnLoad = document.getElementById("btnLoad");
const btnSave = document.getElementById("btnSave");
const btnReset = document.getElementById("btnReset");

const inpTotal = document.getElementById("inpTotal");
const inpKids = document.getElementById("inpKids");
const inpToken = document.getElementById("inpToken");

let state = defaultData();

function renderEditor(data) {
  editGrid.innerHTML = "";
  inpTotal.value = String(data.totalCzk);
  inpKids.value = String(data.kidsDiscount);

  for (const room of data.rooms) {
    const card = document.createElement("div");
    card.className = "card";
    const cap = room.people.length;

    const fields = room.people.map((val, idx) => {
      const label = `Osoba ${idx + 1}`;
      return `
        <div style="margin-top:10px;">
          <label class="sub">${label}</label>
          <input data-room="${room.id}" data-idx="${idx}" value="${val.replace(/"/g,'&quot;')}" placeholder="Jméno" />
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <h2>${room.name}</h2>
      <div class="badge">
        <span>Kapacita:</span> <strong>${cap}</strong>
        <span style="margin-left:10px;">Typ:</span>
        <strong>${room.type === "kids" ? "Dětský" : "Manželský"}</strong>
      </div>
      ${fields}
    `;
    editGrid.appendChild(card);
  }

  editGrid.querySelectorAll("input[data-room]").forEach(inp => {
    inp.addEventListener("input", (e) => {
      const roomId = e.target.getAttribute("data-room");
      const idx = Number(e.target.getAttribute("data-idx"));
      const room = state.rooms.find(r => r.id === roomId);
      room.people[idx] = normalizeName(e.target.value);
    });
  });
}

async function loadFromGitHub() {
  btnLoad.disabled = true;
  btnLoad.textContent = "Načítám…";
  try {
    state = await loadDataFromGitHub();
    renderEditor(state);
  } catch (e) {
    alert("Nepodařilo se načíst:\n" + e.message);
  } finally {
    btnLoad.disabled = false;
    btnLoad.textContent = "Načíst z GitHubu";
  }
}

async function saveToGitHub() {
  const token = (inpToken.value || "").trim();
  if (!token) {
    alert("Pro uložení zadej GitHub token (Fine-grained PAT pro Issues).");
    return;
  }

  const total = Number(inpTotal.value);
  const kids = Number(inpKids.value);
  if (!Number.isFinite(total) || total <= 0) return alert("Neplatná celková cena.");
  if (!Number.isFinite(kids) || kids <= 0 || kids > 1) return alert("Neplatný koeficient dětského pokoje (0–1).");

  state.totalCzk = Math.round(total);
  state.kidsDiscount = kids;

  btnSave.disabled = true;
  btnSave.textContent = "Ukládám…";
  try {
    await saveDataToGitHub(state, token);
    alert("Uloženo do GitHub Issue.");
  } catch (e) {
    alert("Nepodařilo se uložit:\n" + e.message);
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = "Uložit do GitHubu";
  }
}

btnLoad.addEventListener("click", loadFromGitHub);
btnSave.addEventListener("click", saveToGitHub);

btnReset.addEventListener("click", () => {
  if (!confirm("Opravdu vymazat všechna jména (jen lokálně, dokud neuložíš)?")) return;
  for (const r of state.rooms) r.people = r.people.map(() => "");
  renderEditor(state);
});

renderEditor(state);
