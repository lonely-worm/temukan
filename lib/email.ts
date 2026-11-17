function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export async function sendClaimOtpEmail(email: string, itemTitle: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false as const, configurationMissing: true };

  const safeTitle = escapeHtml(itemTitle);
  const text = `Kode verifikasi klaim TEMUKAN: ${code}. Kode berlaku 10 menit untuk barang: ${itemTitle}. Jika Anda tidak meminta kode ini, abaikan email ini.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#193b36"><h2>Verifikasi klaim TEMUKAN</h2><p>Gunakan kode berikut untuk memverifikasi klaim atas <strong>${safeTitle}</strong>:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${code}</p><p>Kode berlaku selama 10 menit. Jika Anda tidak meminta kode ini, abaikan email ini.</p></div>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'Kode verifikasi klaim TEMUKAN', text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error('OTP email provider returned HTTP', response.status);
      return { ok: false as const, configurationMissing: false };
    }
    return { ok: true as const, configurationMissing: false };
  } catch (error) {
    console.error('OTP email delivery failed:', error instanceof Error ? error.name : 'unknown error');
    return { ok: false as const, configurationMissing: false };
  }
}
