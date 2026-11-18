// Set admin account to a real email. Usage: node scripts/set-admin.mjs
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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = 'azafarran@gmail.com';
const password = randomBytes(9).toString('base64url');

const { data: list, error: listError } = await supabase.auth.admin.listUsers();
if (listError) throw listError;

let admin = list.users.find((u) => u.email === email);
if (!admin) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Azmy Hanif' },
  });
  if (error) throw error;
  admin = data.user;
  console.log(`Akun admin dibuat: ${email}`);
  console.log(`Password sementara: ${password}`);
} else {
  const { error } = await supabase.auth.admin.updateUserById(admin.id, { password, email_confirm: true });
  if (error) throw error;
  console.log(`Password akun ${email} direset:`);
  console.log(`Password sementara: ${password}`);
}

const { error: profileError } = await supabase
  .from('profiles')
  .upsert({ id: admin.id, full_name: 'Azmy Hanif', role: 'admin' }, { onConflict: 'id' });
if (profileError) throw profileError;
console.log('Role admin dipastikan.');

const old = list.users.find((u) => u.email === 'admin@temukan.app');
if (old) {
  const { error } = await supabase.auth.admin.deleteUser(old.id);
  if (error) throw error;
  console.log('Akun admin@temukan.app dihapus.');
}

console.log('Selesai.');
