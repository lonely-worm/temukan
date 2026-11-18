// Seed production Supabase: admin user + sample items.
// Usage: node scripts/seed.mjs
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY wajib diisi di .env.local');
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

const adminEmail = 'azafarran@gmail.com';
const adminPassword = randomBytes(9).toString('base64url');

let { data: users, error: listError } = await supabase.auth.admin.listUsers();
if (listError) throw listError;
let admin = users.users.find((u) => u.email === adminEmail);

if (!admin) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Azmy Hanif' },
  });
  if (error) throw error;
  admin = data.user;
  console.log(`Akun admin dibuat: ${adminEmail}`);
  console.log(`Password sementara: ${adminPassword}`);
} else {
  console.log(`Akun admin sudah ada: ${adminEmail}`);
}

const { error: profileError } = await supabase
  .from('profiles')
  .upsert({ id: admin.id, full_name: 'Azmy Hanif', role: 'admin' }, { onConflict: 'id' });
if (profileError) throw profileError;
console.log('Role admin dipastikan di profiles.');

const { data: categories, error: catError } = await supabase.from('categories').select('id,name');
if (catError) throw catError;
const catId = (name) => categories.find((c) => c.name === name)?.id || null;

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const samples = [
  { table: 'lost_items', title: 'Dompet kulit cokelat', category: 'Aksesori', location: 'Perpustakaan Pusat', occurred_on: daysAgo(1), description: 'Dompet kulit dengan kartu mahasiswa dan beberapa kartu bank.', status: 'open' },
  { table: 'found_items', title: 'Earbuds putih dalam case', category: 'Elektronik', location: 'Kantin Utama', occurred_on: daysAgo(2), description: 'Ditemukan di meja dekat jendela lantai dua.', status: 'open' },
  { table: 'lost_items', title: 'Kunci motor Honda', category: 'Lainnya', location: 'Parkiran Timur', occurred_on: daysAgo(3), description: 'Gantungan kunci warna hitam dengan tag kecil.', status: 'open' },
  { table: 'found_items', title: 'Tumbler biru navy', category: 'Lainnya', location: 'Ruang Kelas 3.12', occurred_on: daysAgo(4), description: 'Tumbler navy dengan stiker gunung di bagian depan.', status: 'claimed' },
  { table: 'lost_items', title: 'Jaket denim oversized', category: 'Pakaian', location: 'Halte Utama', occurred_on: daysAgo(7), description: 'Jaket denim ukuran M dengan pin kecil di saku.', status: 'resolved' },
  { table: 'found_items', title: 'Payung lipat merah', category: 'Lainnya', location: 'Gerbang Barat', occurred_on: daysAgo(5), description: 'Payung merah dengan gagang kayu.', status: 'open' },
];

for (const item of samples) {
  const { error } = await supabase.from(item.table).insert({
    reporter_id: admin.id,
    title: item.title,
    category_id: catId(item.category),
    location: item.location,
    occurred_on: item.occurred_on,
    description: item.description,
    status: item.status,
  });
  if (error) throw new Error(`${item.title}: ${error.message}`);
  console.log(`Inserted ${item.table}: ${item.title}`);
}

console.log('Seed selesai.');
