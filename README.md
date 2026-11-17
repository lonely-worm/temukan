# TEMUKAN

Aplikasi lost & found berbasis Next.js, TypeScript, Supabase (database + Auth), dan Resend untuk email OTP klaim.

## Menjalankan lokal

```bash
npm install
# isi .env.local berdasarkan .env.example
npm run dev
```

Buka `http://localhost:3000`.

## Fitur

- Dashboard laporan dengan pencarian dan filter dari Supabase.
- Registrasi/masuk Supabase Auth dengan konfirmasi email dan refresh cookie session.
- Pembuatan laporan oleh pengguna terautentikasi.
- Klaim barang dengan OTP email 6 digit; hash disimpan di database, masa berlaku 10 menit, maksimal 5 percobaan, dan resend cooldown 60 detik.
- Dasbor klaim pengguna serta antrean admin dengan tindakan setujui/tolak.
- Supabase RLS dan migration untuk profil, role, serta operasi klaim/OTP.

## Konfigurasi production

Baca [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) untuk menyiapkan Supabase Auth, Resend, environment server, migration, akun admin, dan tes sebelum launch. Aplikasi belum siap menerima trafik production sampai secret Supabase server-only dan konfigurasi Resend diisi, migration diterapkan ke project target, SMTP/redirect Supabase Auth dikonfigurasi, dan alur end-to-end diverifikasi.

`SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, serta alamat `EMAIL_FROM` tidak boleh diekspos ke browser. Jangan commit `.env.local`.
