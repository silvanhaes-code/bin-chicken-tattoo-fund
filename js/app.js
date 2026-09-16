// Josh's Bin Chicken Tattoo Fund — 11 mates, $200 AUD, one ankle.
const GOAL = 200;
const SPOTS = 11;
const STORAGE_KEY = "bin-chicken-fund-v1";
const MAX_PLEDGE = 1000;

const DEFAULT_NAMES = [
  "Josh", "Mate 2", "Mate 3", "Mate 4", "Mate 5", "Mate 6",
  "Mate 7", "Mate 8", "Mate 9", "Mate 10", "Mate 11",
];

const el = {
  people: document.getElementById("people"),
  raised: document.getElementById("raised"),
  goal: document.getElementById("goal"),
  togo: document.getElementById("togo"),
  togoBox: document.getElementById("togo-box"),
  bar: document.getElementById("bar"),
  barFill: document.getElementById("bar-fill"),
  barBird: document.getElementById("bar-bird"),
  caption: document.getElementById("bar-caption"),
  chooks: document.getElementById("chooks"),
  splitEven: document.getElementById("split-even"),
  reset: document.getElementById("reset"),
  toast: document.getElementById("toast"),
};

const money = (n) =>
  "$" + (Number.isInteger(n) ? String(n) : n.toFixed(2));

function blankState() {
  return DEFAULT_NAMES.map((name) => ({ name, amount: 0 }));
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(raw)) return blankState();
    return blankState().map((slot, i) => ({
      name: typeof raw[i]?.name === "string" && raw[i].name.trim() ? raw[i].name : slot.name,
      amount: clamp(Number(raw[i]?.amount)),
    }));
  } catch {
    return blankState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
  } catch {
    /* private mode / full storage — the app still works for this session */
  }
}

function clamp(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.round(value * 100) / 100, MAX_PLEDGE);
}

let people = load();
let celebrated = total() >= GOAL;

function total() {
  return Math.round(people.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
}

/* ---------------- rendering ---------------- */

function buildRows() {
  const frag = document.createDocumentFragment();
  people.forEach((person, i) => {
    const li = document.createElement("li");
    li.className = "person";
    li.dataset.index = String(i);
    li.innerHTML = `
      <img src="assets/bin-chicken.svg" alt="" aria-hidden="true" />
      <input class="name" type="text" value="" maxlength="24"
             aria-label="Name of person ${i + 1}" autocomplete="off" autocapitalize="words" />
      <span class="amount-field">
        <span class="dollar" aria-hidden="true">$</span>
        <input class="amount" type="text" inputmode="decimal" enterkeyhint="done"
               placeholder="0" aria-label="Amount pledged by person ${i + 1} in Australian dollars" />
      </span>`;
    li.querySelector(".name").value = person.name;
    li.querySelector(".amount").value = person.amount ? String(person.amount) : "";
    frag.appendChild(li);
  });
  el.people.appendChild(frag);

  el.chooks.innerHTML = people
    .map(() => '<img src="assets/bin-chicken.svg" alt="" width="24" height="24" />')
    .join("");
}

function render() {
  const raised = total();
  const togo = Math.round(Math.max(GOAL - raised, 0) * 100) / 100;
  const pct = Math.min((raised / GOAL) * 100, 100);
  const chippedIn = people.filter((p) => p.amount > 0).length;

  el.goal.textContent = money(GOAL);
  el.raised.textContent = money(raised);
  el.togo.textContent = money(togo);
  el.togoBox.classList.toggle("done", togo === 0);

  el.barFill.style.width = pct + "%";
  el.barBird.style.left = pct + "%";
  el.bar.setAttribute("aria-valuenow", String(raised));
  el.bar.setAttribute("aria-valuetext", `${money(raised)} of ${money(GOAL)} pledged`);

  el.caption.textContent = captionFor(raised, togo, chippedIn);

  [...el.chooks.children].forEach((chook, i) => {
    chook.classList.toggle("on", people[i].amount > 0);
  });

  [...el.people.children].forEach((li, i) => {
    li.classList.toggle("paid", people[i].amount > 0);
  });

  if (raised >= GOAL && !celebrated) {
    celebrated = true;
    document.body.classList.add("goal-hit");
    toast("🐦 Fully funded! Book the tattooist.");
    setTimeout(() => document.body.classList.remove("goal-hit"), 2800);
  } else if (raised < GOAL) {
    celebrated = false;
  }
}

function captionFor(raised, togo, chippedIn) {
  if (raised === 0) return "Nobody has chipped in yet. Be the first bin chicken.";
  if (togo === 0) {
    const over = Math.round((raised - GOAL) * 100) / 100;
    return over > 0
      ? `Goal smashed — ${money(over)} over. Josh owes everyone a beer.`
      : "Goal reached. Josh is getting inked.";
  }
  const who = chippedIn === 1 ? "1 mate is in" : `${chippedIn} mates are in`;
  return `${who} — ${money(togo)} still to go, ${Math.round((raised / GOAL) * 100)}% of the way there.`;
}

/* ---------------- interaction ---------------- */

function parseAmount(text) {
  if (String(text).includes("-")) return 0; // no negative pledges, nice try
  const cleaned = String(text).replace(/[^0-9.,]/g, "").replace(",", ".");
  return clamp(parseFloat(cleaned));
}

el.people.addEventListener("input", (event) => {
  const li = event.target.closest(".person");
  if (!li) return;
  const i = Number(li.dataset.index);

  if (event.target.classList.contains("amount")) {
    people[i].amount = parseAmount(event.target.value);
    save();
    render();
  } else if (event.target.classList.contains("name")) {
    people[i].name = event.target.value;
    save();
  }
});

// Tidy the typed amount once the field is left (e.g. "12,5o" -> "12.5").
el.people.addEventListener("focusout", (event) => {
  const li = event.target.closest(".person");
  if (!li) return;
  const i = Number(li.dataset.index);

  if (event.target.classList.contains("amount")) {
    event.target.value = people[i].amount ? String(people[i].amount) : "";
  } else if (event.target.classList.contains("name") && !event.target.value.trim()) {
    people[i].name = DEFAULT_NAMES[i];
    event.target.value = DEFAULT_NAMES[i];
    save();
  }
});

el.people.addEventListener("keydown", (event) => {
  if (event.key === "Enter") event.target.blur();
});

el.splitEven.addEventListener("click", () => {
  const cents = Math.floor((GOAL * 100) / SPOTS);
  let remainder = GOAL * 100 - cents * SPOTS;
  people.forEach((person, i) => {
    person.amount = (cents + (i < remainder ? 1 : 0)) / 100;
  });
  syncInputs();
  save();
  render();
  toast(`Split evenly — ${money(cents / 100)} each.`);
});

el.reset.addEventListener("click", () => {
  if (!confirm("Clear every pledge and start again?")) return;
  people.forEach((person) => (person.amount = 0));
  syncInputs();
  save();
  render();
});

function syncInputs() {
  [...el.people.children].forEach((li, i) => {
    li.querySelector(".amount").value = people[i].amount ? String(people[i].amount) : "";
  });
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2600);
}

buildRows();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
