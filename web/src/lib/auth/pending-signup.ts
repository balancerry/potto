/**
 * Temporary in-memory signup credential stash (sessionStorage).
 * Never logs the password. Cleared after successful establishment or explicit cancel.
 */

const KEY = 'potto.pendingSignup';

export type PendingSignup = {
  email: string;
  name: string;
  /** Kept only in sessionStorage for the originating browser tab. */
  password: string;
  createdAt: number;
};

const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export function savePendingSignup(data: Omit<PendingSignup, 'createdAt'>): void {
  if (typeof window === 'undefined') return;
  const payload: PendingSignup = { ...data, createdAt: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function readPendingSignup(): PendingSignup | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignup;
    if (!parsed?.email || !parsed?.password) {
      clearPendingSignup();
      return null;
    }
    if (Date.now() - (parsed.createdAt || 0) > MAX_AGE_MS) {
      clearPendingSignup();
      return null;
    }
    return parsed;
  } catch {
    clearPendingSignup();
    return null;
  }
}

export function clearPendingSignup(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
}
