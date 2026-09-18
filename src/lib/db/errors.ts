import 'server-only';

/** Códigos de erro do Prisma que sabemos traduzir para mensagens de usuário. */
const PRISMA_ERROR_MESSAGES: Record<string, string> = {
  P2002: 'Já existe um registro com esses dados.',
  P2003: 'Operação bloqueada: existem registros relacionados.',
  P2025: 'Registro não encontrado.',
};

export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002';
}

export function translatePrismaError(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = (error as { code: string }).code;
  return PRISMA_ERROR_MESSAGES[code] ?? null;
}
