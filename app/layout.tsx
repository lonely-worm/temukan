import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Temukan — Lost & Found', description: 'Temukan kembali barang yang berarti.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="id"><body>{children}</body></html>; }
