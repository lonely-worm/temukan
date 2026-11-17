'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (updateError) { setError('Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru dan coba kembali.'); return; }
    setPassword(''); setMessage('Kata sandi berhasil diperbarui. Silakan kembali ke aplikasi dan masuk.');
  }

  return <div className="app"><main className="content"><div className="panel" style={{ maxWidth: 520, margin: '70px auto' }}><div className="eyebrow" style={{ color: '#72817d' }}>Keamanan akun</div><h1 style={{ marginTop: 8 }}>Atur ulang kata sandi</h1><p>Masukkan kata sandi baru minimal 8 karakter.</p><form onSubmit={submit}><div className="field"><label htmlFor="new-password">Kata sandi baru</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)}/></div>{error && <p role="alert" style={{ color: '#b25745' }}>{error}</p>}{message && <p role="status" style={{ color: '#2d665c' }}>{message}</p>}<div className="actions"><Link className="btn btn-soft" href="/">Kembali</Link><button className="btn btn-primary" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan kata sandi'}</button></div></form></div></main></div>;
}
