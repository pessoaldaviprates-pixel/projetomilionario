/**
 * Utilitários de escopo por tenant.
 *
 * A regra do projeto: nenhum service constrói um `where` de entidade de negócio
 * manualmente. Ele começa por `scoped(ctx)` — assim é impossível esquecer o
 * filtro de empresa e vazar dados entre tenants.
 */
import 'server-only';
import type { AuthContext } from '@/lib/auth/context';
import { ForbiddenError, NotFoundError } from '@/lib/http/errors';
import type { Permission } from '@/lib/authz/permissions';

/** Base de todo `where`: o filtro de empresa. */
export function scoped(ctx: AuthContext): { companyId: string } {
  return { companyId: ctx.companyId };
}

/** `where` de registro único garantindo que ele pertence ao tenant atual. */
export function scopedId(ctx: AuthContext, id: string): { id: string; companyId: string } {
  return { id, companyId: ctx.companyId };
}

/**
 * Confirma que um registro carregado pertence ao tenant.
 * Rede de segurança para queries que, por algum motivo, buscaram por id puro.
 */
export function assertTenant<T extends { companyId: string } | null>(
  ctx: AuthContext,
  record: T,
  entity = 'Registro',
): NonNullable<T> {
  if (!record) throw new NotFoundError(`${entity} não encontrado.`);
  if (record.companyId !== ctx.companyId) {
    // Responde 404, e não 403: confirmar existência de recurso de outro tenant
    // já é, por si só, vazamento de informação.
    throw new NotFoundError(`${entity} não encontrado.`);
  }
  return record as NonNullable<T>;
}

/** Autorização imperativa para uso dentro dos services. */
export function assertPermission(ctx: AuthContext, permission: Permission): void {
  if (!ctx.can(permission)) {
    throw new ForbiddenError('Você não tem permissão para executar esta ação.');
  }
}

/**
 * Permite a ação se o usuário tem a permissão OU é o dono do recurso.
 * Ex.: qualquer pessoa edita a própria tarefa; editar a de outro exige permissão.
 */
export function assertPermissionOrOwner(
  ctx: AuthContext,
  permission: Permission,
  ownerMembershipId: string | null | undefined,
): void {
  if (ownerMembershipId && ownerMembershipId === ctx.membershipId) return;
  assertPermission(ctx, permission);
}
