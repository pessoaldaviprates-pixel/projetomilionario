/**
 * Notificações.
 *
 * Toda notificação nasce de um evento de negócio e é entregue em duas vias:
 *  1. persistida (central de notificações, sobrevive a recarregamentos);
 *  2. publicada no barramento de tempo real (badge atualiza sem refresh).
 *
 * Nunca notificamos o próprio autor da ação — ruído sem valor.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { publish } from '@/lib/realtime/bus';
import type { AuthContext } from '@/lib/auth/context';
import type { NotificationKind } from '@/generated/prisma/enums';
import { buildPage, cursorArgs, type Page } from '@/lib/http/pagination';

export interface NotifyInput {
  companyId: string;
  /** Destinatários (membershipId). Duplicatas são removidas. */
  recipientIds: string[];
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  /** Autor da ação — não recebe a própria notificação. */
  actorId?: string | null;
}

export async function notify(input: NotifyInput): Promise<void> {
  const recipients = Array.from(new Set(input.recipientIds)).filter(
    (id) => id && id !== input.actorId,
  );
  if (recipients.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: recipients.map((membershipId) => ({
        companyId: input.companyId,
        membershipId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        actorId: input.actorId ?? null,
      })),
    });

    for (const membershipId of recipients) {
      publish('notification.created', input.companyId, {
        membershipId,
        kind: input.kind,
        title: input.title,
        href: input.href ?? null,
      }, membershipId);
    }
  } catch (error) {
    // Notificação nunca derruba a operação principal.
    console.error('[notifications] falha ao notificar:', error);
  }
}

export async function listNotifications(
  ctx: AuthContext,
  options: { cursor?: string; limit?: number; onlyUnread?: boolean; kind?: NotificationKind } = {},
): Promise<Page<{ id: string; kind: NotificationKind; title: string; body: string | null; href: string | null; readAt: Date | null; createdAt: Date }>> {
  const limit = options.limit ?? 25;

  const rows = await prisma.notification.findMany({
    where: {
      companyId: ctx.companyId,
      membershipId: ctx.membershipId,
      ...(options.onlyUnread ? { readAt: null } : {}),
      ...(options.kind ? { kind: options.kind } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...cursorArgs(options.cursor),
    select: { id: true, kind: true, title: true, body: true, href: true, readAt: true, createdAt: true },
  });

  return buildPage(rows, limit);
}

export async function countUnread(ctx: AuthContext): Promise<number> {
  return prisma.notification.count({
    where: { companyId: ctx.companyId, membershipId: ctx.membershipId, readAt: null },
  });
}

export async function markAsRead(ctx: AuthContext, notificationId: string): Promise<void> {
  // updateMany com filtro de tenant: impossível marcar notificação de outro.
  await prisma.notification.updateMany({
    where: { id: notificationId, companyId: ctx.companyId, membershipId: ctx.membershipId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllAsRead(ctx: AuthContext): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { companyId: ctx.companyId, membershipId: ctx.membershipId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
