'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, FilePlus2, LayoutDashboard, MapPin, Package, Search, ShieldCheck, UserRound, X, Upload, XCircle, Trash2 } from 'lucide-react';
import type { Claim, Item } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { AuthDialog } from '@/app/components/auth-dialog';

type View = 'dashboard' | 'report' | 'claims' | 'admin';

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<View>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [notifications, setNotifications] = useState<{ id: number; text: string; time: string; unread: boolean }[]>([]);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [category, setCategory] = useState('Semua kategori');
  const [toast, setToast] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [otpClaim, setOtpClaim] = useState<{ id: string; title: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [moderatingId, setModeratingId] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authRole, setAuthRole] = useState<'user' | 'admin' | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [report, setReport] = useState({ kind: 'lost', title: '', category: 'Aksesori', location: '', date: '2026-11-17', description: '' });
  const [reportPhoto, setReportPhoto] = useState<File | null>(null);
  const [reportPhotoPreview, setReportPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function load() {
    const res = await fetch(`/api/items?q=${encodeURIComponent(query)}&kind=${kind}&category=${encodeURIComponent(category)}`);
    const data = await res.json();
    setItems(data.items || []);
    const claimRes = await fetch('/api/claims');
    const claimData = await claimRes.json();
    setClaims(claimData.claims || []);
    setNotifications(claimData.notifications || []);
  }

  useEffect(() => {
    let active = true;
    const setSession = async (email: string | null) => {
      if (!active) return;
      setUserEmail(email);
      if (!email) { setAuthRole(null); setClaims([]); setNotifications([]); return; }
      const response = await fetch('/api/me');
      const data = await response.json();
      if (active) setAuthRole(data.profile?.role || 'user');
    };
    supabase.auth.getUser().then(({ data }) => { void setSession(data.user?.email || null); setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { void setSession(session?.user?.email || null); setAuthReady(true); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => { load(); }, [query, kind, category, userEmail]);

  useEffect(() => {
    if (authRole !== 'admin') { setUserCount(null); return; }
    supabase.from('profiles').select('id', { count: 'exact', head: true }).then(({ count }) => setUserCount(count ?? 0));
  }, [authRole, supabase]);

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); }, [toast]);

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) setShowAuth(true);
      else setToast(data.error || 'Laporan tidak dapat dibuat.');
      return;
    }
    if (reportPhoto && data.item?.id) {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append('file', reportPhoto);
      formData.append('itemId', data.item.id);
      formData.append('kind', report.kind);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      setUploadingPhoto(false);
      if (!uploadRes.ok) setToast('Laporan dibuat, tetapi foto gagal diunggah.');
    }
    setToast('Laporan berhasil dibuat dan masuk ke daftar publik.');
    setReport({ kind: 'lost', title: '', category: 'Aksesori', location: '', date: new Date().toISOString().slice(0, 10), description: '' });
    setReportPhoto(null);
    setReportPhotoPreview(null);
    setView('dashboard');
    load();
  }

  async function claim(item: Item) {
    if (!userEmail) { setShowAuth(true); return; }
    const res = await fetch('/api/claims', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: item.id, itemKind: item.kind }) });
    const data = await res.json();
    if (data.claim) { setOtpClaim({ id: data.claim.id, title: item.title }); setOtpCode(''); setOtpError(data.error || 'Kode verifikasi dikirim ke email akun Anda.'); load(); }
    else setToast(data.error || 'Klaim tidak dapat dibuat.');
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpClaim) return;
    setOtpBusy(true);
    setOtpError('');
    const res = await fetch('/api/claims/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claimId: otpClaim.id, code: otpCode }) });
    const data = await res.json();
    setOtpBusy(false);
    if (!res.ok) { setOtpError(data.error || 'Verifikasi gagal.'); return; }
    setOtpClaim(null);
    setOtpCode('');
    setToast('OTP berhasil diverifikasi. Klaim masuk ke antrean admin.');
    load();
  }

  async function resendOtp() {
    if (!otpClaim) return;
    setResendBusy(true);
    setOtpError('');
    const res = await fetch('/api/claims/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claimId: otpClaim.id }) });
    const data = await res.json();
    setResendBusy(false);
    setOtpError(res.ok ? 'Kode OTP baru sudah dikirim ke email akun Anda.' : data.error || 'OTP belum dapat dikirim.');
  }

  async function moderateClaim(id: string, status: 'approved' | 'rejected') {
    setModeratingId(id);
    const res = await fetch(`/api/claims/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const data = await res.json();
    setModeratingId(null);
    if (!res.ok) { setToast(data.error || 'Keputusan klaim gagal disimpan.'); return; }
    setToast(status === 'approved' ? 'Klaim disetujui.' : 'Klaim ditolak.');
    load();
  }

  async function deleteItem(itemId: string, kind: 'lost' | 'found') {
    if (!confirm('Hapus laporan ini? Tindakan tidak dapat dibatalkan.')) return;
    const res = await fetch(`/api/items/${itemId}?kind=${kind}`, { method: 'DELETE' });
    if (!res.ok) { const data = await res.json(); setToast(data.error || 'Gagal menghapus laporan.'); return; }
    setToast('Laporan dihapus.');
    load();
  }

  const openCount = items.filter((i) => i.status === 'open').length;
  const resolvedCount = items.filter((i) => i.status === 'resolved').length;
  const myClaims = claims.filter((c) => c.claimant === 'Anda').length;

  return <div className="app">
    <header className="topbar">
      <button className="brand" onClick={() => setView('dashboard')}><span className="brand-mark" />TEMUKAN</button>
      <nav className="nav">
        <a className={view === 'dashboard' ? 'active' : ''} href="#dashboard" onClick={() => setView('dashboard')}>Jelajah</a>
        <a className={view === 'report' ? 'active' : ''} href="#laporkan" onClick={(e) => { e.preventDefault(); if (userEmail) setView('report'); else setShowAuth(true); }}>Laporkan</a>
        <a className={view === 'claims' ? 'active' : ''} href="#klaim" onClick={(e) => { e.preventDefault(); if (userEmail) setView('claims'); else setShowAuth(true); }}>Klaim saya</a>
        {authRole === 'admin' && <a className={view === 'admin' ? 'active' : ''} href="#admin" onClick={() => setView('admin')}>Admin</a>}
      </nav>
      <div className="top-actions">
        <button className="icon-btn" aria-label="Notifikasi" onClick={() => setShowNotifications(!showNotifications)}><Bell size={18}/>{notifications.some(n => n.unread) && <span className="dot"/>}</button>
        <button className="btn btn-soft" onClick={() => userEmail ? supabase.auth.signOut() : setShowAuth(true)}>{authReady ? (userEmail ? 'Keluar' : 'Masuk / Daftar') : 'Memuat...'}</button>
        <div className="avatar">{userEmail ? userEmail[0].toUpperCase() : 'AN'}</div>
      </div>
      {showNotifications && <div style={{ position:'absolute', right:'5vw', top:65, width:300, background:'#fffefb', border:'1px solid #e7e8e1', borderRadius:14, padding:16, boxShadow:'0 16px 40px #193b3620', zIndex:8 }}>
        <strong style={{fontSize:13}}>Notifikasi</strong>
        {notifications.map(n => <div className="activity" key={n.id}><div style={{width:7,height:7,borderRadius:'50%',background:n.unread?'#e9a23b':'#d9ded9',marginTop:6}}/><div><p>{n.text}</p><span>{n.time}</span></div></div>)}
      </div>}
    </header>

    {view === 'dashboard' && <>
      <section className="hero">
        <div className="hero-grid">
          <div><div className="eyebrow">Ruang aman untuk menemukan kembali</div><h1>Barang hilang,<br/><em>harapan</em> ditemukan.</h1><p>Laporkan barang yang hilang atau ditemukan. Bersama, kita bantu satu sama lain pulang dengan membawa barang yang berarti.</p></div>
          <div className="search-panel">
            <div className="eyebrow" style={{color:'#72817d',marginBottom:10}}>Cari di sekitar Anda</div>
            <div className="search-row">
              <div style={{position:'relative',flex:1}}>
                <Search size={17} style={{position:'absolute',left:13,top:15,color:'#72817d'}}/>
                <input className="search-input" style={{paddingLeft:39,width:'100%'}} placeholder="Contoh: dompet, earbuds..." value={query} onChange={e => setQuery(e.target.value)}/>
              </div>
              <button className="btn btn-primary">Cari</button>
            </div>
          </div>
        </div>
      </section>
      <main className="content">
        <div className="stats">
          <div className="stat"><div><div className="stat-label">Barang terbuka</div><div className="stat-value">{openCount}</div></div><div className="stat-icon"><Package size={19}/></div></div>
          <div className="stat"><div><div className="stat-label">Klaim saya</div><div className="stat-value">{myClaims}</div></div><div className="stat-icon"><ClipboardList size={19}/></div></div>
          <div className="stat"><div><div className="stat-label">Berhasil kembali</div><div className="stat-value">{resolvedCount}</div></div><div className="stat-icon"><CheckCircle2 size={19}/></div></div>
        </div>
        <div className="section-head">
          <div><h2>Temukan di sekitar Anda</h2><p>Daftar terbaru dari komunitas TEMUKAN</p></div>
          <button className="btn btn-soft" onClick={() => setView('report')}><FilePlus2 size={16}/> Buat laporan</button>
        </div>
        <div className="toolbar">
          <select className="select" value={kind} onChange={e => setKind(e.target.value)}>
            <option value="all">Semua laporan</option><option value="lost">Barang hilang</option><option value="found">Barang ditemukan</option>
          </select>
          <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
            <option>Semua kategori</option><option>Aksesori</option><option>Elektronik</option><option>Pakaian</option><option>Lainnya</option>
          </select>
        </div>
        <div className="cards">
          {items.map(item => <article className="card" key={item.id}>
            <div className="card-visual" style={{background:`linear-gradient(135deg, ${item.color}30, #f1e3cd)`}}>
              {item.photoUrl ? <img src={item.photoUrl} alt={item.title} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : <span className="kind">{item.kind === 'lost' ? 'Hilang' : 'Ditemukan'}</span>}
            </div>
            <div className="card-body">
              <h3 className="card-title">{item.title}</h3>
              <div className="meta"><MapPin size={14}/>{item.location}</div>
              <div className="meta"><CalendarDays size={14}/>{new Date(item.date).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}</div>
              <div className="card-foot">
                <div className="person"><span className="mini-avatar" style={{background:item.color}}>{item.initials}</span>{item.reporter}</div>
                {item.kind === 'lost' && item.status === 'open' ? <button className="status" onClick={() => claim(item)}>Ajukan klaim</button> : <span className="status">{item.status === 'claimed' ? 'Diklaim' : 'Terbuka'}</span>}
              </div>
            </div>
          </article>)}
        </div>
        {!items.length && <div className="empty">Tidak ada laporan yang cocok. Coba kata kunci atau filter lain.</div>}
      </main>
    </>}

    {view === 'report' && userEmail && <main className="content">
      <div className="section-head">
        <div><div className="eyebrow" style={{color:'#72817d'}}>Bantu komunitas</div><h2>Buat laporan baru</h2><p>Semakin lengkap informasinya, semakin mudah barang ditemukan.</p></div>
        <button className="icon-btn" onClick={() => setView('dashboard')}><X size={17}/></button>
      </div>
      <div className="panel">
        <form onSubmit={submitReport}>
          <div className="form-grid">
            <div className="field full"><label>Jenis laporan</label><div style={{display:'flex',gap:10}}>{[['lost','Saya kehilangan barang'],['found','Saya menemukan barang']].map(([value,label]) => <button type="button" key={value} className={`btn ${report.kind===value?'btn-dark':'btn-soft'}`} onClick={() => setReport({...report,kind:value})}>{value==='lost'?'Barang hilang':'Barang ditemukan'}</button>)}</div></div>
            <div className="field"><label>Nama barang</label><input required placeholder="Contoh: Dompet kulit cokelat" value={report.title} onChange={e => setReport({...report,title:e.target.value})}/></div>
            <div className="field"><label>Kategori</label><select value={report.category} onChange={e => setReport({...report,category:e.target.value})}><option>Aksesori</option><option>Elektronik</option><option>Pakaian</option><option>Lainnya</option></select></div>
            <div className="field"><label>Lokasi</label><input required placeholder="Contoh: Perpustakaan Pusat" value={report.location} onChange={e => setReport({...report,location:e.target.value})}/></div>
            <div className="field"><label>Tanggal</label><input required type="date" value={report.date} onChange={e => setReport({...report,date:e.target.value})}/></div>
            <div className="field full"><label>Foto barang (opsional)</label><div style={{border:'1px dashed #e7e8e1',borderRadius:8,padding:16,textAlign:'center',cursor:'pointer',position:'relative'}} onClick={() => document.getElementById('photo-input')?.click()}><input id="photo-input" type="file" accept="image/*" style={{display:'none'}} onChange={e => { const f = e.target.files?.[0]; if (f) { setReportPhoto(f); setReportPhotoPreview(URL.createObjectURL(f)); } }} />{reportPhotoPreview ? <div style={{position:'relative',display:'inline-block'}}><img src={reportPhotoPreview} alt="Preview" style={{maxHeight:200,borderRadius:6}} /><button type="button" className="icon-btn" style={{position:'absolute',top:-8,right:-8,background:'#b25745',color:'#fff',borderRadius:'50%',padding:4}} onClick={e => { e.stopPropagation(); setReportPhoto(null); setReportPhotoPreview(null); }}><XCircle size={16}/></button></div> : <div><Upload size={24} style={{color:'#7287d',marginBottom:8}}/><p style={{color:'#7287d',fontSize:13}}>Klik untuk pilih foto</p><p style={{color:'#7287d',fontSize:11}}>Maksimal 1MB, format JPG/PNG</p></div>}</div></div>
            <div className="field full"><label>Deskripsi dan ciri-ciri</label><textarea placeholder="Warna, merek, ciri khusus, atau informasi lain yang membantu..." value={report.description} onChange={e => setReport({...report,description:e.target.value})}/></div>
          </div>
          <div className="actions"><button type="button" className="btn btn-soft" onClick={() => setView('dashboard')}>Batal</button><button type="submit" className="btn btn-primary" disabled={uploadingPhoto}>{uploadingPhoto ? 'Mengunggah...' : 'Kirim laporan'} <ChevronRight size={16}/></button></div>
        </form>
      </div>
    </main>}

    {view === 'claims' && userEmail && <main className="content">
      <div className="section-head"><div><div className="eyebrow" style={{color:'#72817d'}}>Perlindungan kepemilikan</div><h2>Klaim saya</h2><p>Admin akan memeriksa bukti sebelum klaim disetujui.</p></div></div>
      <div className="panel">
        {claims.map(claim => <div className="activity" key={claim.id}><div className="stat-icon"><ShieldCheck size={17}/></div><div style={{flex:1}}><p><strong>{claim.itemTitle}</strong></p><span>{claim.id} · Diajukan {claim.createdAt}</span></div><span className="status">{claim.status === 'pending' ? 'Menunggu verifikasi' : claim.status}</span></div>)}
        {!claims.length && <div className="empty">Belum ada klaim.</div>}
      </div>
    </main>}

    {view === 'admin' && authRole === 'admin' && <main className="content">
      <div className="section-head"><div><div className="eyebrow" style={{color:'#72817d'}}>Kontrol & keamanan</div><h2>Admin console</h2><p>Moderasi laporan dan verifikasi klaim komunitas.</p></div><span className="status"><ShieldCheck size={13}/> Admin aktif</span></div>
      <div className="stats">
        <div className="stat"><div><div className="stat-label">Total laporan</div><div className="stat-value">{items.length}</div></div><div className="stat-icon"><Package size={19}/></div></div>
        <div className="stat"><div><div className="stat-label">Klaim menunggu</div><div className="stat-value">{claims.filter(c=>c.status==='pending').length}</div></div><div className="stat-icon"><ClipboardList size={19}/></div></div>
        <div className="stat"><div><div className="stat-label">Pengguna aktif</div><div className="stat-value">{userCount ?? '…'}</div></div><div className="stat-icon"><UserRound size={19}/></div></div>
      </div>
      <div className="split">
        <div className="panel">
          <h3>Klaim terbaru</h3>
          {claims.map(c => (
            <div className="activity" key={c.id}>
              <div className="mini-avatar" style={{background:'#2d665c'}}>{(c.claimant || 'PN').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
              <div style={{flex:1}}>
                <p><strong>{c.itemTitle}</strong></p>
                <span>{c.claimant} · {c.createdAt} · {c.otpVerifiedAt ? 'OTP terverifikasi' : 'Menunggu OTP'}</span>
              </div>
              <button className="status" disabled={moderatingId === c.id || c.status !== 'pending'} onClick={() => moderateClaim(c.id, 'approved')}>{moderatingId === c.id ? 'Menyimpan...' : 'Setujui'}</button>
              <button className="status" disabled={moderatingId === c.id || c.status !== 'pending'} onClick={() => moderateClaim(c.id, 'rejected')}>Tolak</button>
            </div>
          ))}
          {!claims.length && <div className="empty">Belum ada klaim.</div>}
        </div>
        <div className="panel">
          <h3>Aktivitas sistem</h3>
          {notifications.map(n => <div className="activity" key={n.id}><div className="stat-icon"><Bell size={15}/></div><div><p>{n.text}</p><span>{n.time}</span></div></div>)}
        </div>
      </div>
      <div className="panel">
        <h3>Daftar laporan</h3>
        <div style={{maxHeight:400,overflowY:'auto'}}>
          {items.map(item => (
            <div className="activity" key={item.id}>
              <div className="mini-avatar" style={{background:item.color}}>{item.initials}</div>
              <div style={{flex:1}}>
                <p><strong>{item.title}</strong></p>
                <span>{item.kind === 'lost' ? 'Hilang' : 'Ditemukan'} · {item.location} · {item.status}</span>
              </div>
              <button className="icon-btn" style={{color:'#b25745'}} onClick={() => deleteItem(item.id, item.kind)}><Trash2 size={16}/></button>
            </div>
          ))}
          {!items.length && <div className="empty">Belum ada laporan.</div>}
        </div>
      </div>
    </main>}

    {otpClaim && <div style={{position:'fixed',inset:0,background:'#193b3655',display:'grid',placeItems:'center',zIndex:9,padding:20}}>
      <div className="panel" style={{width:'min(440px,100%)',boxShadow:'0 22px 60px #193b3630'}}>
        <div className="section-head"><div><div className="eyebrow" style={{color:'#72817d'}}>Verifikasi kepemilikan</div><h3 style={{marginBottom:6}}>Masukkan kode OTP</h3><p style={{fontSize:13,color:'#72817d',margin:0}}>Klaim: {otpClaim.title}</p></div><button className="icon-btn" onClick={() => setOtpClaim(null)}><X size={17}/></button></div>
        <form onSubmit={verifyOtp}>
          <div className="field"><label>Kode OTP 6 digit</label><input required inputMode="numeric" maxLength={6} pattern="[0-9]{6}" autoFocus placeholder="000000" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g,'').slice(0,6))}/></div>
          {otpError && <div style={{marginTop:12,color:'#b25745',fontSize:12}}>{otpError}</div>}
          <div className="actions"><button type="button" className="btn btn-soft" disabled={resendBusy} onClick={resendOtp}>{resendBusy ? 'Mengirim...' : 'Kirim ulang kode'}</button><button type="button" className="btn btn-soft" onClick={() => setOtpClaim(null)}>Nanti</button><button type="button" className="btn btn-primary" disabled={otpBusy}>{otpBusy ? 'Memverifikasi...' : 'Verifikasi OTP'}</button></div>
        </form>
      </div>
    </div>}

    {showAuth && <AuthDialog onClose={() => setShowAuth(false)} onAuthenticated={() => { setShowAuth(false); setView('dashboard'); setToast('Berhasil masuk.'); }} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}
