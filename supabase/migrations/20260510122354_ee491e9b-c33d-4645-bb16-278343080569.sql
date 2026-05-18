
create table public.watchlist_symbols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  created_at timestamptz not null default now(),
  unique(user_id, symbol)
);
alter table public.watchlist_symbols enable row level security;
create policy "own watchlist select" on public.watchlist_symbols for select using (auth.uid() = user_id);
create policy "own watchlist insert" on public.watchlist_symbols for insert with check (auth.uid() = user_id);
create policy "own watchlist delete" on public.watchlist_symbols for delete using (auth.uid() = user_id);

create table public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  timeframe text not null,
  status text not null default 'running',
  symbols_total int not null default 0,
  symbols_done int not null default 0,
  patterns_found int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.scan_runs enable row level security;
create policy "own scan_runs select" on public.scan_runs for select using (auth.uid() = user_id);
create policy "own scan_runs insert" on public.scan_runs for insert with check (auth.uid() = user_id);
create policy "own scan_runs update" on public.scan_runs for update using (auth.uid() = user_id);
create policy "own scan_runs delete" on public.scan_runs for delete using (auth.uid() = user_id);

create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_run_id uuid references public.scan_runs(id) on delete set null,
  symbol text not null,
  timeframe text not null,
  pattern_name text not null,
  direction text not null,
  status text not null,
  confidence numeric not null,
  x_date timestamptz, x_price numeric,
  a_date timestamptz, a_price numeric,
  b_date timestamptz, b_price numeric,
  c_date timestamptz, c_price numeric,
  d_date timestamptz, d_price numeric,
  prz_low numeric, prz_high numeric,
  invalidation numeric,
  progress_pct numeric,
  ratios jsonb,
  created_at timestamptz not null default now()
);
alter table public.patterns enable row level security;
create policy "own patterns select" on public.patterns for select using (auth.uid() = user_id);
create policy "own patterns insert" on public.patterns for insert with check (auth.uid() = user_id);
create policy "own patterns delete" on public.patterns for delete using (auth.uid() = user_id);

create index patterns_user_status_idx on public.patterns(user_id, status, created_at desc);
create index patterns_symbol_idx on public.patterns(user_id, symbol);
