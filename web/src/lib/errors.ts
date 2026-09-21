/**
 * Maps Supabase / Postgres / Zod errors to short user-facing messages.
 * Prefer specific known phrases; fall back to a generic string.
 */
export function friendlyError(err: unknown): string {
  if (err && typeof err === 'object' && 'issues' in err && Array.isArray((err as { issues: unknown }).issues)) {
    const first = (err as { issues: { message?: string }[] }).issues[0];
    if (first?.message) return first.message;
  }

  const raw =
    err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'Something went wrong';

  const msg = raw.toLowerCase();

  if (msg.includes('not authorized') || msg.includes('permission') || msg.includes('row-level security')) {
    return 'You do not have permission to do that';
  }
  if (msg.includes('profile not found')) {
    return 'Your profile is not set up yet. Sign out and sign in again';
  }
  if (msg.includes('name is required') || msg.includes('title is required')) {
    return 'Please enter a name';
  }
  if (msg.includes('join request not found')) {
    return 'Join request not found';
  }
  if (msg.includes('join request is not pending')) {
    return 'This join request has already been reviewed';
  }
  if (msg.includes('already linked to another account')) {
    return 'That member is already linked to another account';
  }
  if (msg.includes('cannot demote the last admin')) {
    return 'This pot needs at least one admin';
  }
  if (msg.includes('not authorized to manage members')) {
    return 'You do not have permission to do that';
  }
  if (msg.includes('member is not active')) {
    return 'That member is not active';
  }
  if (msg.includes('member not found')) {
    return 'Member not found';
  }
  if (msg.includes('display name is required')) {
    return 'Enter a display name for the new member';
  }
  if (msg.includes('selected member does not belong')) {
    return 'Selected member does not belong to this pot';
  }
  if (msg.includes('commitment not found')) {
    return 'Upcoming payment not found';
  }
  if (msg.includes('has been cancelled') || msg.includes('commitment has been cancelled')) {
    return 'This upcoming payment has been cancelled';
  }
  if (msg.includes('total amount must be greater than zero') || msg.includes('enter an amount greater than zero')) {
    return 'Enter an amount greater than zero';
  }
  if (msg.includes('payment exceeds remaining')) {
    return 'Payment exceeds the remaining amount on this upcoming payment';
  }
  if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
    if (msg.includes('invite_code') || msg.includes('join_code')) {
      return 'That code is already in use. Try regenerating';
    }
    if (msg.includes('join_requests') || msg.includes('pending')) {
      return 'You already have a pending join request for this pot';
    }
    return 'This already exists';
  }
  if (msg.includes('jwt') || msg.includes('not authenticated') || msg.includes('auth')) {
    return 'Please sign in to continue';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network error. Check your connection and try again';
  }

  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Incorrect email or password';
  }
  if (msg.includes('email not confirmed')) {
    return 'Confirm your email before signing in. Check your inbox for a verification link.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (msg.includes('signups not allowed') || msg.includes('otp_disabled')) {
    return 'Could not send a magic link for this email. Try signing in with your password.';
  }
  if (
    msg.includes('user not found') ||
    msg.includes('unable to validate email') ||
    (msg.includes('otp') && msg.includes('not'))
  ) {
    return 'No account found for that email. Create an account first.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate')) {
    return 'Too many requests. Wait a minute and try again.';
  }
  if (
    msg.includes('error sending confirmation email') ||
    msg.includes('error sending magic link') ||
    msg.includes('error sending recovery email') ||
    msg.includes('could not send email') ||
    msg.includes('domain is not verified')
  ) {
    return 'Could not send the email. Resend needs a verified domain to deliver to this address (or use the email on your Resend account for testing).';
  }
  if (msg.includes('same password') || msg.includes('should be different')) {
    return 'Choose a new password that is different from your current one.';
  }
  if (msg.includes('password') && msg.includes('least')) {
    return `Password must be at least ${8} characters`;
  }

  // Truncate overly long Postgres dumps for the UI.
  if (raw.length > 160) return 'Something went wrong. Please try again';
  return raw;
}

export type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export function actionOk(): { ok: true };
export function actionOk<T>(data: T): { ok: true; data: T };
export function actionOk<T>(data?: T) {
  return data === undefined ? ({ ok: true } as const) : ({ ok: true, data } as const);
}

export function actionFail(err: unknown): { ok: false; error: string } {
  return { ok: false, error: friendlyError(err) };
}
