/**
 * Trilha de auditoria.
 *
 * Append-only: nada aqui é atualizado ou apagado pela aplicação. Falha ao
 * gravar auditoria NUNCA derruba a operação de negócio — registramos o
 * problema e seguimos, porque perder a ação do usuário é pior que perder a
 * linha de log.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import type { AuthContext } from '@/lib/auth/context';

export type AuditAction =
  | 'auth.login' | 'auth.login_failed' | 'auth.logout' | 'auth.register'
  | 'auth.password_reset_requested' | 'auth.password_changed' | 'auth.email_verified'
  | 'company.created' | 'company.updated' | 'company.onboarded'
  | 'member.invited' | 'member.joined' | 'member.updated' | 'member.deactivated' | 'member.role_changed'
  | 'role.created' | 'role.updated' | 'role.deleted' | 'role.permissions_changed'
  | 'department.created' | 'department.updated' | 'department.deleted'
  | 'project.created' | 'project.updated' | 'project.deleted'
  | 'task.created' | 'task.updated' | 'task.deleted' | 'task.completed'
  | 'meeting.created' | 'meeting.updated' | 'meeting.canceled'
  | 'file.uploaded' | 'file.downloaded' | 'file.deleted'
  | 'announcement.published'
  | 'billing.subscription_created' | 'billing.plan_changed' | 'billing.canceled' | 'billing.payment'
  | 'ai.action_accepted' | 'ai.action_dismissed'
  | 'integration.connected' | 'integration.disconnected';

export interface AuditInput {
  action: AuditAction;
  companyId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  entityType?: string;
  entityId?: string;
  changes?: Record<string, [unknown, unknown]>;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        companyId: input.companyId ?? null,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        changes: (input.changes ?? undefined) as never,
        metadata: (input.metadata ?? undefined) as never,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        severity: input.severity ?? 'INFO',
      },
    });
  } catch (error) {
    console.error('[audit] falha ao registrar', input.action, error);
  }
}

/** Atalho para ações dentro de um tenant, com ator já resolvido. */
export function auditFromContext(
  ctx: AuthContext,
  input: Omit<AuditInput, 'companyId' | 'actorId' | 'actorEmail'>,
): Promise<void> {
  return recordAudit({
    ...input,
    companyId: ctx.companyId,
    actorId: ctx.membershipId,
    actorEmail: ctx.user.email,
  });
}

/** Calcula o diff entre dois objetos, guardando apenas o que mudou. */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue;
    const previous = before[key];
    const changed =
      previous instanceof Date && value instanceof Date
        ? previous.getTime() !== value.getTime()
        : JSON.stringify(previous) !== JSON.stringify(value);
    if (changed) changes[key] = [previous ?? null, value ?? null];
  }
  return changes;
}
