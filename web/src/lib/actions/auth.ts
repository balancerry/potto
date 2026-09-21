'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from '@/lib/auth/validation';
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

function safeNextPath(next?: string | null): string {
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/';
}

async function callbackUrl(nextPath: string): Promise<string> {
  const siteUrl = await resolveSiteOrigin();
  return `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export async function checkEmailRegistered(email: string): Promise<ActionResult<{ registered: boolean }>> {
  try {
    const emailErr = validateEmail(email);
    if (emailErr) return actionFail(emailErr);

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('email_registered', {
      p_email: normalizeEmail(email),
    });
    if (error) return actionFail(error);
    return actionOk({ registered: Boolean(data) });
  } catch (err) {
    return actionFail(err);
  }
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<ActionResult<{ next: string }>> {
  try {
    const emailErr = validateEmail(input.email);
    if (emailErr) return actionFail(emailErr);
    if (!input.password) return actionFail('Enter your password');

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(input.email),
      password: input.password,
    });

    if (error) return actionFail(error);
    return actionOk({ next: safeNextPath(input.next) });
  } catch (err) {
    return actionFail(err);
  }
}

/** Existing-user passwordless sign-in. Does not create new accounts. */
export async function signInWithMagicLink(input: {
  email: string;
  next?: string;
  /** After magic link, offer optional password setup for legacy passwordless users. */
  offerSetPassword?: boolean;
}): Promise<ActionResult> {
  try {
    const emailErr = validateEmail(input.email);
    if (emailErr) return actionFail(emailErr);

    const supabase = await createClient();
    const nextPath = input.offerSetPassword
      ? '/auth/set-password'
      : safeNextPath(input.next);
    const redirectTo = await callbackUrl(nextPath);

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(input.email),
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    });

    if (error) return actionFail(error);
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

/**
 * Create-account with email + password.
 * Email confirmation is disabled in Supabase (mailer_autoconfirm) for now,
 * so signup works without a verified sending domain.
 */
export async function signUpWithPassword(input: {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
  next?: string;
}): Promise<ActionResult<{ next: string }>> {
  try {
    const nameErr = validateDisplayName(input.name);
    if (nameErr) return actionFail(nameErr);
    const emailErr = validateEmail(input.email);
    if (emailErr) return actionFail(emailErr);
    const passwordErr = validatePassword(input.password);
    if (passwordErr) return actionFail(passwordErr);
    const confirmErr = validatePasswordConfirm(input.password, input.confirmPassword);
    if (confirmErr) return actionFail(confirmErr);

    const email = normalizeEmail(input.email);
    const name = input.name.trim();

    const supabase = await createClient();
    const { data: registered, error: checkErr } = await supabase.rpc('email_registered', {
      p_email: email,
    });
    if (checkErr) return actionFail(checkErr);
    if (registered) {
      return actionFail('An account with this email already exists. Sign in instead.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: { data: { name } },
    });
    if (error) return actionFail(error);

    // Autoconfirm should return a session; if not, sign in explicitly.
    if (!data.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: input.password,
      });
      if (signInErr) return actionFail(signInErr);
    }

    return actionOk({ next: safeNextPath(input.next) });
  } catch (err) {
    return actionFail(err);
  }
}

/** After magic-link session is established — set password + sync profile name. */
export async function establishPassword(input: {
  password: string;
  confirmPassword: string;
  name?: string;
}): Promise<ActionResult> {
  try {
    const passwordErr = validatePassword(input.password);
    if (passwordErr) return actionFail(passwordErr);
    const confirmErr = validatePasswordConfirm(input.password, input.confirmPassword);
    if (confirmErr) return actionFail(confirmErr);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionFail('Please open the verification link again, then set your password.');

    const name =
      input.name?.trim() ||
      (typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '') ||
      null;

    const { error: authErr } = await supabase.auth.updateUser({
      password: input.password,
      data: name ? { name } : undefined,
    });
    if (authErr) return actionFail(authErr);

    if (name) {
      const { error: profileErr } = await supabase
        .from('users')
        .update({ name, email: user.email ?? null })
        .eq('id', user.id);
      if (profileErr) return actionFail(profileErr);
    } else {
      // Ensure profile email stays in sync even without a name change.
      const { error: profileErr } = await supabase
        .from('users')
        .update({ email: user.email ?? null })
        .eq('id', user.id);
      if (profileErr) return actionFail(profileErr);
    }

    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  try {
    const emailErr = validateEmail(input.email);
    if (emailErr) return actionFail(emailErr);

    const supabase = await createClient();
    const redirectTo = await callbackUrl('/auth/reset-password');

    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(input.email), {
      redirectTo,
    });

    if (error) return actionFail(error);
    // Always succeed-looking to avoid email enumeration beyond what reset already implies.
    return actionOk();
  } catch (err) {
    return actionFail(err);
  }
}

export async function updatePassword(input: {
  password: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  try {
    const passwordErr = validatePassword(input.password);
    if (passwordErr) return actionFail(passwordErr);
    const confirmErr = validatePasswordConfirm(input.password, input.confirmPassword);
    if (confirmErr) return actionFail(confirmErr);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return actionFail('Your reset link is invalid or expired. Request a new one.');

    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) return actionFail(error);
    return actionOk();
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
    const nameErr = validateDisplayName(name);
    if (nameErr) return actionFail(nameErr);

    const trimmed = name.trim();
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
