# Persiapan TEMUKAN untuk production

Aplikasi memakai Supabase untuk database dan autentikasi, serta Resend untuk OTP klaim. Build lokal tidak menerapkan migration ke proyek Supabase dan tidak mengirim email. Gunakan checklist ini sebelum menerima pengguna production.

## 1. Environment server

Salin `.env.example` ke `.env.local` untuk pengembangan lokal. Tambahkan variabel berikut di environment server/deployment juga:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
RESEND_API_KEY=re_...
EMAIL_FROM=TEMUKAN <no-reply@your-verified-domain.example>
```

`SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, dan `EMAIL_FROM` hanya boleh berada di server; jangan beri prefix `NEXT_PUBLIC_`, jangan commit, dan jangan menaruhnya di browser. Secret Supabase dipakai oleh route server untuk operasi klaim/OTP yang secara sengaja tidak diizinkan langsung melalui RLS. Jangan memakai key tersebut pada komponen client. File `.env.local` sudah di-ignore oleh Git.

## 2. Supabase Auth

Di Supabase Dashboard, buka **Authentication → Providers → Email** dan aktifkan email/password serta konfirmasi alamat email. Untuk production, konfigurasi SMTP tepercaya agar pesan konfirmasi autentikasi sampai ke pengguna; jangan mengandalkan batas layanan email bawaan untuk trafik production.

Di **Authentication → URL Configuration**:

- Set **Site URL** ke origin production, misalnya `https://temukan.example.com`.
- Tambahkan redirect URL `https://temukan.example.com/auth/callback`.
- Untuk development, tambahkan `http://localhost:3000/auth/callback`.

UI menyediakan daftar/masuk. Akun baru harus mengklik tautan konfirmasi; callback aplikasi menukar kode menjadi cookie session. Middleware memperbarui session, dan API memeriksa user terverifikasi dengan `auth.getUser()`.

## 3. Resend untuk OTP klaim

Buat/verifikasi domain pengirim pada Resend, terapkan record DNS yang diberikan Resend, lalu buat API key dengan hak minimum yang diperlukan. Isi `RESEND_API_KEY` dan `EMAIL_FROM` di environment server lokal/deployment. `EMAIL_FROM` harus merupakan alamat pada domain yang sudah diverifikasi.

Kode klaim dibuat acak 6 digit, hanya hash yang disimpan di database, berlaku 10 menit, maksimal lima percobaan, dan pengiriman ulang diberi jeda minimal 60 detik. Jika email tidak dapat dikirim atau variabel email tidak ada, API mengembalikan kegagalan dan UI menawarkan kirim ulang; OTP tidak pernah dikirim balik dalam respons API.

## 4. Terapkan migration database

Setelah meninjau migration, hubungkan Supabase CLI ke project yang benar dan terapkan migration, termasuk `20261117103000_production_auth_otp.sql`:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

Perubahan migration mengaktifkan profil saat user mendaftar, mencegah pengguna mengubah role sendiri, melindungi baris klaim, serta menambahkan fungsi OTP dan aturan admin. **Jangan jalankan `db push` sebelum memeriksa project-ref dan isi migration di lingkungan target.** Build Next.js saja tidak membuktikan migration remote sudah diterapkan.

Setelah migration diterapkan, buat akun admin melalui UI, lalu promosikan akun pertama secara manual di SQL Editor Supabase setelah memeriksa emailnya:

```sql
update public.profiles p
set role = 'admin'
from auth.users u
where p.id = u.id and lower(u.email) = lower('admin@domain-anda.example');
```

Hanya admin yang dapat melihat antrean klaim semua pengguna dan menyetujui/menolak klaim. Jangan pernah menyediakan endpoint publik untuk mengubah role.

## 5. Verifikasi sebelum launch

1. Pastikan kelima env var ada di runtime server (secret tidak muncul di bundle client).
2. Pastikan URL/key Supabase cocok dengan project yang ter-link dan migration sudah diterapkan.
3. Daftar akun uji, konfirmasi email, keluar, lalu masuk kembali.
4. Buat laporan sebagai pengguna; pastikan row tersimpan dan tampil publik.
5. Ajukan klaim; pastikan email OTP benar-benar diterima, kode benar diterima, kode salah menambah percobaan, kode kedaluwarsa/lebih dari lima percobaan ditolak, dan resend dibatasi.
6. Uji isolasi RLS dengan dua akun berbeda. Pastikan pengguna biasa tidak dapat membaca klaim orang lain atau mengubah status/OTP melalui REST.
7. Promosikan admin uji dan pastikan hanya admin melihat antrean lintas pengguna serta dapat memproses klaim.
8. Jalankan `npm run build` dan tes alur pada origin production sebelum membuka akses umum.

## Catatan

Form bukti kepemilikan dan upload private bucket belum menjadi bagian dari alur UI saat ini, meskipun kolom `proof_path` ada pada skema. Untuk keputusan klaim yang benar-benar berbasis bukti, implementasikan upload ke bucket private dan tampilkan signed URL hanya kepada admin sebelum mengandalkan persetujuan admin sebagai proses verifikasi kepemilikan.
