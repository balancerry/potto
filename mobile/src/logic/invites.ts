/**
 * Invite code generation. Pure, DOM/UI-free — mirrors accounting.ts.
 *
 * The invite code identifies the Pot only. It must never encode user id,
 * member id, role, permissions, or financial data (spec section 2).
 */

const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'; // no 0/1/o/l/i to avoid ambiguity when read aloud

function randomSegment(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * Generates a unique, random, non-sequential invite code, retrying on collision
 * against the set of codes already in use across all pots.
 */
export function generateInviteCode(existingCodes: Set<string>, attempts = 20): string {
  for (let i = 0; i < attempts; i += 1) {
    const code = randomSegment(8);
    if (!existingCodes.has(code)) return code;
  }
  // Astronomically unlikely with 8 chars from a 32-char alphabet, but never loop forever.
  return `${randomSegment(8)}${randomSegment(4)}`;
}

export function buildInviteLink(inviteCode: string): string {
  return `https://potto.app/invite/${inviteCode}`;
}

/**
 * NEW — zero-cost Join Code (manual entry / QR), a separate concept from the
 * invite-link's inviteCode above. Short, typeable, uppercase, and avoids
 * characters that are easy to confuse (0/O, 1/I/L). Like inviteCode, it
 * identifies the Pot only — never a user, member, role, or balance.
 */
const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const JOIN_CODE_LENGTH = 6;

function randomSegmentFrom(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Generates a unique, random 6-character Join Code, retrying on collision. */
export function generateJoinCode(existingCodes: Set<string>, attempts = 20): string {
  for (let i = 0; i < attempts; i += 1) {
    const code = randomSegmentFrom(JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH);
    if (!existingCodes.has(code)) return code;
  }
  // Astronomically unlikely with 6 chars from a 30-char alphabet, but never loop forever.
  return `${randomSegmentFrom(JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH)}${randomSegmentFrom(JOIN_CODE_ALPHABET, 2)}`;
}

/** Uppercases and strips anything that isn't a Join Code character, for live input handling. */
export function normalizeJoinCodeInput(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((ch) => JOIN_CODE_ALPHABET.includes(ch))
    .join('')
    .slice(0, JOIN_CODE_LENGTH);
}

const JOIN_QR_PREFIX = 'POTTO_JOIN';
const JOIN_QR_VERSION = 1;

/**
 * Versioned QR payload for a Join Code, e.g. "POTTO_JOIN:1:7K2M9P". Carries no
 * URL, user id, member id, role, or financial data — only the Pot-identifying
 * code. The version segment lets a future format change without breaking
 * older QR codes still in the wild.
 */
export function buildJoinCodePayload(joinCode: string): string {
  return `${JOIN_QR_PREFIX}:${JOIN_QR_VERSION}:${joinCode}`;
}

export interface ParsedJoinCodePayload {
  version: number;
  code: string;
}

/** Parses a scanned QR payload back into a Join Code, or null if it isn't a recognized Potto QR. */
export function parseJoinCodePayload(payload: string): ParsedJoinCodePayload | null {
  const parts = payload.trim().split(':');
  if (parts.length !== 3 || parts[0] !== JOIN_QR_PREFIX) return null;
  const version = Number.parseInt(parts[1], 10);
  if (!Number.isInteger(version) || version < 1) return null;
  const code = normalizeJoinCodeInput(parts[2]);
  if (code.length !== JOIN_CODE_LENGTH) return null;
  return { version, code };
}
