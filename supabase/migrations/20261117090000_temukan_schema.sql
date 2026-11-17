create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table if not exists public.lost_items (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category_id uuid references public.categories(id),
  location text not null,
  occurred_on date not null,
  description text not null default '',
  status text not null default 'open' check (status in ('open','claimed','resolved','moderated')),
  created_at timestamptz not null default now()
);

create table if not exists public.found_items (like public.lost_items including all);
alter table public.found_items add constraint found_items_reporter_fk foreign key (reporter_id) references auth.users(id) on delete cascade;
alter table public.found_items add constraint found_items_category_fk foreign key (category_id) references public.categories(id);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  claimant_id uuid not null references auth.users(id) on delete cascade,
  item_kind text not null check (item_kind in ('lost','found')),
  proof_path text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  otp_hash text,
  otp_expires_at timestamptz,
  otp_attempts smallint not null default 0 check (otp_attempts between 0 and 5),
  otp_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists lost_items_search_idx on public.lost_items (status, category_id, occurred_on desc);
create index if not exists found_items_search_idx on public.found_items (status, category_id, occurred_on desc);
create index if not exists claims_claimant_idx on public.claims (claimant_id, status, created_at desc);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.lost_items enable row level security;
alter table public.found_items enable row level security;
alter table public.claims enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;

create policy "users read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "public read categories" on public.categories for select to anon, authenticated using (true);
create policy "public read open lost items" on public.lost_items for select to anon, authenticated using (status in ('open','claimed','resolved'));
create policy "users insert own lost items" on public.lost_items for insert to authenticated with check ((select auth.uid()) = reporter_id);
create policy "users update own lost items" on public.lost_items for update to authenticated using ((select auth.uid()) = reporter_id) with check ((select auth.uid()) = reporter_id);
create policy "public read open found items" on public.found_items for select to anon, authenticated using (status in ('open','claimed','resolved'));
create policy "users insert own found items" on public.found_items for insert to authenticated with check ((select auth.uid()) = reporter_id);
create policy "users update own found items" on public.found_items for update to authenticated using ((select auth.uid()) = reporter_id) with check ((select auth.uid()) = reporter_id);
create policy "users read own claims" on public.claims for select to authenticated using ((select auth.uid()) = claimant_id);
create policy "users create own claims" on public.claims for insert to authenticated with check ((select auth.uid()) = claimant_id);
create policy "users update own claims" on public.claims for update to authenticated using ((select auth.uid()) = claimant_id) with check ((select auth.uid()) = claimant_id);
create policy "users read own notifications" on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy "users mark own notifications" on public.notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "admins read logs" on public.activity_logs for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.categories (name) values ('Aksesori'), ('Elektronik'), ('Pakaian'), ('Lainnya') on conflict (name) do nothing;
