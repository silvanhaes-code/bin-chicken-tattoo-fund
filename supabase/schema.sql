-- Josh's Bin Chicken Tattoo Fund — shared pledge table.
-- Paste this whole file into the Supabase SQL editor and hit Run.

create table if not exists public.pledges (
  id         smallint primary key check (id between 0 and 10),
  name       text        not null default ''  check (char_length(name) <= 24),
  amount     numeric(7,2) not null default 0  check (amount >= 0 and amount <= 1000),
  updated_at timestamptz not null default now()
);

-- The 11 spots. Fixed rows: the app only ever updates these, never adds more.
insert into public.pledges (id, name) values
  (0, 'Josh'), (1, 'Mate 2'), (2, 'Mate 3'), (3, 'Mate 4'), (4, 'Mate 5'),
  (5, 'Mate 6'), (6, 'Mate 7'), (7, 'Mate 8'), (8, 'Mate 9'), (9, 'Mate 10'),
  (10, 'Mate 11')
on conflict (id) do nothing;

-- Row level security: anyone with the link can read and edit the 11 rows,
-- but nobody can add rows, delete rows, or touch anything else in the project.
alter table public.pledges enable row level security;

drop policy if exists "pledges are readable by anyone" on public.pledges;
create policy "pledges are readable by anyone"
  on public.pledges for select to anon, authenticated
  using (true);

drop policy if exists "pledges are editable by anyone" on public.pledges;
create policy "pledges are editable by anyone"
  on public.pledges for update to anon, authenticated
  using (true) with check (true);

-- Deliberately no insert or delete policy.
