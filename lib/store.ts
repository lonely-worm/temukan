export type ItemKind = 'lost' | 'found';
export type ItemStatus = 'open' | 'claimed' | 'resolved';

export type Item = {
  id: string;
  kind: ItemKind;
  title: string;
  category: string;
  location: string;
  date: string;
  status: ItemStatus;
  description: string;
  reporter: string;
  initials: string;
  color: string;
};

import { createHash, randomInt } from 'crypto';

export type Claim = { id: string; itemId: string; itemTitle: string; claimant: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string; otpVerifiedAt?: string; otpExpiresAt?: number; otpAttempts?: number; otpHash?: string };

const seedItems: Item[] = [
  { id: 'TMK-1042', kind: 'lost', title: 'Dompet kulit cokelat', category: 'Aksesori', location: 'Perpustakaan Pusat', date: '2026-11-16', status: 'open', description: 'Dompet kulit dengan kartu mahasiswa dan beberapa kartu bank.', reporter: 'Nadia Putri', initials: 'NP', color: '#e9a23b' },
  { id: 'TMK-1041', kind: 'found', title: 'Earbuds putih dalam case', category: 'Elektronik', location: 'Kantin Utama', date: '2026-11-15', status: 'open', description: 'Ditemukan di meja dekat jendela lantai dua.', reporter: 'Raka Wijaya', initials: 'RW', color: '#69a9a4' },
  { id: 'TMK-1039', kind: 'lost', title: 'Kunci motor Honda', category: 'Lainnya', location: 'Parkiran Timur', date: '2026-11-14', status: 'open', description: 'Gantungan kunci warna hitam dengan tag kecil.', reporter: 'Alya Sari', initials: 'AS', color: '#d27a62' },
  { id: 'TMK-1038', kind: 'found', title: 'Tumbler biru navy', category: 'Lainnya', location: 'Ruang Kelas 3.12', date: '2026-11-13', status: 'claimed', description: 'Tumbler navy dengan stiker gunung di bagian depan.', reporter: 'Dimas Adi', initials: 'DA', color: '#6f88c9' },
  { id: 'TMK-1035', kind: 'lost', title: 'Jaket denim oversized', category: 'Pakaian', location: 'Halte Utama', date: '2026-11-10', status: 'resolved', description: 'Jaket denim ukuran M dengan pin kecil di saku.', reporter: 'Maya Lestari', initials: 'ML', color: '#8e7ab5' },
];

let items = [...seedItems];
let claims: Claim[] = [{ id: 'CLM-18', itemId: 'TMK-1041', itemTitle: 'Earbuds putih dalam case', claimant: 'Bima Santoso', status: 'pending', createdAt: '2 jam lalu' }];
let notifications = [{ id: 1, text: 'Klaim baru menunggu verifikasi', time: '2 jam lalu', unread: true }, { id: 2, text: 'Laporan TMK-1038 berhasil diselesaikan', time: 'Kemarin', unread: false }];

export function getItems(filters?: { q?: string; kind?: string; category?: string }) {
  const q = (filters?.q || '').toLowerCase();
  return items.filter((item) => (!q || [item.title, item.location, item.description].some((v) => v.toLowerCase().includes(q))) && (!filters?.kind || filters.kind === 'all' || item.kind === filters.kind) && (!filters?.category || filters.category === 'Semua kategori' || item.category === filters.category));
}
export function addItem(input: Omit<Item, 'id' | 'status' | 'reporter' | 'initials' | 'color'>) {
  const item: Item = { ...input, id: `TMK-${1043 + items.length}`, status: 'open', reporter: 'Anda', initials: 'AN', color: '#52766f' };
  items = [item, ...items];
  return item;
}
export function addClaim(itemId: string, itemTitle: string) {
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  const claim = { id: `CLM-${18 + claims.length}`, itemId, itemTitle, claimant: 'Anda', status: 'pending' as const, createdAt: 'Baru saja', otpHash: createHash('sha256').update(code).digest('hex'), otpExpiresAt: Date.now() + 10 * 60 * 1000, otpAttempts: 0 };
  claims = [claim, ...claims];
  notifications = [{ id: Date.now(), text: `Klaim untuk ${itemTitle} terkirim`, time: 'Baru saja', unread: true }, ...notifications];
  return { claim, code };
}
export function getClaims() { return claims; }
export function getNotifications() { return notifications; }
export function toPublicClaim(claim: Claim) {
  const { otpHash: _otpHash, otpExpiresAt: _otpExpiresAt, otpAttempts: _otpAttempts, ...publicClaim } = claim;
  return publicClaim;
}

export function verifyClaimOtp(claimId: string, code: string) {
  const claim = claims.find((candidate) => candidate.id === claimId);
  if (!claim) return { ok: false, error: 'Klaim tidak ditemukan.' };
  if (claim.otpVerifiedAt) return { ok: true, claim };
  if ((claim.otpAttempts || 0) >= 5) return { ok: false, error: 'Batas percobaan OTP tercapai. Buat klaim baru.' };
  if (!claim.otpExpiresAt || Date.now() > claim.otpExpiresAt) return { ok: false, error: 'OTP sudah kedaluwarsa. Buat klaim baru.' };
  claim.otpAttempts = (claim.otpAttempts || 0) + 1;
  const valid = createHash('sha256').update(code.trim()).digest('hex') === claim.otpHash;
  if (!valid) return { ok: false, error: `Kode OTP salah. Sisa percobaan: ${5 - claim.otpAttempts}.` };
  claim.otpVerifiedAt = new Date().toISOString();
  notifications = [{ id: Date.now(), text: `OTP klaim ${claim.id} terverifikasi`, time: 'Baru saja', unread: true }, ...notifications];
  return { ok: true, claim };
}
