'use client';

import { createClient } from '@/lib/supabase/client';
import {
  MAX_PINNED_POTS,
  applyPin,
  applyUnpin,
  normalizePins,
  normalizeVisits,
  type PinResult,
  type PotVisitMap,
  type UserPotPrefs,
} from '@/lib/recent-pots';

const VISIT_PREFIX = 'potto:pot-visits:';
const PIN_PREFIX = 'potto:pot-pins:';

function readLocalPins(userId: string): string[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = window.localStorage.getItem(`${PIN_PREFIX}${userId}`);
    if (!raw) return [];
    return normalizePins(JSON.parse(raw));
  } catch {
    return [];
  }
}

function readLocalVisits(userId: string): PotVisitMap {
  if (typeof window === 'undefined' || !userId) return {};
  try {
    const raw = window.localStorage.getItem(`${VISIT_PREFIX}${userId}`);
    if (!raw) return {};
    return normalizeVisits(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function migrateLocalIfEmpty(
  userId: string,
  pins: string[],
  visits: PotVisitMap,
): Promise<UserPotPrefs> {
  if (pins.length > 0 || Object.keys(visits).length > 0) return { pins, visits };

  const localPins = readLocalPins(userId).slice(0, MAX_PINNED_POTS);
  const localVisits = readLocalVisits(userId);
  if (localPins.length === 0 && Object.keys(localVisits).length === 0) {
    return { pins, visits };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('users')
    .update({ pinned_pot_ids: localPins, pot_visits: localVisits })
    .eq('id', userId);

  if (error) {
    console.error('migrateLocalIfEmpty', error.message);
    return { pins: localPins, visits: localVisits };
  }
  return { pins: localPins, visits: localVisits };
}

export async function fetchUserPotPrefs(): Promise<UserPotPrefs & { userId: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, pins: [], visits: {} };

  const { data, error } = await supabase
    .from('users')
    .select('pinned_pot_ids, pot_visits')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('fetchUserPotPrefs', error.message);
    return { userId: user.id, pins: [], visits: {} };
  }

  const migrated = await migrateLocalIfEmpty(
    user.id,
    normalizePins(data?.pinned_pot_ids),
    normalizeVisits(data?.pot_visits),
  );

  return { userId: user.id, ...migrated };
}

export async function recordPotVisitRemote(potId: string): Promise<PotVisitMap> {
  if (!potId) return {};
  const supabase = createClient();
  const { data, error } = await supabase.rpc('record_pot_visit', { p_pot_id: potId });
  if (error) {
    console.error('recordPotVisitRemote', error.message);
    return {};
  }
  return normalizeVisits(data);
}

export async function pinPotRemote(potId: string): Promise<PinResult> {
  if (!potId) return { ok: false, reason: 'limit', pins: [] };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'limit', pins: [] };

  const { data } = await supabase.from('users').select('pinned_pot_ids').eq('id', user.id).maybeSingle();
  const pins = normalizePins(data?.pinned_pot_ids);
  const result = applyPin(pins, potId);
  if (!result.ok) return result;

  const { error } = await supabase.from('users').update({ pinned_pot_ids: result.pins }).eq('id', user.id);
  if (error) {
    console.error('pinPotRemote', error.message);
    return { ok: false, reason: 'limit', pins };
  }
  return result;
}

export async function unpinPotRemote(potId: string): Promise<string[]> {
  if (!potId) return [];

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase.from('users').select('pinned_pot_ids').eq('id', user.id).maybeSingle();
  const next = applyUnpin(normalizePins(data?.pinned_pot_ids), potId);

  const { error } = await supabase.from('users').update({ pinned_pot_ids: next }).eq('id', user.id);
  if (error) {
    console.error('unpinPotRemote', error.message);
    return normalizePins(data?.pinned_pot_ids);
  }
  return next;
}
