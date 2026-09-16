// Josh's Bin Chicken Tattoo Fund — 11 mates, $200 AUD, one ankle.
import {
  SPOTS, isShared, cleanAmount, cleanName,
  readLocal, writeLocal, readPending, writePending, fetchAll, savePledge,
} from "./store.js";

const GOAL = 200;
const POLL_MS = 4000;      // how often we ask the server what everyone else did
const WRITE_DEBOUNCE = 500; // how long we wait after typing before saving

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
  sync: document.getElementById("sync"),
  splitEven: document.getElementById("split-even"),
  reset: document.getElementById("reset"),
  toast: document.getElementById("toast"),
};

let people = readLocal();
let celebrated = total() >= GOAL;

// Rows the server must not overwrite yet: someone is typing in them, or their
// edit hasn't been saved.
const pending = readPending(); // id -> {name?, amount?}, survives a reload
const writeTimers = new Map();
let editing = null;          // id of the row with focus
let saving = 0;
let lastSyncedAt = 0;
let syncError = null;

const money = (n) => "$" + (Number.isInteger(n) ? String(n) : n.toFixed(2));

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

// Push state into the inputs, leaving alone whatever the viewer is typing in.
function syncInputs() {
  [...el.people.children].forEach((li, i) => {
    if (editing === i) return;
    const name = li.querySelector(".name");
    const amount = li.querySelector(".amount");
    const wanted = people[i].amount ? String(people[i].amount) : "";
    if (name.value !== people[i].name) name.value = people[i].name;
    if (amount.value !== wanted) amount.value = wanted;
  });
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

  renderSync();

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

function renderSync() {
  if (!isShared) {
    el.sync.textContent = "Saved on this phone only — no shared list connected yet.";
    el.sync.dataset.state = "local";
    return;
  }
  if (syncError) {
    el.sync.textContent = pending.size
      ? `Can't reach the shared list — ${pending.size === 1 ? "1 edit is" : pending.size + " edits are"} saved here and will go up when you're back online.`
      : "Can't reach the shared list — showing the last version. Retrying…";
    el.sync.dataset.state = "error";
    return;
  }
  if (saving > 0 || pending.size) {
    el.sync.textContent = "Saving…";
    el.sync.dataset.state = "saving";
    return;
  }
  el.sync.textContent = `Shared with all 11 — everyone's edits land here${
    lastSyncedAt ? ", updated " + ago(lastSyncedAt) : ""
  }.`;
  el.sync.dataset.state = "ok";
}

function ago(when) {
  const secs = Math.round((Date.now() - when) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.round(secs / 60)}m ago`;
}

/* ---------------- talking to the shared list ---------------- */

function applyRemote(rows) {
  let changed = false;
  rows.forEach((row, i) => {
    if (editing === i || pending.has(i)) return; // don't stomp on a live edit
    if (people[i].name !== row.name || people[i].amount !== row.amount) {
      people[i] = row;
      changed = true;
    }
  });
  lastSyncedAt = Date.now();
  syncError = null;
  if (changed) {
    writeLocal(people);
    syncInputs();
  }
  render();
}

async function pull() {
  if (!isShared || document.hidden) return;
  try {
    applyRemote(await fetchAll());
  } catch (err) {
    syncError = err;
    renderSync();
  }
}

// Queue a change for one row and save it once the typing settles.
function queueWrite(id, patch) {
  pending.set(id, { ...(pending.get(id) || {}), ...patch });
  writePending(pending);
  writeLocal(people);
  renderSync();

  clearTimeout(writeTimers.get(id));
  writeTimers.set(id, setTimeout(() => flush(id), WRITE_DEBOUNCE));
}

async function flush(id) {
  const patch = pending.get(id);
  if (!patch) return;
  pending.delete(id);
  writePending(pending);

  if (!isShared) {
    writeLocal(people);
    renderSync();
    return;
  }

  saving += 1;
  renderSync();
  try {
    const row = await savePledge(id, patch);
    if (editing !== id && row) {
      people[id] = row;
      syncInputs();
    }
    lastSyncedAt = Date.now();
    syncError = null;
    writeLocal(people);
  } catch (err) {
    syncError = err;
    // Keep the edit queued so the next settle retries it.
    pending.set(id, { ...patch, ...(pending.get(id) || {}) });
    writePending(pending);
    clearTimeout(writeTimers.get(id));
    writeTimers.set(id, setTimeout(() => flush(id), 5000));
  } finally {
    saving -= 1;
    render();
  }
}

/* ---------------- interaction ---------------- */

function parseAmount(text) {
  if (String(text).includes("-")) return 0; // no negative pledges, nice try
  return cleanAmount(String(text).replace(/[^0-9.,]/g, "").replace(",", "."));
}

el.people.addEventListener("input", (event) => {
  const li = event.target.closest(".person");
  if (!li) return;
  const i = Number(li.dataset.index);

  if (event.target.classList.contains("amount")) {
    people[i].amount = parseAmount(event.target.value);
    queueWrite(i, { amount: people[i].amount });
    render();
  } else if (event.target.classList.contains("name")) {
    people[i].name = event.target.value.slice(0, 24);
    queueWrite(i, { name: people[i].name });
  }
});

el.people.addEventListener("focusin", (event) => {
  const li = event.target.closest(".person");
  if (li) editing = Number(li.dataset.index);
});

// Tidy the typed value once the field is left, and save straight away.
el.people.addEventListener("focusout", (event) => {
  const li = event.target.closest(".person");
  if (!li) return;
  const i = Number(li.dataset.index);
  editing = null;

  if (event.target.classList.contains("amount")) {
    event.target.value = people[i].amount ? String(people[i].amount) : "";
  } else if (event.target.classList.contains("name")) {
    people[i].name = cleanName(event.target.value, i);
    event.target.value = people[i].name;
    queueWrite(i, { name: people[i].name });
  }
  if (pending.has(i)) {
    clearTimeout(writeTimers.get(i));
    flush(i);
  }
});

el.people.addEventListener("keydown", (event) => {
  if (event.key === "Enter") event.target.blur();
});

el.splitEven.addEventListener("click", () => {
  const cents = Math.floor((GOAL * 100) / SPOTS);
  const remainder = GOAL * 100 - cents * SPOTS;
  people.forEach((person, i) => {
    person.amount = (cents + (i < remainder ? 1 : 0)) / 100;
    queueWrite(i, { amount: person.amount });
  });
  syncInputs();
  render();
  toast(`Split evenly — ${money(cents / 100)} each.`);
});

el.reset.addEventListener("click", () => {
  const question = isShared
    ? "Clear every pledge for everyone and start again?"
    : "Clear every pledge and start again?";
  if (!confirm(question)) return;
  people.forEach((person, i) => {
    person.amount = 0;
    queueWrite(i, { amount: 0 });
  });
  syncInputs();
  render();
});

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2600);
}

/* ---------------- go ---------------- */

buildRows();
render();

if (isShared) {
  pending.forEach((_, id) => flush(id));
  pull();
  setInterval(pull, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) pull();
  });
  window.addEventListener("online", pull);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
