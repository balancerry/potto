'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  requestPasswordReset,
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from '@/lib/actions/auth';
import { clearPendingSignup } from '@/lib/auth/pending-signup';
import {
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from '@/lib/auth/validation';
import { PasswordField } from '@/components/auth/password-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Mode = 'signin' | 'signup' | 'magic' | 'forgot' | 'sent';

const RESEND_COOLDOWN_SEC = 45;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const authError = searchParams.get('error');
  const initialMode = (searchParams.get('mode') as Mode | null) ?? 'signin';

  const [mode, setMode] = useState<Mode>(
    initialMode === 'signup' || initialMode === 'signin' ? initialMode : 'signin',
  );
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [sentEmail, setSentEmail] = useState('');
  const [sentKind, setSentKind] = useState<'magic' | 'reset'>('magic');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const title = useMemo(() => {
    switch (mode) {
      case 'signup':
        return 'Create account';
      case 'magic':
        return 'Magic link';
      case 'forgot':
        return 'Forgot password';
      case 'sent':
        return 'Check your email';
      default:
        return 'Sign in';
    }
  }, [mode]);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);
    if (nextMode !== 'sent') {
      setPassword('');
      setConfirmPassword('');
    }
  }

  function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    const eErr = validateEmail(email);
    setEmailError(eErr);
    setPasswordError(password ? null : 'Enter your password');
    if (eErr || !password) return;

    startTransition(async () => {
      const result = await signInWithPassword({ email, password, next });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.replace(result.data.next);
      router.refresh();
    });
  }

  function onSignup(e: React.FormEvent) {
    e.preventDefault();
    const nErr = validateDisplayName(name);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const cErr = validatePasswordConfirm(password, confirmPassword);
    setNameError(nErr);
    setEmailError(eErr);
    setPasswordError(pErr);
    setConfirmError(cErr);
    if (nErr || eErr || pErr || cErr) return;

    startTransition(async () => {
      const result = await signUpWithPassword({
        email,
        name,
        password,
        confirmPassword,
        next,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Account created');
      router.replace(result.data.next);
      router.refresh();
    });
  }

  function onMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const eErr = validateEmail(email);
    setEmailError(eErr);
    if (eErr) return;

    startTransition(async () => {
      const result = await signInWithMagicLink({ email, next, offerSetPassword: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSentEmail(normalizeEmail(email));
      setSentKind('magic');
      setCooldown(RESEND_COOLDOWN_SEC);
      setMode('sent');
      toast.success('Magic link sent — check your inbox.');
    });
  }

  function onForgot(e: React.FormEvent) {
    e.preventDefault();
    const eErr = validateEmail(email);
    setEmailError(eErr);
    if (eErr) return;

    startTransition(async () => {
      const result = await requestPasswordReset({ email });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSentEmail(normalizeEmail(email));
      setSentKind('reset');
      setCooldown(RESEND_COOLDOWN_SEC);
      setMode('sent');
      toast.success('If an account exists, a reset link is on the way.');
    });
  }

  function onResend() {
    if (cooldown > 0 || pending) return;

    if (sentKind === 'reset') {
      startTransition(async () => {
        const result = await requestPasswordReset({ email: sentEmail });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setCooldown(RESEND_COOLDOWN_SEC);
        toast.success('Reset link resent.');
      });
      return;
    }

    startTransition(async () => {
      const result = await signInWithMagicLink({ email: sentEmail, next, offerSetPassword: true });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCooldown(RESEND_COOLDOWN_SEC);
      toast.success('Magic link resent.');
    });
  }

  if (mode === 'sent') {
    return (
      <Card className="w-full max-w-md">
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent a link to <strong className="text-ink">{sentEmail}</strong>
          {sentKind === 'reset'
            ? '. Open it to choose a new password.'
            : '. Open it on this device to sign in.'}
        </CardDescription>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending || cooldown > 0}
            onClick={onResend}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              clearPendingSignup();
              switchMode('signin');
            }}
          >
            Change email
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="mb-5 grid grid-cols-2 gap-1 rounded-[var(--radius-md)] bg-surface-sunk p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin' || mode === 'magic' || mode === 'forgot'}
          className={cn(
            'rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
            mode !== 'signup' ? 'bg-surface text-accent shadow-sm' : 'text-ink-soft hover:text-ink',
          )}
          onClick={() => switchMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className={cn(
            'rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
            mode === 'signup' ? 'bg-surface text-accent shadow-sm' : 'text-ink-soft hover:text-ink',
          )}
          onClick={() => switchMode('signup')}
        >
          Create account
        </button>
      </div>

      <CardTitle>{title}</CardTitle>
      <CardDescription>
        {mode === 'signup'
          ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
          : mode === 'magic'
            ? 'We will email you a one-time sign-in link.'
            : mode === 'forgot'
              ? 'Enter your email and we will send a reset link.'
              : 'Welcome back — sign in with your email and password.'}
      </CardDescription>

      {authError ? (
        <p className="mt-3 rounded-[var(--radius-sm)] bg-neg-soft px-3 py-2 text-sm text-neg" role="alert">
          That link is invalid or expired. Request a new one.
        </p>
      ) : null}

      {mode === 'signin' ? (
        <form onSubmit={onSignIn} className="mt-6 space-y-4">
          <Field
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            error={emailError}
            required
          />
          <PasswordField
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            error={passwordError}
            required
          />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
          <div className="flex flex-col items-center gap-2 pt-1 text-sm">
            <button
              type="button"
              className="text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              onClick={() => switchMode('forgot')}
            >
              Forgot password?
            </button>
            <button
              type="button"
              className="text-ink-soft underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              onClick={() => switchMode('magic')}
            >
              Continue with magic link
            </button>
            <p className="pt-2 text-ink-soft">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                className="font-medium text-accent underline-offset-2 hover:underline"
                onClick={() => switchMode('signup')}
              >
                Create account
              </button>
            </p>
          </div>
        </form>
      ) : null}

      {mode === 'signup' ? (
        <form onSubmit={onSignup} className="mt-6 space-y-4">
          <Field
            id="name"
            label="Display name"
            value={name}
            onChange={setName}
            autoComplete="name"
            placeholder="How others see you"
            error={nameError}
            required
          />
          <Field
            id="signup-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            error={emailError}
            required
          />
          <PasswordField
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            error={passwordError}
            required
          />
          <PasswordField
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            error={confirmError}
            required
          />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Creating account…' : 'Create account'}
          </Button>
          <p className="pt-1 text-center text-sm text-ink-soft">
            Already have an account?{' '}
            <button
              type="button"
              className="font-medium text-accent underline-offset-2 hover:underline"
              onClick={() => switchMode('signin')}
            >
              Sign in
            </button>
          </p>
        </form>
      ) : null}

      {mode === 'magic' ? (
        <form onSubmit={onMagicLink} className="mt-6 space-y-4">
          <Field
            id="magic-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            error={emailError}
            required
          />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Sending…' : 'Send magic link'}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
            onClick={() => switchMode('signin')}
          >
            Back to password sign in
          </button>
        </form>
      ) : null}

      {mode === 'forgot' ? (
        <form onSubmit={onForgot} className="mt-6 space-y-4">
          <Field
            id="forgot-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            error={emailError}
            required
          />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
            onClick={() => switchMode('signin')}
          >
            Back to sign in
          </button>
        </form>
      ) : null}
    </Card>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-neg" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
