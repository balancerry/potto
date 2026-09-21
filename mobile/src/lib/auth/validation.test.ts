import {
  friendlyAuthError,
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
} from '@/lib/auth/validation';

describe('auth validation (parity with web)', () => {
  it('normalizes email', () => {
    expect(normalizeEmail('  Raj@Example.COM ')).toBe('raj@example.com');
  });

  it('validates display name', () => {
    expect(validateDisplayName('')).toBeTruthy();
    expect(validateDisplayName('R')).toBeTruthy();
    expect(validateDisplayName('Raj')).toBeNull();
  });

  it('validates email', () => {
    expect(validateEmail('')).toBeTruthy();
    expect(validateEmail('not-an-email')).toBeTruthy();
    expect(validateEmail('raj@example.com')).toBeNull();
  });

  it('validates password length', () => {
    expect(validatePassword('short')).toMatch(/at least/i);
    expect(validatePassword('longenough')).toBeNull();
  });

  it('validates password confirm', () => {
    expect(validatePasswordConfirm('password1', 'password2')).toMatch(/match/i);
    expect(validatePasswordConfirm('password1', 'password1')).toBeNull();
  });

  it('maps common auth errors', () => {
    expect(friendlyAuthError({ message: 'Invalid login credentials' })).toMatch(/incorrect/i);
    expect(friendlyAuthError({ message: 'Email not confirmed' })).toMatch(/verify/i);
    expect(friendlyAuthError({ message: 'User already registered' })).toMatch(/already registered/i);
  });
});
