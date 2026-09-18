import { calculateMemberBalances } from '@/logic/accounting';
import {
  approveExistingMember,
  approveNewMember,
  createJoinRequest,
  rejectJoinRequest,
  removeMember,
  resolveInvite,
  resolveJoinCode,
  setInviteEnabled,
  setJoinEnabled,
} from '@/logic/join-requests';
import type { JoinRequest, Member, Pot, PottoUser, Transaction } from '@/types/models';

function makeMember(overrides: Partial<Member>): Member {
  return {
    id: 'mem_default',
    name: 'Member',
    role: 'member',
    accessLevel: 'member',
    status: 'active',
    userId: null,
    joinedAt: '2026-01-01',
    ...overrides,
  };
}

function makePot(overrides: Partial<Pot> = {}, members: Member[] = []): Pot {
  return {
    id: 'pot_1',
    name: 'Goa 2026',
    currency: 'INR',
    createdBy: 'mem_admin',
    inviteCode: 'goa-7k2m',
    inviteEnabled: true,
    joinCode: '7K2M9P',
    joinEnabled: true,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    members,
    ...overrides,
  };
}

function makeUser(id: string, name: string): PottoUser {
  return { id, name };
}

describe('resolveInvite', () => {
  const admin = makeMember({ id: 'mem_admin', role: 'admin' });

  it('rejects an invalid code', () => {
    const pots = { pot_1: makePot({}, [admin]) };
    expect(resolveInvite(pots, 'does-not-exist')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a disabled invite', () => {
    const pot = makePot({ inviteEnabled: false }, [admin]);
    const result = resolveInvite({ [pot.id]: pot }, pot.inviteCode);
    expect(result).toEqual({ ok: false, reason: 'disabled' });
  });

  it('rejects an archived pot even if the code matches', () => {
    const pot = makePot({ status: 'archived' }, [admin]);
    const result = resolveInvite({ [pot.id]: pot }, pot.inviteCode);
    expect(result).toEqual({ ok: false, reason: 'archived' });
  });

  it('resolves a valid, enabled invite', () => {
    const pot = makePot({}, [admin]);
    const result = resolveInvite({ [pot.id]: pot }, pot.inviteCode.toUpperCase());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pot.id).toBe(pot.id);
  });
});

// NEW — the zero-cost Join Code resolution path. Mirrors resolveInvite's
// tests exactly (same precedence: invalid -> archived -> disabled -> ok) but
// reads joinCode/joinEnabled, proving it's a fully separate identity that
// never touches inviteCode/inviteEnabled.
describe('resolveJoinCode', () => {
  const admin = makeMember({ id: 'mem_admin', role: 'admin' });

  it('rejects an invalid code', () => {
    const pots = { pot_1: makePot({}, [admin]) };
    expect(resolveJoinCode(pots, 'ZZZZZZ')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a disabled join code even though the invite link is still enabled', () => {
    const pot = makePot({ joinEnabled: false }, [admin]);
    const result = resolveJoinCode({ [pot.id]: pot }, pot.joinCode);
    expect(result).toEqual({ ok: false, reason: 'disabled' });
    // The invite link is completely unaffected by disabling the join code.
    expect(resolveInvite({ [pot.id]: pot }, pot.inviteCode)).toMatchObject({ ok: true });
  });

  it('rejects an archived pot even if the code matches', () => {
    const pot = makePot({ status: 'archived' }, [admin]);
    expect(resolveJoinCode({ [pot.id]: pot }, pot.joinCode)).toEqual({ ok: false, reason: 'archived' });
  });

  it('resolves a valid, enabled join code case-insensitively', () => {
    const pot = makePot({}, [admin]);
    const result = resolveJoinCode({ [pot.id]: pot }, pot.joinCode.toLowerCase());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pot.id).toBe(pot.id);
  });

  it("a pot's inviteCode never resolves as a join code, and vice versa", () => {
    const pot = makePot({ inviteCode: 'goa-7k2m', joinCode: '7K2M9P' }, [admin]);
    expect(resolveJoinCode({ [pot.id]: pot }, 'goa-7k2m')).toEqual({ ok: false, reason: 'invalid' });
    expect(resolveInvite({ [pot.id]: pot }, '7K2M9P')).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('setJoinEnabled', () => {
  it('toggles independently of the invite link', () => {
    const admin = makeMember({ id: 'mem_admin', role: 'admin' });
    const pot = makePot({}, [admin]);
    const disabled = setJoinEnabled(pot, false);
    expect(disabled.joinEnabled).toBe(false);
    expect(disabled.inviteEnabled).toBe(true); // untouched
    expect(pot.joinEnabled).toBe(true); // original untouched (pure function)
  });
});

describe('createJoinRequest', () => {
  const admin = makeMember({ id: 'mem_admin', role: 'admin' });
  const existingMember = makeMember({ id: 'mem_existing', name: 'Rajkumar', userId: 'user_existing' });

  it('short-circuits when the user is already an active member', () => {
    const pot = makePot({}, [admin, existingMember]);
    const result = createJoinRequest(pot, [], makeUser('user_existing', 'Rajkumar Jangid'), 'Rajkumar Jangid');
    expect(result).toMatchObject({ ok: true, status: 'already_member' });
  });

  it('prevents a duplicate pending request for the same user + pot', () => {
    const pot = makePot({}, [admin]);
    const requester = makeUser('user_new', 'Rajkumar Jangid');
    const first = createJoinRequest(pot, [], requester, 'Rajkumar Jangid');
    expect(first.ok && first.status).toBe('created');
    const joinRequests = first.ok && first.status === 'created' ? first.joinRequests : [];

    const second = createJoinRequest(pot, joinRequests, requester, 'Rajkumar Jangid');
    expect(second).toMatchObject({ ok: true, status: 'already_pending' });
    expect(joinRequests).toHaveLength(1); // no duplicate row created
  });

  it('rejects a request when the invite is disabled', () => {
    const pot = makePot({ inviteEnabled: false }, [admin]);
    const result = createJoinRequest(pot, [], makeUser('u1', 'X'), 'X');
    expect(result).toEqual({ ok: false, reason: 'invite_disabled' });
  });

  it('rejects a request when the pot is archived', () => {
    const pot = makePot({ status: 'archived' }, [admin]);
    const result = createJoinRequest(pot, [], makeUser('u1', 'X'), 'X');
    expect(result).toEqual({ ok: false, reason: 'pot_archived' });
  });

  it('allows a previously-rejected user to request again', () => {
    const pot = makePot({}, [admin]);
    const requester = makeUser('user_new', 'Rajkumar Jangid');
    const created = createJoinRequest(pot, [], requester, 'Rajkumar Jangid');
    const firstRequest = created.ok && created.status === 'created' ? created.joinRequest : undefined;
    expect(firstRequest).toBeDefined();

    const rejected = rejectJoinRequest(pot, [firstRequest!], { joinRequestId: firstRequest!.id, reviewerMemberId: admin.id });
    expect(rejected.ok).toBe(true);
    const afterReject = rejected.ok ? rejected.joinRequests : [];

    const second = createJoinRequest(pot, afterReject, requester, 'Rajkumar Jangid');
    expect(second).toMatchObject({ ok: true, status: 'created' });
  });

  // NEW — channel-aware behavior. Omitting `channel` (as every existing
  // invite-link call site does) is byte-for-byte the same as before.
  it('defaults to the invite-link channel when none is given (existing behavior unchanged)', () => {
    const pot = makePot({ inviteEnabled: false }, [admin]);
    const result = createJoinRequest(pot, [], makeUser('u1', 'X'), 'X');
    expect(result).toEqual({ ok: false, reason: 'invite_disabled' });
  });

  it('rejects a join-code request when the join code is disabled, even if the invite link is enabled', () => {
    const pot = makePot({ inviteEnabled: true, joinEnabled: false }, [admin]);
    const result = createJoinRequest(pot, [], makeUser('u1', 'X'), 'X', 'join_code');
    expect(result).toEqual({ ok: false, reason: 'join_code_disabled' });
  });

  it('allows a join-code request when the join code is enabled, even if the invite link is disabled', () => {
    const pot = makePot({ inviteEnabled: false, joinEnabled: true }, [admin]);
    const result = createJoinRequest(pot, [], makeUser('u1', 'X'), 'X', 'join_code');
    expect(result).toMatchObject({ ok: true, status: 'created' });
  });

  it('both channels feed the exact same join_requests list for the pot (one shared architecture)', () => {
    const pot = makePot({}, [admin]);
    const viaLink = createJoinRequest(pot, [], makeUser('u1', 'Via Link'), 'Via Link', 'invite_link');
    if (!viaLink.ok || viaLink.status !== 'created') throw new Error('setup failed');
    const viaCode = createJoinRequest(pot, viaLink.joinRequests, makeUser('u2', 'Via Code'), 'Via Code', 'join_code');
    if (!viaCode.ok || viaCode.status !== 'created') throw new Error('setup failed');

    expect(viaCode.joinRequests).toHaveLength(2);
    expect(viaCode.joinRequests.every((r) => r.potId === pot.id)).toBe(true);
  });
});

describe('approveExistingMember', () => {
  const admin = makeMember({ id: 'mem_admin', role: 'admin' });
  const existingMember = makeMember({ id: 'mem_rajkumar', name: 'Rajkumar' });

  function setup() {
    const pot = makePot({}, [admin, existingMember]);
    const requester = makeUser('user_new', 'Rajkumar Jangid');
    const created = createJoinRequest(pot, [], requester, 'Rajkumar Jangid');
    if (!created.ok || created.status !== 'created') throw new Error('setup failed');
    return { pot, request: created.joinRequest, joinRequests: created.joinRequests, requester };
  }

  it('links the existing member without creating a new financial identity', () => {
    const { pot, request, joinRequests } = setup();
    const result = approveExistingMember(pot, joinRequests, {
      joinRequestId: request.id,
      memberId: existingMember.id,
      accessLevel: 'member',
      reviewerMemberId: admin.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.members).toHaveLength(2); // no new member row
    const linked = result.members.find((m) => m.id === existingMember.id)!;
    expect(linked.userId).toBe(request.userId);
    expect(linked.status).toBe('active');
    expect(linked.accessLevel).toBe('member');

    const updatedRequest = result.joinRequests.find((r) => r.id === request.id)!;
    expect(updatedRequest.status).toBe('approved');
    expect(updatedRequest.linkedMemberId).toBe(existingMember.id);
    expect(updatedRequest.reviewedBy).toBe(admin.id);
    expect(updatedRequest.reviewedAt).toBeTruthy();
  });

  it('preserves historical transactions and balance when linking', () => {
    const { pot, request, joinRequests } = setup();
    const txs: Transaction[] = [
      {
        id: 'tx_1',
        potId: pot.id,
        type: 'contribution',
        description: 'Trip contribution',
        amount: 1_000_000,
        paidBy: existingMember.id,
        date: '2026-01-01',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: existingMember.id,
      },
    ];
    const balancesBefore = calculateMemberBalances(pot.members, txs);

    const result = approveExistingMember(pot, joinRequests, {
      joinRequestId: request.id,
      memberId: existingMember.id,
      accessLevel: 'member',
      reviewerMemberId: admin.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Transactions are untouched (they only ever referenced pot_member_id).
    const balancesAfter = calculateMemberBalances(result.members, txs);
    expect(balancesAfter[existingMember.id]).toBe(balancesBefore[existingMember.id]);
    expect(balancesAfter[existingMember.id]).toBe(1_000_000);
  });

  it('refuses to link a member already linked to a different user', () => {
    const linkedElsewhere = makeMember({ id: 'mem_linked', name: 'Sakshi', userId: 'user_other' });
    const pot = makePot({}, [admin, linkedElsewhere]);
    const created = createJoinRequest(pot, [], makeUser('user_new', 'Someone'), 'Someone');
    if (!created.ok || created.status !== 'created') throw new Error('setup failed');

    const result = approveExistingMember(pot, created.joinRequests, {
      joinRequestId: created.joinRequest.id,
      memberId: linkedElsewhere.id,
      accessLevel: 'member',
      reviewerMemberId: admin.id,
    });
    expect(result).toEqual({ ok: false, reason: 'member_already_linked' });
  });

  it('fails safely on a second concurrent approval of the same request', () => {
    const { pot, request, joinRequests } = setup();
    const otherMember = makeMember({ id: 'mem_other', name: 'Someone Else' });
    const potWithOther = { ...pot, members: [...pot.members, otherMember] };

    const first = approveExistingMember(potWithOther, joinRequests, {
      joinRequestId: request.id,
      memberId: existingMember.id,
      accessLevel: 'member',
      reviewerMemberId: admin.id,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // Second admin's action is applied against the *already-updated* join
    // requests (as PottoStore's setState always does against `prev`), so it
    // must be rejected rather than double-linking a second member.
    const second = approveExistingMember(potWithOther, first.joinRequests, {
      joinRequestId: request.id,
      memberId: otherMember.id,
      accessLevel: 'member',
      reviewerMemberId: admin.id,
    });
    expect(second).toEqual({ ok: false, reason: 'request_not_pending' });
  });
});

describe('approveNewMember', () => {
  const admin = makeMember({ id: 'mem_admin', role: 'admin' });
  const untouchedMember = makeMember({ id: 'mem_untouched', name: 'Amit' });

  it('creates a new member and never touches other members’ transactions', () => {
    const pot = makePot({}, [admin, untouchedMember]);
    const created = createJoinRequest(pot, [], makeUser('user_new', 'Priya'), 'Priya');
    if (!created.ok || created.status !== 'created') throw new Error('setup failed');

    const txs: Transaction[] = [
      {
        id: 'tx_1',
        potId: pot.id,
        type: 'contribution',
        description: 'x',
        amount: 500,
        paidBy: untouchedMember.id,
        date: '2026-01-01',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: untouchedMember.id,
      },
    ];
    const balancesBefore = calculateMemberBalances(pot.members, txs);

    const result = approveNewMember(pot, created.joinRequests, {
      joinRequestId: created.joinRequest.id,
      displayName: 'Priya',
      accessLevel: 'view_only',
      reviewerMemberId: admin.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.members).toHaveLength(3);
    const newMember = result.members.find((m) => m.id === result.linkedMemberId)!;
    expect(newMember.name).toBe('Priya');
    expect(newMember.accessLevel).toBe('view_only');
    expect(newMember.userId).toBe('user_new');

    const balancesAfter = calculateMemberBalances(result.members, txs);
    expect(balancesAfter[untouchedMember.id]).toBe(balancesBefore[untouchedMember.id]);
  });
});

describe('rejectJoinRequest', () => {
  const admin = makeMember({ id: 'mem_admin', role: 'admin' });

  it('marks the request rejected without creating a member', () => {
    const pot = makePot({}, [admin]);
    const created = createJoinRequest(pot, [], makeUser('u1', 'X'), 'X');
    if (!created.ok || created.status !== 'created') throw new Error('setup failed');

    const result = rejectJoinRequest(pot, created.joinRequests, { joinRequestId: created.joinRequest.id, reviewerMemberId: admin.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.joinRequests[0].status).toBe('rejected');
  });

  it('fails on a request that is not pending', () => {
    const pot = makePot({}, [admin]);
    const alreadyRejected: JoinRequest = {
      id: 'jreq_1',
      potId: pot.id,
      userId: 'u1',
      requestedName: 'X',
      status: 'rejected',
      linkedMemberId: null,
      reviewedBy: admin.id,
      reviewedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const result = rejectJoinRequest(pot, [alreadyRejected], { joinRequestId: alreadyRejected.id, reviewerMemberId: admin.id });
    expect(result).toEqual({ ok: false, reason: 'request_not_pending' });
  });
});

describe('removeMember + rejoin', () => {
  const admin = makeMember({ id: 'mem_admin', role: 'admin' });

  it('keeps the financial identity and history intact, and allows re-linking on rejoin', () => {
    const removedMember = makeMember({ id: 'mem_rajkumar', name: 'Rajkumar', userId: 'user_old' });
    let pot = makePot({}, [admin, removedMember]);
    const txs: Transaction[] = [
      {
        id: 'tx_1',
        potId: pot.id,
        type: 'contribution',
        description: 'x',
        amount: 750,
        paidBy: removedMember.id,
        date: '2026-01-01',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: removedMember.id,
      },
    ];
    const balanceBeforeRemoval = calculateMemberBalances(pot.members, txs)[removedMember.id];

    const membersAfterRemoval = removeMember(pot, removedMember.id);
    pot = { ...pot, members: membersAfterRemoval };
    const removed = pot.members.find((m) => m.id === removedMember.id)!;
    expect(removed.status).toBe('inactive');
    expect(removed.userId).toBeNull();
    expect(calculateMemberBalances(pot.members, txs)[removedMember.id]).toBe(balanceBeforeRemoval);

    // The person rejoins with a (possibly new) account and is linked back to the same identity.
    const rejoinRequest = createJoinRequest(pot, [], makeUser('user_old_or_new', 'Rajkumar'), 'Rajkumar');
    if (!rejoinRequest.ok || rejoinRequest.status !== 'created') throw new Error('setup failed');

    const relinked = approveExistingMember(pot, rejoinRequest.joinRequests, {
      joinRequestId: rejoinRequest.joinRequest.id,
      memberId: removedMember.id,
      accessLevel: 'member',
      reviewerMemberId: admin.id,
    });
    expect(relinked.ok).toBe(true);
    if (!relinked.ok) return;

    const relinkedMember = relinked.members.find((m) => m.id === removedMember.id)!;
    expect(relinkedMember.status).toBe('active');
    expect(relinkedMember.userId).toBe('user_old_or_new');
    expect(calculateMemberBalances(relinked.members, txs)[removedMember.id]).toBe(balanceBeforeRemoval);
  });
});

describe('pot isolation', () => {
  it('never leaks members or join requests between similarly-named pots', () => {
    const adminA = makeMember({ id: 'mem_admin_a', role: 'admin' });
    const adminB = makeMember({ id: 'mem_admin_b', role: 'admin' });
    const potA = makePot({ id: 'pot_a', name: 'Goa 2026' }, [adminA]);
    const potB = makePot({ id: 'pot_b', name: 'Goa 2026 (Office)', inviteCode: 'goa-office-9z' }, [adminB]);

    const requestA = createJoinRequest(potA, [], makeUser('user_1', 'Same Name'), 'Same Name');
    const requestB = createJoinRequest(potB, [], makeUser('user_1', 'Same Name'), 'Same Name');

    expect(requestA.ok && requestA.status).toBe('created');
    expect(requestB.ok && requestB.status).toBe('created'); // same user, different pot — not a duplicate

    if (!requestA.ok || requestA.status !== 'created' || !requestB.ok || requestB.status !== 'created') return;
    expect(requestA.joinRequest.potId).toBe('pot_a');
    expect(requestB.joinRequest.potId).toBe('pot_b');

    // Approving in Pot A must not affect Pot B's join requests.
    const approved = approveNewMember(potA, requestA.joinRequests, {
      joinRequestId: requestA.joinRequest.id,
      displayName: 'Same Name',
      accessLevel: 'member',
      reviewerMemberId: adminA.id,
    });
    expect(approved.ok).toBe(true);
    expect(requestB.joinRequests[0].status).toBe('pending');
  });
});

describe('setInviteEnabled', () => {
  it('toggles independently per pot', () => {
    const admin = makeMember({ id: 'mem_admin', role: 'admin' });
    const pot = makePot({}, [admin]);
    const disabled = setInviteEnabled(pot, false);
    expect(disabled.inviteEnabled).toBe(false);
    expect(pot.inviteEnabled).toBe(true); // original untouched (pure function)
  });
});
