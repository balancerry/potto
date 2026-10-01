import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
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

async function readLocalPins(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(`${PIN_PREFIX}${userId}`);
    if (!raw) return [];
    return normalizePins(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function readLocalVisits(userId: string): Promise<PotVisitMap> {
  if (!userId) return {};
  try {
    const raw = await AsyncStorage.getItem(`${VISIT_PREFIX}${userId}`);
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

  const [localPins, localVisits] = await Promise.all([readLocalPins(userId), readLocalVisits(userId)]);
  const nextPins = localPins.slice(0, MAX_PINNED_POTS);
  if (nextPins.length === 0 && Object.keys(localVisits).length === 0) {
    return { pins, visits };
  }

  const { error } = await supabase
    .from('users')
    .update({ pinned_pot_ids: nextPins, pot_visits: localVisits })
    .eq('id', userId);

  if (error) {
    console.error('migrateLocalIfEmpty', error.message);
    return { pins: nextPins, visits: localVisits };
  }
  return { pins: nextPins, visits: localVisits };
}

export async function fetchUserPotPrefs(): Promise<UserPotPrefs & { userId: string | null }> {
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

export async function recordPotVisit(_userId: string, potId: string): Promise<PotVisitMap> {
  if (!potId) return {};
  const { data, error } = await supabase.rpc('record_pot_visit', { p_pot_id: potId });
  if (error) {
    console.error('recordPotVisit', error.message);
    return {};
  }
  return normalizeVisits(data);
}

export async function pinPot(userId: string, potId: string): Promise<PinResult> {
  if (!userId || !potId) return { ok: false, reason: 'limit', pins: [] };

  const { data } = await supabase.from('users').select('pinned_pot_ids').eq('id', userId).maybeSingle();
  const pins = normalizePins(data?.pinned_pot_ids);
  const result = applyPin(pins, potId);
  if (!result.ok) return result;

  const { error } = await supabase.from('users').update({ pinned_pot_ids: result.pins }).eq('id', userId);
  if (error) {
    console.error('pinPot', error.message);
    return { ok: false, reason: 'limit', pins };
  }
  return result;
}

export async function unpinPot(userId: string, potId: string): Promise<string[]> {
  if (!userId || !potId) return [];

  const { data } = await supabase.from('users').select('pinned_pot_ids').eq('id', userId).maybeSingle();
  const current = normalizePins(data?.pinned_pot_ids);
  const next = applyUnpin(current, potId);

  const { error } = await supabase.from('users').update({ pinned_pot_ids: next }).eq('id', userId);
  if (error) {
    console.error('unpinPot', error.message);
    return current;
  }
  return next;
}
