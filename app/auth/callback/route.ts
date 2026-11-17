import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requestedNext = request.nextUrl.searchParams.get('next') || '/';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';
  const response = NextResponse.redirect(new URL(next, request.url));

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }[]) { cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); },
      } },
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/?auth=confirmation-failed', request.url));
  }
  return response;
}
