import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(request: Request, context: { params: { itemId: string } }) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: 'Silakan masuk.' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Hanya admin yang dapat menghapus laporan.' }, { status: 403 });

  const kindParam = new URL(request.url).searchParams.get('kind');
  if (kindParam !== 'lost' && kindParam !== 'found') return NextResponse.json({ error: 'Jenis laporan tidak valid.' }, { status: 400 });

  const table = kindParam === 'lost' ? 'lost_items' : 'found_items';
  const { error } = await supabase.from(table).delete().eq('id', context.params.itemId);
  if (error) {
    console.error('Admin item delete failed:', error.message);
    return NextResponse.json({ error: 'Laporan belum dapat dihapus.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
