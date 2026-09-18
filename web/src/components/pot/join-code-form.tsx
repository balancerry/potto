'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { normalizeJoinCodeInput } from '@/lib/core/logic/invites';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';

export function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeJoinCodeInput(code);
    if (normalized.length !== 6) {
      toast.error('Enter a 6-character join code');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('resolve_join_code', { p_code: normalized });
    setLoading(false);

    if (error) {
      toast.error(error.message || 'Could not look up that code');
      return;
    }

    const row = (Array.isArray(data) ? data[0] : data) as { id?: string } | null;
    if (!row?.id) {
      toast.error('No pot found for that join code');
      return;
    }

    router.push(`/join/pot/${row.id}?channel=join_code&code=${encodeURIComponent(normalized)}`);
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardTitle>Join with a code</CardTitle>
      <CardDescription>Ask a pot admin for the 6-character join code or QR.</CardDescription>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="code">Join code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(normalizeJoinCodeInput(e.target.value))}
            placeholder="ABC123"
            className="font-mono tracking-widest uppercase"
            maxLength={6}
            autoComplete="off"
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Looking up…' : 'Continue'}
        </Button>
      </form>
    </Card>
  );
}
