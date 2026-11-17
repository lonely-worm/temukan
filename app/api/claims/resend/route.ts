import { createHash, randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendClaimOtpEmail } from '@/lib/email';

export async function POST(request: Request) {
  let body: { claimId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Format data tidak valid.' }, { status: 400 }); }
  if (typeof body.claimId !== 'string') return NextResponse.json({ error: 'Klaim tidak ditemukan.' }, { status: 400 });

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user?.email) return NextResponse.json({ error: 'Silakan masuk dengan email terlebih dahulu.' }, { status: 401 });
  if (!user.email_confirmed_at) return NextResponse.json({ error: 'Konfirmasi email akun sebelum meminta OTP klaim.' }, { status: 403 });

  const { data: row, error: claimError } = await supabase.from('claims').select('id,item_id,item_kind,status,otp_verified_at').eq('id', body.claimId).maybeSingle();
  if (claimError || !row) return NextResponse.json({ error: 'Klaim tidak ditemukan.' }, { status: 404 });
  if (row.status !== 'pending' || row.otp_verified_at) return NextResponse.json({ error: 'Klaim ini tidak memerlukan OTP lagi.' }, { status: 409 });
  if (!process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ error: 'Pengiriman ulang OTP belum dikonfigurasi oleh administrator.' }, { status: 503 });
  const table = row.item_kind === 'lost' ? 'lost_items' : 'found_items';
  const { data: item } = await supabase.from(table).select('title').eq('id', row.item_id).maybeSingle();
  if (!item) return NextResponse.json({ error: 'Barang klaim tidak ditemukan.' }, { status: 404 });

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const admin = createAdminClient();
  const { error: refreshError } = await admin.rpc('refresh_claim_otp', {
    p_claim_id: row.id,
    p_claimant_id: user.id,
    p_otp_hash: createHash('sha256').update(code).digest('hex'),
    p_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (refreshError) {
    const cooldown = /tunggu satu menit/i.test(refreshError.message);
    return NextResponse.json({ error: cooldown ? refreshError.message : 'OTP belum dapat diperbarui.' }, { status: cooldown ? 429 : 500 });
  }

  const sent = await sendClaimOtpEmail(user.email, item.title, code);
  if (!sent.ok) return NextResponse.json({ error: sent.configurationMissing ? 'Pengiriman email belum dikonfigurasi. Hubungi administrator.' : 'Email OTP gagal dikirim. Silakan coba lagi sebentar.' }, { status: 503 });
  return NextResponse.json({ sent: true });
}
