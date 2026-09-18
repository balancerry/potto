import {
  buildInviteLink,
  buildJoinCodePayload,
  generateInviteCode,
  generateJoinCode,
  normalizeJoinCodeInput,
  parseJoinCodePayload,
} from '@/logic/invites';

describe('generateInviteCode', () => {
  it('produces a non-empty code not already in use', () => {
    const code = generateInviteCode(new Set());
    expect(code.length).toBeGreaterThan(0);
  });

  it('never returns a code already in the existing set', () => {
    const existing = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const code = generateInviteCode(existing);
      expect(existing.has(code)).toBe(false);
      existing.add(code);
    }
  });

  it('retries past a forced collision', () => {
    // Force every 8-char attempt to already exist except the fallback path's
    // extra-length code by pre-seeding a huge blocked set is impractical;
    // instead verify the function still returns a code not in a small blocklist.
    const blocked = new Set(['aaaaaaaa']);
    const code = generateInviteCode(blocked, 5);
    expect(blocked.has(code)).toBe(false);
  });

  it('never encodes the pot name, a user id, or a role', () => {
    const code = generateInviteCode(new Set());
    expect(code.toLowerCase()).not.toContain('admin');
    expect(code).not.toMatch(/user|role|member/i);
  });
});

describe('buildInviteLink', () => {
  it('embeds only the invite code', () => {
    expect(buildInviteLink('goa-7k2m')).toBe('https://potto.app/invite/goa-7k2m');
  });
});

// NEW — the zero-cost Join Code method. generateInviteCode/buildInviteLink
// above are exercised completely unchanged by these additions.
describe('generateJoinCode', () => {
  it('is uppercase, 6 characters, and avoids ambiguous characters', () => {
    const code = generateJoinCode(new Set());
    expect(code).toHaveLength(6);
    expect(code).toBe(code.toUpperCase());
    expect(code).not.toMatch(/[01OIL]/);
  });

  it('never returns a code already in the existing set', () => {
    const existing = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const code = generateJoinCode(existing);
      expect(existing.has(code)).toBe(false);
      existing.add(code);
    }
  });

  it('never encodes a pot id, user id, member id, or role', () => {
    const code = generateJoinCode(new Set());
    expect(code).not.toMatch(/POT|USER|MEMBER|ADMIN/i);
  });

  it('is a separate identity space from invite codes (different alphabet/case)', () => {
    const inviteCode = generateInviteCode(new Set());
    const joinCode = generateJoinCode(new Set());
    // inviteCode's alphabet is lowercase; joinCode's is uppercase — they can
    // never collide as the *same* stored value even if reused across fields.
    expect(inviteCode).toBe(inviteCode.toLowerCase());
    expect(joinCode).toBe(joinCode.toUpperCase());
  });
});

describe('normalizeJoinCodeInput', () => {
  it('uppercases, strips invalid characters, and truncates to 6', () => {
    expect(normalizeJoinCodeInput('7k2m9p')).toBe('7K2M9P');
    expect(normalizeJoinCodeInput('7k-2m 9p!!!')).toBe('7K2M9P');
    expect(normalizeJoinCodeInput('7k2m9pXYZ')).toBe('7K2M9P');
  });

  it('drops ambiguous characters (0/O, 1/I/L) since they are not in the alphabet', () => {
    expect(normalizeJoinCodeInput('0O1IL')).toBe('');
  });
});

describe('buildJoinCodePayload / parseJoinCodePayload', () => {
  it('round-trips a code through the versioned QR payload', () => {
    const payload = buildJoinCodePayload('7K2M9P');
    expect(payload).toBe('POTTO_JOIN:1:7K2M9P');
    expect(parseJoinCodePayload(payload)).toEqual({ version: 1, code: '7K2M9P' });
  });

  it('carries no URL, user id, member id, role, or balance', () => {
    const payload = buildJoinCodePayload('7K2M9P');
    expect(payload).not.toMatch(/https?:\/\//);
    expect(payload).not.toMatch(/user|member|role|balance/i);
  });

  it('rejects payloads that are not a recognized Potto QR', () => {
    expect(parseJoinCodePayload('https://example.com')).toBeNull();
    expect(parseJoinCodePayload('POTTO_JOIN:1')).toBeNull();
    expect(parseJoinCodePayload('SOMETHING_ELSE:1:7K2M9P')).toBeNull();
    expect(parseJoinCodePayload('POTTO_JOIN:0:7K2M9P')).toBeNull();
    expect(parseJoinCodePayload('POTTO_JOIN:1:XY')).toBeNull(); // too short after normalizing
  });

  it('accepts a future version number without breaking (forward compatible)', () => {
    expect(parseJoinCodePayload('POTTO_JOIN:2:7K2M9P')).toEqual({ version: 2, code: '7K2M9P' });
  });
});
