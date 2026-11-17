import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Claim } from '@/lib/types';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Format data tidak valid.' }, { status: 400 });
  }
  const claimId = typeof body.claimId === 'string' ? body.claimId : '';
  const code = typeof body.code === 'string' ? body.code : '';
  if (!claimId || !/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Masukkan kode OTP 6 digit.' }, { status: 400 });

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: 'Silakan masuk sebelum memverifikasi klaim.' }, { status: 401 });
  if (!process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ error: 'Verifikasi klaim belum dikonfigurasi oleh administrator.' }, { status: 503 });

  const otpHash = createHash('sha256').update(code).digest('hex');
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('verify_claim_otp', { p_claim_id: claimId, p_claimant_id: authData.user.id, p_otp_hash: otpHash });
  if (error || !data) {
    const message = error?.message || 'OTP tidak valid atau kedaluwarsa.';
    const status = /not found|does not exist|invalid input syntax/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: status === 404 ? 'Klaim tidak ditemukan.' : 'OTP tidak valid, kedaluwarsa, atau batas percobaan tercapai.' }, { status });
  }

  const verified = Array.isArray(data) ? data[0] : data;
  const table = verified.item_kind === 'lost' ? 'lost_items' : 'found_items';
  const { data: item } = await supabase.from(table).select('title').eq('id', verified.item_id).maybeSingle();
  const claim: Claim = {
    id: verified.id,
    itemId: verified.item_id,
    itemTitle: item?.title || 'Barang tidak tersedia',
    claimant: 'Anda',
    status: verified.status,
    createdAt: new Date(verified.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
    ...(verified.otp_verified_at ? { otpVerifiedAt: verified.otp_verified_at } : {}),
  };
  return NextResponse.json({ claim });
}
