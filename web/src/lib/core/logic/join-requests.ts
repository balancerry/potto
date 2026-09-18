import type { AccessLevel, JoinRequest, Member, Pot, PottoUser } from '@/types/models';
import { uid } from '@/utils/money';

/**
 * Pure, DOM/UI-free state-transition functions for the invitation & join
 * request flow (see src/mvp/Potto_Invitation_Join_Request_Spec.md). Mirrors
 * the style of accounting.ts: every function takes plain data in and returns
 * plain data (or a typed failure) out — no partial mutation is ever possible,
 * because a caller either applies the full returned slice or discards it.
 *
 * PottoStore MUST call these from inside a setState updater using `prev`
 * (never a stale closure snapshot), so two rapid actions are still applied
 * one-after-another against the latest state — that ordering is what makes
 * "concurrent approval" safe here. supabase/migrations/0003 reproduces the
 * same validation sequence with a real row lock for an eventual real backend.
 */

export interface InviteResolutionOk {
  ok: true;
  pot: Pot;
}
export interface InviteResolutionErr {
  ok: false;
  reason: 'invalid' | 'disabled' | 'archived';
}
// Shared by both entry channels below — resolving an invite link and
// resolving a Join Code both end up producing "the Pot, or why not."
export type InviteResolution = InviteResolutionOk | InviteResolutionErr;

function resolvePotByCode(pots: Record<string, Pot>, matches: (pot: Pot) => boolean, isEnabled: (pot: Pot) => boolean): InviteResolution {
  const pot = Object.values(pots).find(matches);
  if (!pot) return { ok: false, reason: 'invalid' };
  if (pot.status === 'archived') return { ok: false, reason: 'archived' };
  if (!isEnabled(pot)) return { ok: false, reason: 'disabled' };
  return { ok: true, pot };
}

// EXISTING invite-link resolution — untouched behavior, now expressed via the
// shared helper above so the NEW resolveJoinCode below can reuse the exact
// same invalid/archived/disabled precedence without a second implementation.
export function resolveInvite(pots: Record<string, Pot>, code: string): InviteResolution {
  const normalized = (code ?? '').trim().toLowerCase();
  return resolvePotByCode(
    pots,
    (pot) => pot.inviteCode.toLowerCase() === normalized,
    (pot) => pot.inviteEnabled,
  );
}

/**
 * NEW — resolves the zero-cost Join Code (manual entry or QR) to a Pot.
 * Mirrors resolveInvite exactly, but reads pot.joinCode/joinEnabled instead
 * of pot.inviteCode/inviteEnabled — a completely separate identity, never
 * repurposing the invite link's code.
 */
export function resolveJoinCode(pots: Record<string, Pot>, code: string): InviteResolution {
  const normalized = (code ?? '').trim().toUpperCase();
  return resolvePotByCode(
    pots,
    (pot) => pot.joinCode.toUpperCase() === normalized,
    (pot) => pot.joinEnabled,
  );
}

/**
 * Display-only ranking of possible existing-member matches for a requested
 * name. Never used to auto-link — the admin must always explicitly choose
 * (spec section 4). Active members only; ties keep original order.
 */
export function suggestMemberMatches(requestedName: string, members: Member[]): Member[] {
  const needle = requestedName.trim().toLowerCase();
  const needleTokens = new Set(needle.split(/\s+/).filter(Boolean));

  const score = (member: Member): number => {
    const name = member.name.trim().toLowerCase();
    if (name === needle) return 100;
    const nameTokens = name.split(/\s+/).filter(Boolean);
    let s = 0;
    nameTokens.forEach((t) => {
      if (needleTokens.has(t)) s += 10;
    });
    if (needle.includes(name) || name.includes(needle)) s += 5;
    return s;
  };

  return members
    .filter((m) => m.status === 'active')
    .map((m) => ({ m, s: score(m) }))
    .sort((a, b) => b.s - a.s)
    .map(({ m }) => m);
}

function findActiveMemberForUser(members: Member[], userId: string): Member | undefined {
  return members.find((m) => m.status === 'active' && m.userId === userId);
}

function findPendingRequestForUser(joinRequests: JoinRequest[], potId: string, userId: string): JoinRequest | undefined {
  return joinRequests.find((r) => r.potId === potId && r.userId === userId && r.status === 'pending');
}

export type JoinChannel = 'invite_link' | 'join_code';

export type CreateJoinRequestResult =
  | { ok: true; status: 'created'; joinRequest: JoinRequest; joinRequests: JoinRequest[] }
  | { ok: true; status: 'already_member'; member: Member }
  | { ok: true; status: 'already_pending'; joinRequest: JoinRequest }
  | { ok: false; reason: 'invite_disabled' | 'join_code_disabled' | 'pot_archived' };

/**
 * `channel` defaults to 'invite_link' so every existing call site (the
 * invite-link join screen) keeps behaving exactly as before without change.
 * The NEW Join Code flow passes 'join_code' so a code disabled *after* it
 * was resolved (but before the request is actually submitted) is still
 * caught here — the same TOCTOU guard the invite link already had, just
 * generalized to check whichever channel the requester actually came in on.
 */
export function createJoinRequest(
  pot: Pot,
  joinRequests: JoinRequest[],
  requestingUser: PottoUser,
  requestedName: string,
  channel: JoinChannel = 'invite_link',
): CreateJoinRequestResult {
  if (pot.status === 'archived') return { ok: false, reason: 'pot_archived' };
  if (channel === 'join_code') {
    if (!pot.joinEnabled) return { ok: false, reason: 'join_code_disabled' };
  } else if (!pot.inviteEnabled) {
    return { ok: false, reason: 'invite_disabled' };
  }

  const activeMember = findActiveMemberForUser(pot.members, requestingUser.id);
  if (activeMember) return { ok: true, status: 'already_member', member: activeMember };

  const pending = findPendingRequestForUser(joinRequests, pot.id, requestingUser.id);
  if (pending) return { ok: true, status: 'already_pending', joinRequest: pending };

  const joinRequest: JoinRequest = {
    id: uid('jreq'),
    potId: pot.id,
    userId: requestingUser.id,
    requestedName: requestedName.trim(),
    status: 'pending',
    linkedMemberId: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
  };

  return { ok: true, status: 'created', joinRequest, joinRequests: [...joinRequests, joinRequest] };
}

export type ApproveFailureReason =
  | 'request_not_found'
  | 'request_not_pending'
  | 'member_not_found'
  | 'member_already_linked';

export type ApproveResult =
  | { ok: true; members: Member[]; joinRequests: JoinRequest[]; linkedMemberId: string }
  | { ok: false; reason: ApproveFailureReason };

function findPendingRequestInPot(pot: Pot, joinRequests: JoinRequest[], joinRequestId: string): JoinRequest | undefined {
  return joinRequests.find((r) => r.id === joinRequestId && r.potId === pot.id);
}

/**
 * Links an existing pot_member to the requesting account. The member's id
 * and all historical transactions referencing it are untouched — only
 * `userId`/`status`/`accessLevel` change (spec section 9).
 */
export function approveExistingMember(
  pot: Pot,
  joinRequests: JoinRequest[],
  input: { joinRequestId: string; memberId: string; accessLevel: AccessLevel; reviewerMemberId: string },
): ApproveResult {
  const request = findPendingRequestInPot(pot, joinRequests, input.joinRequestId);
  if (!request) return { ok: false, reason: 'request_not_found' };
  if (request.status !== 'pending') return { ok: false, reason: 'request_not_pending' };

  const member = pot.members.find((m) => m.id === input.memberId);
  if (!member) return { ok: false, reason: 'member_not_found' };

  // Unique(pot_id, user_id) where user_id is not null — a member already linked
  // to a *different* user can never be re-linked (prevents two users sharing one
  // financial identity). Re-linking the same user, or a previously-removed
  // (userId cleared) member, is allowed — that's exactly the rejoin case.
  if (member.userId && member.userId !== request.userId) {
    return { ok: false, reason: 'member_already_linked' };
  }

  const now = new Date().toISOString();
  const members = pot.members.map((m) =>
    m.id === member.id ? { ...m, userId: request.userId, status: 'active' as const, accessLevel: input.accessLevel } : m,
  );
  const nextJoinRequests = joinRequests.map((r) =>
    r.id === request.id
      ? { ...r, status: 'approved' as const, linkedMemberId: member.id, reviewedBy: input.reviewerMemberId, reviewedAt: now }
      : r,
  );

  return { ok: true, members, joinRequests: nextJoinRequests, linkedMemberId: member.id };
}

/**
 * Creates a brand-new pot_member and links it to the requester. Never
 * touches any other member's transactions or balance.
 */
export function approveNewMember(
  pot: Pot,
  joinRequests: JoinRequest[],
  input: { joinRequestId: string; displayName: string; accessLevel: AccessLevel; reviewerMemberId: string },
): ApproveResult {
  const request = findPendingRequestInPot(pot, joinRequests, input.joinRequestId);
  if (!request) return { ok: false, reason: 'request_not_found' };
  if (request.status !== 'pending') return { ok: false, reason: 'request_not_pending' };

  const now = new Date().toISOString();
  const newMember: Member = {
    id: uid('mem'),
    name: input.displayName.trim(),
    role: 'member',
    accessLevel: input.accessLevel,
    status: 'active',
    userId: request.userId,
    joinedAt: now.slice(0, 10),
  };
  const members = [...pot.members, newMember];
  const nextJoinRequests = joinRequests.map((r) =>
    r.id === request.id
      ? { ...r, status: 'approved' as const, linkedMemberId: newMember.id, reviewedBy: input.reviewerMemberId, reviewedAt: now }
      : r,
  );

  return { ok: true, members, joinRequests: nextJoinRequests, linkedMemberId: newMember.id };
}

export type RejectResult =
  | { ok: true; joinRequests: JoinRequest[] }
  | { ok: false; reason: 'request_not_found' | 'request_not_pending' };

export function rejectJoinRequest(
  pot: Pot,
  joinRequests: JoinRequest[],
  input: { joinRequestId: string; reviewerMemberId: string },
): RejectResult {
  const request = findPendingRequestInPot(pot, joinRequests, input.joinRequestId);
  if (!request) return { ok: false, reason: 'request_not_found' };
  if (request.status !== 'pending') return { ok: false, reason: 'request_not_pending' };

  const now = new Date().toISOString();
  const nextJoinRequests = joinRequests.map((r) =>
    r.id === request.id ? { ...r, status: 'rejected' as const, reviewedBy: input.reviewerMemberId, reviewedAt: now } : r,
  );
  return { ok: true, joinRequests: nextJoinRequests };
}

/**
 * Removes a member's access without deleting their financial identity.
 * Historical transactions keep referencing the same memberId. Clearing
 * userId allows an explicit future admin re-link (rejoin) — it is never
 * re-linked automatically.
 */
export function removeMember(pot: Pot, memberId: string): Member[] {
  return pot.members.map((m) => (m.id === memberId ? { ...m, status: 'inactive' as const, userId: null } : m));
}

export function setInviteEnabled(pot: Pot, enabled: boolean): Pot {
  return { ...pot, inviteEnabled: enabled };
}

/** NEW — same idea as setInviteEnabled, for the separate Join Code channel. */
export function setJoinEnabled(pot: Pot, enabled: boolean): Pot {
  return { ...pot, joinEnabled: enabled };
}
