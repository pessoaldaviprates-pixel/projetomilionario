/**
 * Hash de senha.
 *
 * bcrypt com custo 12 — resistente a GPU e sem dependência nativa (evita
 * quebra de build em ambientes de CI/containers distintos). O custo é
 * configurável para permitir aumento conforme o hardware evolui.
 */
import 'server-only';
import bcrypt from 'bcryptjs';

const COST = 12;

export { PASSWORD_MIN_LENGTH, assessPassword, type PasswordStrength } from './password-policy';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) {
    // Usuário sem senha (login social). Ainda assim gastamos tempo comparável
    // para não vazar, por timing, quais contas existem sem senha.
    await bcrypt.compare(plain, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    return false;
  }
  return bcrypt.compare(plain, hash);
}
