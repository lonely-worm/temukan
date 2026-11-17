import { createHash, randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendClaimOtpEmail } from '@/lib/email';
import type { Claim, Notification } from '@/lib/types';

type ClaimRow = {
  id: string;
  item_id: string;
  item_kind: 'lost' | 'found';
  claimant_id: string;
  status: Claim['status'];
  created_at: string;
  otp_verified_at: string | null;
};

function displayTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export async function GET() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ claims: [], notifications: [] as Notification[] });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  const isAdmin = profile?.role === 'admin';

  const [{ data: claimRows, error: claimsError }, { data: notificationRows, error: notificationsError }] = await Promise.all([
    supabase.from('claims').select('id,item_id,item_kind,claimant_id,status,created_at,otp_verified_at').order('created_at', { ascending: false }),
    supabase.from('notifications').select('id,message,read_at,created_at').order('created_at', { ascending: false }),
  ]);
  if (claimsError || notificationsError) {
    console.error('Supabase claim query failed:', claimsError?.message || notificationsError?.message);
    return NextResponse.json({ error: 'Data klaim belum dapat dimuat.' }, { status: 500 });
  }

  const rows = (claimRows || []) as ClaimRow[];
  const claimantIds = Array.from(new Set(rows.map((claim) => claim.claimant_id)));
  const { data: profiles } = claimantIds.length
    ? await supabase.from('profiles').select('id,full_name').in('id', claimantIds)
    : { data: [] as { id: string; full_name: string }[] };
  const claimantNames = new Map((profiles || []).map((entry) => [entry.id, entry.full_name]));
  const lostIds = rows.filter((claim) => claim.item_kind === 'lost').map((claim) => claim.item_id);
  const foundIds = rows.filter((claim) => claim.item_kind === 'found').map((claim) => claim.item_id);
  const [lostItems, foundItems] = await Promise.all([
    lostIds.length ? supabase.from('lost_items').select('id,title').in('id', lostIds) : Promise.resolve({ data: [], error: null }),
    foundIds.length ? supabase.from('found_items').select('id,title').in('id', foundIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (lostItems.error || foundItems.error) {
    console.error('Supabase claimed-item query failed:', lostItems.error?.message || foundItems.error?.message);
    return NextResponse.json({ error: 'Detail barang klaim belum dapat dimuat.' }, { status: 500 });
  }

  const titles = new Map<string, string>();
  for (const item of [...(lostItems.data || []), ...(foundItems.data || [])]) titles.set(item.id, item.title);
  const claims: Claim[] = rows.map((claim) => ({
    id: claim.id,
    itemId: claim.item_id,
    itemTitle: titles.get(claim.item_id) || 'Barang tidak tersedia',
    claimant: isAdmin ? (claimantNames.get(claim.claimant_id) || 'Pengguna') : 'Anda',
    status: claim.status,
    createdAt: displayTime(claim.created_at),
    ...(claim.otp_verified_at ? { otpVerifiedAt: claim.otp_verified_at } : {}),
  }));
  const notifications: Notification[] = (notificationRows || []).map((notification) => ({
    id: notification.id,
    text: notification.message,
    time: displayTime(notification.created_at),
    unread: !notification.read_at,
  }));

  return NextResponse.json({ claims, notifications });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Format data tidak valid.' }, { status: 400 });
  }
  const itemId = typeof body.itemId === 'string' ? body.itemId : '';
  const itemKind = body.itemKind;
  if (!itemId || (itemKind !== 'lost' && itemKind !== 'found')) {
    return NextResponse.json({ error: 'Barang yang diklaim belum dipilih.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: 'Silakan masuk sebelum mengajukan klaim.' }, { status: 401 });
  if (!authData.user.email || !authData.user.email_confirmed_at) return NextResponse.json({ error: 'Konfirmasi email akun sebelum mengajukan klaim.' }, { status: 403 });

  const table = itemKind === 'lost' ? 'lost_items' : 'found_items';
  const { data: item, error: itemError } = await supabase.from(table).select('id,title,status').eq('id', itemId).maybeSingle();
  if (itemError) {
    console.error('Supabase claim item query failed:', itemError.message);
    return NextResponse.json({ error: 'Barang belum dapat diperiksa.' }, { status: 500 });
  }
  if (!item || item.status !== 'open') return NextResponse.json({ error: 'Barang tidak ditemukan atau tidak lagi terbuka untuk klaim.' }, { status: 404 });

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const otpHash = createHash('sha256').update(code).digest('hex');
  if (!process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ error: 'Operasi klaim belum dikonfigurasi oleh administrator.' }, { status: 503 });
  const admin = createAdminClient();
  const { data: claim, error: insertError } = await admin.from('claims').insert({
    item_id: item.id,
    claimant_id: authData.user.id,
    item_kind: itemKind,
    otp_hash: otpHash,
    otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    otp_last_sent_at: new Date().toISOString(),
  }).select('id,item_id,item_kind,status,created_at,otp_verified_at').single();

  if (insertError || !claim) {
    console.error('Supabase claim insert failed:', insertError?.message);
    return NextResponse.json({ error: 'Klaim tidak dapat disimpan.' }, { status: 500 });
  }

  const result: Claim = {
    id: claim.id,
    itemId: claim.item_id,
    itemTitle: item.title,
    claimant: 'Anda',
    status: claim.status,
    createdAt: 'Baru saja',
  };
  const sent = await sendClaimOtpEmail(authData.user.email, item.title, code);
  if (!sent.ok) return NextResponse.json({ claim: result, error: sent.configurationMissing ? 'Klaim tersimpan, tetapi pengiriman email belum dikonfigurasi. Hubungi administrator atau kirim ulang OTP setelah konfigurasi selesai.' : 'Klaim tersimpan, tetapi email OTP gagal dikirim. Silakan kirim ulang OTP.' }, { status: 503 });
  return NextResponse.json({ claim: result, emailSent: true }, { status: 201 });
}
