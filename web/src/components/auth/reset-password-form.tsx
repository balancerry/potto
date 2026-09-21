'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updatePassword } from '@/lib/actions/auth';
import { MIN_PASSWORD_LENGTH, validatePassword, validatePasswordConfirm } from '@/lib/auth/validation';
import { PasswordField } from '@/components/auth/password-field';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function ResetPasswordForm() {
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
      const result = await updatePassword({ password, confirmPassword: confirm });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Password updated. You are signed in.');
      router.replace('/');
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-md">
      <CardTitle>Choose a new password</CardTitle>
      <CardDescription>
        Enter a new password with at least {MIN_PASSWORD_LENGTH} characters.
      </CardDescription>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <PasswordField
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          error={passwordError}
          required
        />
        <PasswordField
          label="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={confirmError}
          required
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </Card>
  );
}
