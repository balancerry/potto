export const MAX_PINNED_POTS = 3;

/** potId → last visited ISO timestamp */
export type PotVisitMap = Record<string, string>;

export type UserPotPrefs = {
  pins: string[];
  visits: PotVisitMap;
};

export function normalizePins(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string').slice(0, MAX_PINNED_POTS);
}

export function normalizeVisits(raw: unknown): PotVisitMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: PotVisitMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value) out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = new Date(value).toISOString();
  }
  return out;
}

export function visitTimestamp(visits: PotVisitMap, potId: string): number {
  const value = visits[potId];
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export function isPotPinned(pins: string[], potId: string): boolean {
  return pins.includes(potId);
}

export function pinRank(pins: string[], potId: string): number {
  const idx = pins.indexOf(potId);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}

export type PinResult = { ok: true; pins: string[] } | { ok: false; reason: 'limit'; pins: string[] };

export function applyPin(pins: string[], potId: string): PinResult {
  if (pins.includes(potId)) return { ok: true, pins };
  if (pins.length >= MAX_PINNED_POTS) return { ok: false, reason: 'limit', pins };
  return { ok: true, pins: [potId, ...pins] };
}

export function applyUnpin(pins: string[], potId: string): string[] {
  return pins.filter((id) => id !== potId);
}

/**
 * Home list order:
 * 1) pinned pots (pin order)
 * 2) remaining pots by most recent visit
 * 3) never-visited pots by newest created
 */
export function sortPotsByPinThenVisit<T extends { id: string; createdAt?: string }>(
  pots: T[],
  visits: PotVisitMap,
  pins: string[],
): T[] {
  return [...pots].sort((a, b) => {
    const pinDiff = pinRank(pins, a.id) - pinRank(pins, b.id);
    if (pinDiff !== 0) return pinDiff;
    const visitDiff = visitTimestamp(visits, b.id) - visitTimestamp(visits, a.id);
    if (visitDiff !== 0) return visitDiff;
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });
}
