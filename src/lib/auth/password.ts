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

/** Requisitos mínimos de senha. Espelhados no schema zod do formulário. */
export const PASSWORD_MIN_LENGTH = 8;

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

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  issues: string[];
}

/** Avaliação simples e determinística — usada para feedback na UI. */
export function assessPassword(password: string): PasswordStrength {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push(`Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres`);
  if (!/[a-z]/.test(password)) issues.push('Inclua uma letra minúscula');
  if (!/[A-Z]/.test(password)) issues.push('Inclua uma letra maiúscula');
  if (!/[0-9]/.test(password)) issues.push('Inclua um número');

  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) score++;

  const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Excelente'];
  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  return { score: clamped, label: labels[clamped], issues };
}
