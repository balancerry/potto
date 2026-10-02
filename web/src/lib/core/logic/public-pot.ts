/**
 * Public (anonymous, read-only) pot sharing. Pure, DOM/UI-free; mirrored
 * byte-for-byte at web/src/lib/core/logic/public-pot.ts.
 *
 * The server (`get_public_pot` RPC, migration 0019) is the privacy boundary: it
 * returns an allow-listed snapshot with names and amounts only — no ids, emails,
 * notes, roles or planned payments. Everything here only parses that snapshot
 * and derives view data from it; nothing in this file can widen what is exposed.
 *
 * Money is integer paise, like the rest of Potto.
 */

/** Shape of a share link token (see pot_public_share_token_format). */
export const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

/**
 * A pot's internal id. Syntactically it would pass PUBLIC_TOKEN_PATTERN (36 hex/hyphen
 * characters), so it is excluded explicitly: the mobile app routes `/pot/<uuid>` to the
 * signed-in pot screen and must never treat an internal id as a share token.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cheap client-side check so obviously malformed links never hit the network. */
export function isPlausiblePublicToken(token: string | null | undefined): token is string {
  return typeof token === 'string' && PUBLIC_TOKEN_PATTERN.test(token) && !UUID_PATTERN.test(token);
}

export type PublicTransactionType = 'contribution' | 'pool_expense' | 'member_expense' | 'settlement';

export interface PublicCategory {
  name: string;
  /** Lucide id from the controlled catalog. */
  icon: string;
  /** Palette key from the controlled catalog. */
  color: string;
}

export interface PublicTransaction {
  type: PublicTransactionType;
  description: string;
  amount: number; // paise
  date: string; // YYYY-MM-DD
  createdAt: string;
  /** Contributor / payer / settlement sender, by display name. */
  paidBy: string | null;
  /** Settlement receiver, by display name. */
  to: string | null;
  category: PublicCategory | null;
  /** Expense participants, by display name. */
  participants: string[];
}

export interface PublicMember {
  name: string;
  contributed: number; // paise
}

export interface PublicPot {
  name: string;
  description: string | null;
  archived: boolean;
  memberCount: number;
  contributed: number; // paise
  spent: number; // paise
  /** Pool balance: contributions minus pool expenses. */
  balance: number; // paise
  transactionCount: number;
  members: PublicMember[];
  /** Newest first. May be a capped page of the ledger; see `truncated`. */
  transactions: PublicTransaction[];
  truncated: boolean;
  /** Set by the server only when the signed-in viewer is already a member of this pot. */
  viewerPotId: string | null;
  generatedAt: string;
}

export type PublicPotResult =
  | { status: 'ok'; pot: PublicPot }
  | { status: 'not_found' }
  | { status: 'revoked' };

const TRANSACTION_TYPES: readonly string[] = ['contribution', 'pool_expense', 'member_expense', 'settlement'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function optStr(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function int(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function parseTransaction(raw: unknown): PublicTransaction | null {
  if (!isRecord(raw)) return null;
  const type = str(raw.type);
  if (!TRANSACTION_TYPES.includes(type)) return null;

  let category: PublicCategory | null = null;
  if (isRecord(raw.category)) {
    category = {
      name: str(raw.category.name),
      icon: str(raw.category.icon, 'tag'),
      color: str(raw.category.color, 'gray'),
    };
  }

  return {
    type: type as PublicTransactionType,
    description: str(raw.description),
    amount: int(raw.amount),
    date: str(raw.date).slice(0, 10),
    createdAt: str(raw.created_at),
    paidBy: optStr(raw.paid_by),
    to: optStr(raw.to),
    category,
    participants: Array.isArray(raw.participants)
      ? raw.participants.filter((p): p is string => typeof p === 'string')
      : [],
  };
}

/**
 * Parses the JSON returned by `get_public_pot`. Throws on a shape it does not
 * recognise so callers surface their normal error + retry state instead of
 * rendering a half-empty pot.
 */
export function parsePublicPotResponse(raw: unknown): PublicPotResult {
  if (!isRecord(raw)) throw new Error('Unexpected response from the server');

  if (raw.status === 'not_found') return { status: 'not_found' };
  if (raw.status === 'revoked') return { status: 'revoked' };
  if (raw.status !== 'ok' || !isRecord(raw.pot) || !isRecord(raw.summary)) {
    throw new Error('Unexpected response from the server');
  }

  const members: PublicMember[] = Array.isArray(raw.members)
    ? raw.members.filter(isRecord).map((m) => ({ name: str(m.name, 'Member'), contributed: int(m.contributed) }))
    : [];
  const transactions: PublicTransaction[] = Array.isArray(raw.transactions)
    ? raw.transactions.map(parseTransaction).filter((t): t is PublicTransaction => t !== null)
    : [];

  return {
    status: 'ok',
    pot: {
      name: str(raw.pot.name, 'Pot'),
      description: optStr(raw.pot.description),
      archived: raw.pot.archived === true,
      memberCount: int(raw.summary.member_count),
      contributed: int(raw.summary.contributed),
      spent: int(raw.summary.spent),
      balance: int(raw.summary.balance),
      transactionCount: int(raw.summary.transaction_count),
      members,
      transactions,
      truncated: raw.transactions_truncated === true,
      viewerPotId: optStr(raw.viewer_pot_id),
      generatedAt: str(raw.generated_at),
    },
  };
}

// ---------------------------------------------------------------------------
// Derived view data
// ---------------------------------------------------------------------------

export function publicContributions(pot: PublicPot): PublicTransaction[] {
  return pot.transactions.filter((t) => t.type === 'contribution');
}

export function publicExpenses(pot: PublicPot): PublicTransaction[] {
  return pot.transactions.filter((t) => t.type === 'pool_expense' || t.type === 'member_expense');
}

export interface ContributorSummary {
  name: string;
  contributed: number; // paise
  /** 0–1 share of everything contributed. */
  share: number;
}

/** Everyone who has put money in, biggest first. Members who have not contributed are left out. */
export function contributorSummaries(pot: PublicPot): ContributorSummary[] {
  const total = pot.members.reduce((sum, m) => sum + m.contributed, 0);
  return pot.members
    .filter((m) => m.contributed > 0)
    .map((m) => ({ name: m.name, contributed: m.contributed, share: total > 0 ? m.contributed / total : 0 }))
    .sort((a, b) => b.contributed - a.contributed || a.name.localeCompare(b.name));
}

export interface DateGroup<T> {
  date: string; // YYYY-MM-DD
  items: T[];
}

/** Groups an already date-sorted list into consecutive same-day groups, keeping order. */
export function groupByDate<T extends { date: string }>(items: T[]): DateGroup<T>[] {
  const groups: DateGroup<T>[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }
  return groups;
}

export function activityKind(type: PublicTransactionType): 'Contribution' | 'Expense' | 'Settlement' {
  if (type === 'contribution') return 'Contribution';
  if (type === 'settlement') return 'Settlement';
  return 'Expense';
}

/** One-line headline for an activity row (the amount is shown separately). */
export function activityTitle(tx: PublicTransaction): string {
  if (tx.type === 'contribution') return `${tx.paidBy ?? 'Someone'} contributed`;
  if (tx.type === 'settlement') return `${tx.paidBy ?? 'Someone'} paid ${tx.to ?? 'someone'}`;
  return tx.description;
}

/** Who funded an expense. */
export function expensePayer(tx: PublicTransaction): string {
  if (tx.type === 'pool_expense') return tx.paidBy ? `Paid from the pool by ${tx.paidBy}` : 'Paid from the pool';
  return `Paid by ${tx.paidBy ?? 'a member'}`;
}

/** "Split among A, B and 2 others" — empty string when there is nobody to name. */
export function participantSummary(names: string[], maxNamed = 3): string {
  if (names.length === 0) return '';
  if (names.length <= maxNamed) {
    if (names.length === 1) return `For ${names[0]}`;
    return `Split among ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  const rest = names.length - maxNamed;
  return `Split among ${names.slice(0, maxNamed).join(', ')} and ${rest} other${rest === 1 ? '' : 's'}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "3 Mar 2026" from a YYYY-MM-DD string. Built from the string parts, never a
 * Date, so server-rendered and client-rendered output match in every timezone.
 */
export function formatPublicDate(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!match) return ymd;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return ymd;
  return `${Number(match[3])} ${month} ${match[1]}`;
}

// ---------------------------------------------------------------------------
// Links + messages
// ---------------------------------------------------------------------------

/** Path of the public viewer, same on web and mobile deep links. */
export function publicPotPath(token: string): string {
  return `/pot/${token}`;
}

/** Absolute shareable URL, e.g. https://trypotto.in/pot/<token>. */
export function buildPublicPotUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${publicPotPath(token)}`;
}

/**
 * Pulls the token out of a shared link or path (`https://host/pot/<token>`,
 * `/pot/<token>?x=1`). Returns null for anything else, including a token-shaped
 * string that is not under /pot/.
 */
export function extractPublicToken(input: string): string | null {
  const match = /(?:^|\/)pot\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/.exec(input.trim());
  return match && isPlausiblePublicToken(match[1]) ? match[1] : null;
}

/** Body text for the system share sheet / WhatsApp. The link goes with it. */
export function buildShareMessage(potName: string): string {
  return `Check out our ${potName.trim() || 'Potto'} pot on Potto:`;
}

// ---------------------------------------------------------------------------
// Share-sheet state (for members managing the link)
// ---------------------------------------------------------------------------

export interface PublicShareState {
  enabled: boolean;
  /** Null while sharing is off. */
  token: string | null;
  sharedAt: string | null;
  /** Owners and admins only. */
  canManage: boolean;
}

export const PUBLIC_SHARE_OFF: PublicShareState = { enabled: false, token: null, sharedAt: null, canManage: false };

/** Parses one row of `get_pot_public_share` / `enable_pot_public_share`. */
export function parsePublicShareState(raw: unknown): PublicShareState {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!isRecord(row)) return PUBLIC_SHARE_OFF;
  const token = optStr(row.token);
  const enabled = row.enabled === true && token !== null;
  return {
    enabled,
    token: enabled ? token : null,
    sharedAt: enabled ? optStr(row.shared_at) : null,
    canManage: row.can_manage === true,
  };
}
