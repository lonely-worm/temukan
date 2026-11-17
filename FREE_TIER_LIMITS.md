# TEMUKAN — Batas Gratis dan Arsitektur Lokal

Versi ini sengaja berjalan lokal tanpa layanan berbayar atau kartu kredit. Data demo disimpan di memory server pada `lib/store.ts`, sehingga cocok untuk demonstrasi dan pengembangan awal.

## Rencana provider gratis saat produksi

| Fungsi | Provider | Kuota gratis yang perlu dipantau | Potensi biaya |
|---|---|---|---|
| Database + Auth + Storage | Supabase Free | Kuota database, bandwidth, storage, dan MAU mengikuti paket Free aktif | Tidak ada selama tetap di Free dan billing tidak diaktifkan |
| Hosting | Vercel Hobby atau Cloudflare Pages | Batas build, bandwidth, function execution sesuai paket | Hindari pay-as-you-go dan jangan menambahkan metode pembayaran |
| Source control | GitHub Free | Repository publik/pribadi dan Actions sesuai batas akun | Tidak ada selama memakai fitur Free |

## Guardrail biaya

- Jangan mengaktifkan billing atau pay-as-you-go.
- Batasi foto menjadi WebP/JPEG maksimal 5 MB di sisi server.
- Gunakan pagination dan index pada `category`, `location`, `status`, dan `created_at`.
- Jika kuota provider habis, tampilkan error yang bisa dipahami dan hentikan operasi kuota-intensif.
- Email verification/reset password memerlukan SMTP bawaan provider atau konfigurasi SMTP gratis yang memang tersedia; aplikasi tidak mengasumsikan SMTP berbayar.

## Migrasi ke backend nyata

1. Buat project Supabase Free tanpa memasukkan kartu.
2. Jalankan migrasi SQL untuk tabel `profiles`, `categories`, `lost_items`, `found_items`, `claims`, `notifications`, dan `activity_logs`.
3. Pindahkan fungsi pada `lib/store.ts` ke Supabase server client.
4. Aktifkan RLS: data publik hanya membaca laporan berstatus approved; pemilik dapat mengubah laporan sendiri; bukti klaim berada di bucket private.
5. Simpan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di `.env.local`; secret key tidak boleh masuk ke client.
