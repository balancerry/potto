'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { actionFail, actionOk, type ActionResult } from '@/lib/errors';

function isSafeOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.vercel.app') ||
      /^192\.168\.\d+\.\d+$/.test(host) ||
      /^10\.\d+\.\d+\.\d+$/.test(host)
    );
  } catch {
    return false;
  }
}

async function resolveSiteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get('origin');
  if (origin && isSafeOrigin(origin)) return origin.replace(/\/$/, '');

  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  if (host) {
    const candidate = `${proto}://${host}`.replace(/\/$/, '');
    if (isSafeOrigin(candidate)) return candidate;
  }

  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export async function signInWithMagicLink(input: {
  email: string;
  name?: string;
  next?: string;
}): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return actionFail('Enter a valid email address');
    }

    const supabase = await createClient();
    const siteUrl = await resolveSiteOrigin();
    const next = input.next?.startsWith('/') ? input.next : '/';
    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
        data: input.name?.trim() ? { name: input.name.trim() } : undefined,
      },
    });

    if (error) return actionFail(error);
    return actionOk({ redirectTo });
  } catch (err) {
    return actionFail(err);
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function updateDisplayName(name: string): Promise<ActionResult> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return actionFail('Enter a display name');

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionFail('Please sign in to continue');

    const { error: authErr } = await supabase.auth.updateUser({
      data: { name: trimmed },
    });
    if (authErr) return actionFail(authErr);

    const { error } = await supabase.from('users').update({ name: trimmed }).eq('id', user.id);
    if (error) return actionFail(error);

    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}
