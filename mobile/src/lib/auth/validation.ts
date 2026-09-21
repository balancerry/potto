/** Same rules as Potto Web (`web/src/lib/auth/validation.ts`). */

export const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a display name';
  if (trimmed.length < 2) return 'Display name must be at least 2 characters';
  if (trimmed.length > 60) return 'Display name is too long';
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Enter your email';
  if (!isValidEmail(email)) return 'Enter a valid email address';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Enter a password';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (!confirm) return 'Confirm your password';
  if (password !== confirm) return 'Passwords do not match';
  return null;
}

export function friendlyAuthError(err: unknown): string {
  const raw =
    err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'Something went wrong';

  const msg = raw.toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Incorrect email or password';
  }
  if (msg.includes('email not confirmed')) {
    return 'Please verify your email before continuing.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'This email is already registered. Try signing in.';
  }
  if (msg.includes('user not found') || (msg.includes('otp') && msg.includes('not'))) {
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
  if (msg.includes('network') || msg.includes('fetch')) {
    return "Couldn't connect. Check your internet connection and try again.";
  }
  if (raw.length > 160) return 'Something went wrong. Please try again.';
  return raw;
}
