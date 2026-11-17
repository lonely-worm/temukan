import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, context: { params: { claimId: string } }) {
  let body: { status?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Format data tidak valid.' }, { status: 400 }); }
  if (body.status !== 'approved' && body.status !== 'rejected') return NextResponse.json({ error: 'Status keputusan tidak valid.' }, { status: 400 });

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: 'Silakan masuk.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Hanya admin yang dapat memutuskan klaim.' }, { status: 403 });

  const { data: claim, error } = await supabase.from('claims').update({ status: body.status }).eq('id', context.params.claimId).eq('status', 'pending').not('otp_verified_at', 'is', null).select('id,status').maybeSingle();
  if (error) {
    console.error('Admin claim update failed:', error.message);
    return NextResponse.json({ error: 'Keputusan klaim belum dapat disimpan.' }, { status: 500 });
  }
  if (!claim) return NextResponse.json({ error: 'Klaim tidak ditemukan atau sudah diproses.' }, { status: 404 });
  return NextResponse.json({ claim });
}
