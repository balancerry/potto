'use client';

import { useEffect } from 'react';
import { recordPotVisitRemote } from '@/lib/user-pot-prefs';

/** Marks a pot as visited for home-list ordering (synced via Supabase). */
export function RecordPotVisit({ potId }: { userId?: string; potId: string }) {
  useEffect(() => {
    if (!potId) return;
    void recordPotVisitRemote(potId);
  }, [potId]);

  return null;
}
