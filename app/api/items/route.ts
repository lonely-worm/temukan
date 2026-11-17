import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Item, ItemKind } from '@/lib/types';

type ItemRow = {
  id: string;
  title: string;
  location: string;
  occurred_on: string;
  status: Item['status'];
  description: string;
  category_id: string | null;
};

function toItem(row: ItemRow, kind: ItemKind, categoryName?: string): Item {
  return {
    id: row.id,
    kind,
    title: row.title,
    category: categoryName || 'Lainnya',
    location: row.location,
    date: row.occurred_on,
    status: row.status,
    description: row.description || '',
    reporter: 'Komunitas',
    initials: 'KM',
    color: kind === 'lost' ? '#e9a23b' : '#69a9a4',
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const [lost, found] = await Promise.all([
    supabase.from('lost_items').select('id,title,location,occurred_on,status,description,category_id').order('occurred_on', { ascending: false }),
    supabase.from('found_items').select('id,title,location,occurred_on,status,description,category_id').order('occurred_on', { ascending: false }),
  ]);

  if (lost.error || found.error) {
    console.error('Supabase item query failed:', lost.error?.message || found.error?.message);
    return NextResponse.json({ error: 'Daftar barang belum dapat dimuat.' }, { status: 500 });
  }

  const lostRows = (lost.data || []) as unknown as ItemRow[];
  const foundRows = (found.data || []) as unknown as ItemRow[];
  const categoryIds = Array.from(new Set([...lostRows, ...foundRows].map((row) => row.category_id).filter((id): id is string => Boolean(id))));
  const { data: categories, error: categoriesError } = categoryIds.length
    ? await supabase.from('categories').select('id,name').in('id', categoryIds)
    : { data: [] as { id: string; name: string }[], error: null };
  if (categoriesError) {
    console.error('Supabase category lookup failed:', categoriesError.message);
    return NextResponse.json({ error: 'Kategori barang belum dapat dimuat.' }, { status: 500 });
  }
  const categoryNames = new Map((categories || []).map((entry) => [entry.id, entry.name]));
  const items = [
    ...lostRows.map((row) => toItem(row, 'lost', row.category_id ? categoryNames.get(row.category_id) : undefined)),
    ...foundRows.map((row) => toItem(row, 'found', row.category_id ? categoryNames.get(row.category_id) : undefined)),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLocaleLowerCase('id-ID');
  const kind = searchParams.get('kind') || 'all';
  const category = searchParams.get('category') || '';
  const filteredItems = items.filter((item) =>
    (!q || [item.title, item.location, item.description].some((value) => value.toLocaleLowerCase('id-ID').includes(q))) &&
    (kind === 'all' || item.kind === kind) &&
    (!category || category === 'Semua kategori' || item.category === category),
  );

  return NextResponse.json({ items: filteredItems });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Format data tidak valid.' }, { status: 400 });
  }

  const kind = body.kind;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const location = typeof body.location === 'string' ? body.location.trim() : '';
  const date = typeof body.date === 'string' ? body.date : '';
  const categoryName = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'Lainnya';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!title || !location || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (kind !== 'lost' && kind !== 'found')) {
    return NextResponse.json({ error: 'Data laporan belum lengkap atau tidak valid.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: 'Silakan masuk sebelum membuat laporan.' }, { status: 401 });

  const { data: category, error: categoryError } = await supabase.from('categories').select('id').eq('name', categoryName).maybeSingle();
  if (categoryError) {
    console.error('Supabase category query failed:', categoryError.message);
    return NextResponse.json({ error: 'Kategori belum dapat diperiksa.' }, { status: 500 });
  }
  if (!category) return NextResponse.json({ error: 'Kategori tidak ditemukan.' }, { status: 400 });

  const table = kind === 'lost' ? 'lost_items' : 'found_items';
  const { data, error } = await supabase.from(table).insert({
    reporter_id: authData.user.id,
    title,
    category_id: category.id,
    location,
    occurred_on: date,
    description,
  }).select('id,title,location,occurred_on,status,description,category_id').single();

  if (error || !data) {
    console.error('Supabase item insert failed:', error?.message);
    return NextResponse.json({ error: 'Laporan tidak dapat disimpan.' }, { status: 500 });
  }

  return NextResponse.json({ item: toItem(data as unknown as ItemRow, kind, categoryName) }, { status: 201 });
}
