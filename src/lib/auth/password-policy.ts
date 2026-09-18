/**
 * Política de senha — isomórfica.
 *
 * Este módulo é propositalmente livre de dependências de servidor: o mesmo
 * critério precisa valer no formulário (feedback imediato) e na validação do
 * servidor (decisão final). O HASH fica em `password.ts`, que é server-only.
 */

export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  issues: string[];
}

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
  return { score: clamped, label: labels[clamped]!, issues };
}
