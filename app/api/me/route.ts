import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ user: null, profile: null }, { status: 401 });
  const { data: profile, error } = await supabase.from('profiles').select('full_name,role').eq('id', authData.user.id).maybeSingle();
  if (error) {
    console.error('Supabase profile lookup failed:', error.message);
    return NextResponse.json({ error: 'Profil belum dapat dimuat.' }, { status: 500 });
  }
  return NextResponse.json({ user: { email: authData.user.email }, profile: profile || { full_name: '', role: 'user' } });
}
