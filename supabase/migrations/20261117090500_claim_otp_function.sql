create or replace function public.verify_claim_otp(p_claim_id uuid, p_otp_hash text)
returns public.claims
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.claims;
begin
  update public.claims
  set otp_attempts = otp_attempts + 1,
      otp_verified_at = now()
  where id = p_claim_id
    and claimant_id = auth.uid()
    and otp_verified_at is null
    and otp_expires_at > now()
    and otp_attempts < 5
    and otp_hash = p_otp_hash
  returning * into result;

  if result.id is null then
    raise exception 'OTP tidak valid, kedaluwarsa, atau batas percobaan tercapai';
  end if;
  return result;
end;
$$;

revoke all on function public.verify_claim_otp(uuid, text) from public, anon;
grant execute on function public.verify_claim_otp(uuid, text) to authenticated;
