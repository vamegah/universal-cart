import crypto from 'crypto';

const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });

  return `scrypt:${salt}:${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, hash] = storedHash.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });

  const stored = Buffer.from(hash, 'base64url');
  return stored.length === key.length && crypto.timingSafeEqual(stored, key);
}
