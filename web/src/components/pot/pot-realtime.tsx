'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Refetch the open pot when the shared ledger changes. Final numbers come from the server. */
export function PotRealtime({ potId }: { potId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 150);
    };

    const channel = supabase
      .channel(`pot:${potId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `pot_id=eq.${potId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_accounts', filter: `pot_id=eq.${potId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pot_pool_managers', filter: `pot_id=eq.${potId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pot_members', filter: `pot_id=eq.${potId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pot_categories', filter: `pot_id=eq.${potId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commitments', filter: `pot_id=eq.${potId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commitment_payments', filter: `pot_id=eq.${potId}` }, refresh)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [potId, router, supabase]);

  return null;
}
