import { buildSeed } from '@/store/seed';

// A hand-picked seed join code that isn't actually generateJoinCode() output
// (see src/logic/invites.ts) can drift from the generator's own alphabet —
// exactly what happened with an earlier 'X91P4A' typo containing a '1'.
// This guards every current and future seeded Pot against that class of bug.
const JOIN_CODE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

describe('buildSeed', () => {
  const seed = buildSeed();
  const pots = Object.values(seed.pots);

  it('gives every pot a join code matching the generator alphabet/length', () => {
    pots.forEach((pot) => {
      expect(pot.joinCode).toMatch(JOIN_CODE_PATTERN);
    });
  });

  it('keeps join codes unique across pots and distinct from invite codes', () => {
    const joinCodes = pots.map((p) => p.joinCode);
    expect(new Set(joinCodes).size).toBe(joinCodes.length);
    pots.forEach((pot) => {
      expect(pot.joinCode.toLowerCase()).not.toBe(pot.inviteCode.toLowerCase());
    });
  });

  it('enables both channels by default on every seeded pot', () => {
    pots.forEach((pot) => {
      expect(pot.inviteEnabled).toBe(true);
      expect(pot.joinEnabled).toBe(true);
    });
  });
});
