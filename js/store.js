// Where the pledges live.
//
// Shared: one row per spot in a Supabase table, reached over PostgREST with
// plain fetch (no SDK, so the app stays dependency-free and installable).
// Local: a localStorage mirror so the app still shows something sensible when
// the phone is offline or Supabase isn't configured yet.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const SPOTS = 11;
export const DEFAULT_NAMES = [
  "Josh", "Mate 2", "Mate 3", "Mate 4", "Mate 5", "Mate 6",
  "Mate 7", "Mate 8", "Mate 9", "Mate 10", "Mate 11",
];

const LOCAL_KEY = "bin-chicken-fund-v2";
const PENDING_KEY = "bin-chicken-pending-v1";
const REQUEST_TIMEOUT = 8000;
const MAX_PLEDGE = 1000;
const MAX_NAME = 24;

const base = String(SUPABASE_URL).replace(/\/+$/, "");
export const isShared = Boolean(base && SUPABASE_ANON_KEY);

const endpoint = `${base}/rest/v1/pledges`;
const authHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

/* ---------------- shapes ---------------- */

export function blankPledges() {
  return DEFAULT_NAMES.map((name, id) => ({ id, name, amount: 0 }));
}

export function cleanAmount(value) {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n * 100) / 100, MAX_PLEDGE);
}

export function cleanName(value, id) {
  const name = String(value ?? "").trim().slice(0, MAX_NAME);
  return name || DEFAULT_NAMES[id];
}

function normalise(rows) {
  const byId = new Map((rows || []).map((row) => [Number(row.id), row]));
  return blankPledges().map((slot) => {
    const row = byId.get(slot.id);
    if (!row) return slot;
    return {
      id: slot.id,
      name: cleanName(row.name, slot.id),
      amount: cleanAmount(row.amount),
    };
  });
}

/* ---------------- local mirror ---------------- */

export function readLocal() {
  try {
    return normalise(JSON.parse(localStorage.getItem(LOCAL_KEY)));
  } catch {
    return blankPledges();
  }
}

export function writeLocal(pledges) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(pledges));
  } catch {
    /* private mode or full storage — not worth failing over */
  }
}

// Edits made while the phone had no signal, waiting to be pushed up.
export function readPending() {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_KEY));
    return new Map(Array.isArray(raw) ? raw.map(([id, patch]) => [Number(id), patch]) : []);
  } catch {
    return new Map();
  }
}

export function writePending(pending) {
  try {
    if (pending.size) localStorage.setItem(PENDING_KEY, JSON.stringify([...pending]));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* nothing we can do — the edit still lives in memory for this session */
  }
}

/* ---------------- shared store ---------------- */

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(endpoint + path, {
      ...options,
      signal: controller.signal,
      headers: { ...authHeaders, ...(options.headers || {}) },
    });
    if (!res.ok) {
      throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Everyone's pledges, newest state from the server.
export async function fetchAll() {
  if (!isShared) throw new Error("No Supabase project configured");
  const res = await request("?select=id,name,amount&order=id.asc");
  return normalise(await res.json());
}

// One spot, changed by whoever is holding the phone.
export async function savePledge(id, patch) {
  if (!isShared) throw new Error("No Supabase project configured");
  const body = { updated_at: new Date().toISOString() };
  if ("name" in patch) body.name = cleanName(patch.name, id);
  if ("amount" in patch) body.amount = cleanAmount(patch.amount);

  const res = await request(`?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  return normalise(await res.json())[id];
}
