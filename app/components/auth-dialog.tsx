'use client';

import { FormEvent, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function AuthDialog({ onClose, onAuthenticated }: { onClose: () => void; onAuthenticated: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage(''); setError('');
    const supabase = createClient();
    try {
      if (mode === 'forgot') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
        });
        if (authError) throw authError;
        setMessage('Jika email terdaftar, tautan untuk mengatur ulang kata sandi akan dikirim.');
      } else if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
          },
        });
        if (authError) throw authError;
        if (data.session) onAuthenticated();
        else setMessage('Akun dibuat. Periksa email Anda dan konfirmasi alamat sebelum masuk.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        onAuthenticated();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Autentikasi gagal. Coba lagi.');
    } finally { setBusy(false); }
  }

  return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: '#193b3655', display: 'grid', placeItems: 'center', zIndex: 20, padding: 20 }}>
    <section className="panel" role="dialog" aria-modal="true" aria-labelledby="auth-title" style={{ width: 'min(440px,100%)', boxShadow: '0 22px 60px #193b3630' }}>
      <div className="section-head"><div><div className="eyebrow" style={{ color: '#72817d' }}>Akun TEMUKAN</div><h2 id="auth-title" style={{ marginBottom: 6 }}>{mode === 'signin' ? 'Masuk' : mode === 'signup' ? 'Buat akun' : 'Atur ulang kata sandi'}</h2><p style={{ fontSize: 13, color: '#72817d', margin: 0 }}>Gunakan email terverifikasi untuk mengirim dan memverifikasi klaim.</p></div><button type="button" className="icon-btn" aria-label="Tutup" onClick={onClose}><X size={17}/></button></div>
      <form onSubmit={submit}>
        <div className="form-grid">
          {mode === 'signup' && <div className="field full"><label htmlFor="auth-name">Nama</label><input id="auth-name" autoComplete="name" required maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)}/></div>}
          <div className="field full"><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}/></div>
          {mode !== 'forgot' && <div className="field full"><label htmlFor="auth-password">Kata sandi</label><input id="auth-password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)}/></div>}
        </div>
        {message && <p role="status" style={{ color: '#2d665c', fontSize: 13 }}>{message}</p>}
        {error && <p role="alert" style={{ color: '#b25745', fontSize: 13 }}>{error}</p>}
        <div className="actions"><button type="button" className="btn btn-soft" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }}>{mode === 'signup' ? 'Sudah punya akun? Masuk' : mode === 'forgot' ? 'Kembali ke masuk' : 'Buat akun'}</button>{mode === 'signin' && <button type="button" className="btn btn-soft" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}>Lupa kata sandi?</button>}<button className="btn btn-primary" disabled={busy}>{busy ? 'Memproses...' : mode === 'signin' ? 'Masuk' : mode === 'signup' ? 'Daftar' : 'Kirim tautan'}</button></div>
      </form>
    </section>
  </div>;
}
