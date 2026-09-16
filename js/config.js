// Supabase project the app shares its pledges through.
//
// Both values are meant to be public — the anon key is a browser key, and the
// database is protected by the row level security policies in
// supabase/schema.sql (read + update the 11 fixed rows, nothing else).
//
// Find them in Supabase: Project Settings → API → "Project URL" and the
// "anon public" key. Leave them blank and the app still runs, saving pledges
// on the device only.

export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";
