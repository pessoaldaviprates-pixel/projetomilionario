/**
 * Tokens opacos de uso único (verificação de e-mail, reset de senha, convites).
 *
 * O token em claro só existe no e-mail do destinatário. O banco guarda apenas
 * o SHA-256 — um dump do banco não permite forjar um link válido.
 */
import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparação em tempo constante, evitando ataque de timing. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const TOKEN_TTL = {
  emailVerification: 1000 * 60 * 60 * 24, // 24h
  passwordReset: 1000 * 60 * 60, // 1h
  invitation: 1000 * 60 * 60 * 24 * 7, // 7 dias
  twoFactor: 1000 * 60 * 10, // 10 min
} as const;

export function expiresIn(ms: number): Date {
  return new Date(Date.now() + ms);
}
