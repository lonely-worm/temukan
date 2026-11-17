-- Production auth profile lifecycle and claim OTP hardening.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Users must not be able to promote their own profile by updating role.
drop policy if exists "users update own profile" on public.profiles;
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
create policy "admins read all profiles" on public.profiles
for select to authenticated using (public.is_admin());

-- PostgreSQL LIKE does not copy foreign keys; add the missing category relationship.
do $do$ begin if not exists (select 1 from pg_constraint where conname = 'found_items_category_fk' and conrelid = 'public.found_items'::regclass) then alter table public.found_items add constraint found_items_category_fk foreign key (category_id) references public.categories(id); end if; end $do$;

alter table public.claims add column if not exists otp_last_sent_at timestamptz;
drop policy if exists "users create own claims" on public.claims;
drop policy if exists "users update own claims" on public.claims;
create policy "admins read all claims" on public.claims
for select to authenticated using (public.is_admin());
create policy "admins update claim decisions" on public.claims
for update to authenticated using (public.is_admin() and otp_verified_at is not null)
with check (public.is_admin() and otp_verified_at is not null);

-- Remove the earlier authenticated RPC; OTP verification is server-only now.
drop function if exists public.verify_claim_otp(uuid, text);
create or replace function public.verify_claim_otp(p_claim_id uuid, p_claimant_id uuid, p_otp_hash text)
returns public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.claims;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Not authorized';
  end if;

  select c.* into result
  from public.claims c
  where c.id = p_claim_id and c.claimant_id = p_claimant_id
  for update;

  if result.id is null then
    raise exception 'Klaim tidak ditemukan';
  end if;
  if result.otp_verified_at is not null then
    return result;
  end if;
  if result.otp_expires_at is null or result.otp_expires_at <= now() then
    raise exception 'OTP kedaluwarsa';
  end if;
  if result.otp_attempts >= 5 then
    raise exception 'Batas percobaan OTP tercapai';
  end if;
  if result.otp_hash is distinct from p_otp_hash then
    update public.claims c set otp_attempts = c.otp_attempts + 1
    where c.id = p_claim_id returning c.* into result;
    return null;
  end if;

  update public.claims c set otp_attempts = c.otp_attempts + 1, otp_verified_at = now()
  where c.id = p_claim_id returning c.* into result;
  return result;
end;
$$;
revoke all on function public.verify_claim_otp(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.verify_claim_otp(uuid, uuid, text) to service_role;

create or replace function public.refresh_claim_otp(p_claim_id uuid, p_claimant_id uuid, p_otp_hash text, p_expires_at timestamptz)
returns public.claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.claims;
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Not authorized';
  end if;

  update public.claims c
  set otp_hash = p_otp_hash,
      otp_expires_at = p_expires_at,
      otp_attempts = 0,
      otp_last_sent_at = now()
  where c.id = p_claim_id
    and c.claimant_id = p_claimant_id
    and c.status = 'pending'
    and c.otp_verified_at is null
    and c.otp_attempts < 5
    and (c.otp_last_sent_at is null or c.otp_last_sent_at <= now() - interval '60 seconds')
  returning c.* into result;

  if result.id is null then
    raise exception 'Klaim tidak dapat diperbarui; tunggu satu menit, pastikan belum diverifikasi, dan coba kembali';
  end if;
  return result;
end;
$$;
revoke all on function public.refresh_claim_otp(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.refresh_claim_otp(uuid, uuid, text, timestamptz) to service_role;
