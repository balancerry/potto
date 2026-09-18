'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { signInWithMagicLink } from '@/lib/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const authError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signInWithMagicLink({ email, name, next });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSent(true);
      toast.success('Magic link sent — check your inbox (and spam).');
    } catch (err) {
      console.error(err);
      toast.error(
        'Could not reach the server. Open http://localhost:3000 (not the LAN IP) and try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card className="w-full max-w-md">
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We sent a magic link to <strong className="text-ink">{email}</strong>. Open it on this device to
          sign in.
        </CardDescription>
        <Button variant="ghost" className="mt-6" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardTitle>Sign in to Potto</CardTitle>
      <CardDescription>No password — we&apos;ll email you a magic link.</CardDescription>
      {authError ? (
        <p className="mt-3 rounded-[var(--radius-sm)] bg-neg-soft px-3 py-2 text-sm text-neg">
          That link is invalid or expired. Request a new one.
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How others see you"
            autoComplete="name"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending…' : 'Send magic link'}
        </Button>
      </form>
    </Card>
  );
}
