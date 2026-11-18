import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: 'Silakan masuk untuk mengunggah foto.' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const itemId = formData.get('itemId') as string | null;
  const kind = formData.get('kind') as string | null;

  if (!file || !itemId || (kind !== 'lost' && kind !== 'found')) {
    return NextResponse.json({ error: 'Data tidak lengkap.' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Hanya file gambar yang diperbolehkan.' }, { status: 400 });
  }

  if (file.size > 1024 * 1024) {
    return NextResponse.json({ error: 'Ukuran file maksimal 1MB.' }, { status: 400 });
  }

  const table = kind === 'lost' ? 'lost_items' : 'found_items';
  const { data: item, error: itemError } = await supabase.from(table).select('id,reporter_id').eq('id', itemId).maybeSingle();
  if (itemError || !item) return NextResponse.json({ error: 'Laporan tidak ditemukan.' }, { status: 404 });
  if (item.reporter_id !== authData.user.id) return NextResponse.json({ error: 'Anda tidak berhak mengunggah foto untuk laporan ini.' }, { status: 403 });

  const ext = file.name.split('.').pop() || 'jpg';
  const filename = `${itemId}.${ext}`;

  const admin = createAdminClient();
  const { data: uploadData, error: uploadError } = await admin.storage.from('item-photos').upload(filename, file, { upsert: true });
  if (uploadError) {
    console.error('Storage upload failed:', uploadError.message);
    return NextResponse.json({ error: 'Gagal mengunggah foto.' }, { status: 500 });
  }

  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${filename}`;
  const { error: updateError } = await supabase.from(table).update({ photo_path: publicUrl }).eq('id', itemId);
  if (updateError) {
    console.error('Photo path update failed:', updateError.message);
    return NextResponse.json({ error: 'Foto terunggah, tetapi gagal menyimpan referensi.' }, { status: 500 });
  }

  return NextResponse.json({ url: publicUrl });
}
