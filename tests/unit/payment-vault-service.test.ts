import { describe, expect, it } from '@jest/globals';
import {
  assertTokenizedCardReference,
  decryptCardToken,
  encryptCardToken,
  requireCardVaultConsent,
} from '../../apps/api/src/services/paymentVaultService';

describe('paymentVaultService', () => {
  it('accepts provider token references and rejects raw card data', () => {
    expect(assertTokenizedCardReference('tok_live_abc12345')).toBe('tok_live_abc12345');
    expect(() => assertTokenizedCardReference('4111 1111 1111 1111')).toThrow('tokenized');
    expect(() => assertTokenizedCardReference('123')).toThrow('tokenized');
    expect(() => assertTokenizedCardReference('plain-reference')).toThrow('tokenized');
  });

  it('encrypts token references at rest and can decrypt them internally', () => {
    const token = 'pm_test_abc12345';
    const encrypted = encryptCardToken(token);

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain(token);
    expect(decryptCardToken(encrypted)).toBe(token);
  });

  it('requires explicit card vault consent', () => {
    expect(() => requireCardVaultConsent(false)).toThrow('consent');
    expect(() => requireCardVaultConsent(undefined)).toThrow('consent');
    expect(() => requireCardVaultConsent(true)).not.toThrow();
  });
});
