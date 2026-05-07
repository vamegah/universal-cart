import crypto from 'crypto';

const RAW_CARD_PATTERN = /\b(?:\d[ -]*?){12,19}\b/;
const CVV_PATTERN = /^\d{3,4}$/;
const TOKEN_PATTERN = /^(tok|pm|card|src|vc|mock-token|provider-token)[_\-:][A-Za-z0-9_\-:.]{4,}$/;
const ENCRYPTED_PREFIX = 'enc:v1:';

function encryptionKey() {
  const configured = process.env.CARD_TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET || '';
  if (process.env.NODE_ENV === 'production' && !process.env.CARD_TOKEN_ENCRYPTION_KEY) {
    throw new Error('CARD_TOKEN_ENCRYPTION_KEY is required in production');
  }
  return crypto.createHash('sha256').update(configured || 'dev-card-token-encryption-key').digest();
}

export function assertTokenizedCardReference(cardToken: unknown) {
  if (typeof cardToken !== 'string') {
    throw new Error('cardToken must be a tokenized payment provider reference');
  }

  const token = cardToken.trim();
  if (token.length < 8 || CVV_PATTERN.test(token) || RAW_CARD_PATTERN.test(token) || !TOKEN_PATTERN.test(token)) {
    throw new Error('cardToken must be a tokenized payment provider reference');
  }

  return token;
}

export function encryptCardToken(cardToken: string) {
  if (cardToken.startsWith(ENCRYPTED_PREFIX)) return cardToken;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(cardToken, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptCardToken(encryptedToken: string) {
  if (!encryptedToken.startsWith(ENCRYPTED_PREFIX)) return encryptedToken;
  const [ivPart, tagPart, ciphertextPart] = encryptedToken.slice(ENCRYPTED_PREFIX.length).split('.');
  if (!ivPart || !tagPart || !ciphertextPart) throw new Error('Invalid encrypted card token');

  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64url')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export function requireCardVaultConsent(value: unknown) {
  if (value !== true) {
    throw new Error('Card vault consent is required before saving a tokenized card reference');
  }
}
