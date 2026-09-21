'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { establishPassword } from '@/lib/actions/auth';
import { MIN_PASSWORD_LENGTH, validatePassword, validatePasswordConfirm } from '@/lib/auth/validation';
import { PasswordField } from '@/components/auth/password-field';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

/** Optional password setup for existing magic-link-only users. */
export function SetPasswordForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pErr = validatePassword(password);
    const cErr = validatePasswordConfirm(password, confirm);
    setPasswordError(pErr);
    setConfirmError(cErr);
    if (pErr || cErr) return;

    startTransition(async () => {
      const result = await establishPassword({ password, confirmPassword: confirm });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Password saved. You can sign in with email and password next time.');
      router.replace('/');
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-md">
      <CardTitle>Add a password</CardTitle>
      <CardDescription>
        You signed in with a magic link. Optionally set a password (min {MIN_PASSWORD_LENGTH}{' '}
        characters) for faster sign-in next time.
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
          {pending ? 'Saving…' : 'Save password'}
        </Button>
        <Link
          href="/"
          className="block w-full text-center text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline"
        >
          Skip for now
        </Link>
      </form>
    </Card>
  );
}
