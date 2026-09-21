'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { establishPassword } from '@/lib/actions/auth';
import { clearPendingSignup, readPendingSignup, type PendingSignup } from '@/lib/auth/pending-signup';
import { MIN_PASSWORD_LENGTH, validatePassword, validatePasswordConfirm } from '@/lib/auth/validation';
import { PasswordField } from '@/components/auth/password-field';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

/**
 * Runs after magic-link verification for Create Account.
 * Prefers the password stashed in sessionStorage (same browser);
 * otherwise prompts the user to set a password (other device / cleared storage).
 */
export function CompleteSignupForm() {
  const router = useRouter();
  const [pendingSignup] = useState<PendingSignup | null>(() => readPendingSignup());
  const [showForm, setShowForm] = useState(() => !readPendingSignup());
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!pendingSignup || autoStarted.current) return;
    autoStarted.current = true;

    startTransition(async () => {
      const result = await establishPassword({
        password: pendingSignup.password,
        confirmPassword: pendingSignup.password,
        name: pendingSignup.name,
      });
      clearPendingSignup();
      if (!result.ok) {
        toast.error(result.error);
        setShowForm(true);
        return;
      }
      toast.success('Account ready — you can sign in with email and password next time.');
      router.replace('/');
      router.refresh();
    });
  }, [pendingSignup, router]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pErr = validatePassword(password);
    const cErr = validatePasswordConfirm(password, confirm);
    setPasswordError(pErr);
    setConfirmError(cErr);
    if (pErr || cErr) return;

    startTransition(async () => {
      const result = await establishPassword({
        password,
        confirmPassword: confirm,
        name: pendingSignup?.name,
      });
      clearPendingSignup();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Password saved. Welcome to Potto!');
      router.replace('/');
      router.refresh();
    });
  }

  if (!showForm) {
    return (
      <Card className="w-full max-w-md">
        <CardTitle>Finishing signup…</CardTitle>
        <CardDescription>Verifying your email and securing your account.</CardDescription>
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-surface-sunk">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-accent" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardTitle>Set your password</CardTitle>
      <CardDescription>
        Your email is verified. Choose a password (at least {MIN_PASSWORD_LENGTH} characters) so you
        can sign in next time without a magic link.
      </CardDescription>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={confirmError}
          required
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Saving…' : 'Save password & continue'}
        </Button>
      </form>
    </Card>
  );
}
