/**
 * Avisos e comunicados internos.
 *
 * O público-alvo (empresa, departamento, grupo ou cargo) é resolvido na
 * LEITURA, com filtro no banco. Isso garante que um aviso restrito a um
 * departamento nunca chegue a quem não pertence a ele, mesmo que alguém
 * manipule a requisição.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, scoped, scopedId } from '@/lib/db/tenant';
import { auditFromContext } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/http/errors';
import { publish } from '@/lib/realtime/bus';
import { notify } from './notifications.service';
import type { AuthContext } from '@/lib/auth/context';
import type { AnnouncementAudience, AnnouncementSeverity } from '@/generated/prisma/enums';

export interface AnnouncementInput {
  title: string;
  body: string;
  severity?: AnnouncementSeverity;
  audience?: AnnouncementAudience;
  departmentId?: string | null;
  groupId?: string | null;
  roleId?: string | null;
  pinned?: boolean;
  expiresAt?: Date | null;
}

/** Avisos visíveis para o usuário atual, segmentação aplicada no banco. */
export async function listAnnouncements(ctx: AuthContext, options: { limit?: number } = {}) {
  assertPermission(ctx, 'announcements.view');

  const membership = await prisma.membership.findUnique({
    where: { id: ctx.membershipId },
    select: { departmentId: true, roleId: true, groupMemberships: { select: { groupId: true } } },
  });

  const groupIds = membership?.groupMemberships.map((g) => g.groupId) ?? [];
  const now = new Date();

  const announcements = await prisma.announcement.findMany({
    where: {
      ...scoped(ctx),
      publishedAt: { not: null, lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [
        {
          OR: [
            { audience: 'COMPANY' },
            ...(membership?.departmentId ? [{ audience: 'DEPARTMENT' as const, departmentId: membership.departmentId }] : []),
            ...(groupIds.length ? [{ audience: 'GROUP' as const, groupId: { in: groupIds } }] : []),
            ...(membership?.roleId ? [{ audience: 'ROLE' as const, roleId: membership.roleId }] : []),
          ],
        },
      ],
    },
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    take: options.limit ?? 50,
    select: {
      id: true, title: true, body: true, severity: true, audience: true, pinned: true,
      publishedAt: true, expiresAt: true,
      author: { select: { id: true, user: { select: { name: true, avatarUrl: true } }, role: { select: { name: true } } } },
      department: { select: { name: true } },
      group: { select: { name: true } },
      reads: { where: { membershipId: ctx.membershipId }, select: { id: true } },
    },
  });

  return announcements.map((announcement) => ({
    ...announcement,
    isRead: announcement.reads.length > 0,
    reads: undefined,
  }));
}

export async function publishAnnouncement(ctx: AuthContext, input: AnnouncementInput) {
  assertPermission(ctx, 'announcements.publish');

  const audience = input.audience ?? 'COMPANY';

  // Segmentação precisa apontar para um destino real do próprio tenant.
  if (audience === 'DEPARTMENT' && !input.departmentId) throw new ValidationError('Selecione o departamento.');
  if (audience === 'GROUP' && !input.groupId) throw new ValidationError('Selecione o grupo.');
  if (audience === 'ROLE' && !input.roleId) throw new ValidationError('Selecione o cargo.');

  if (input.departmentId) {
    const exists = await prisma.department.findFirst({ where: scopedId(ctx, input.departmentId), select: { id: true } });
    if (!exists) throw new NotFoundError('Departamento não encontrado.');
  }
  if (input.groupId) {
    const exists = await prisma.group.findFirst({ where: scopedId(ctx, input.groupId), select: { id: true } });
    if (!exists) throw new NotFoundError('Grupo não encontrado.');
  }
  if (input.roleId) {
    const exists = await prisma.role.findFirst({ where: scopedId(ctx, input.roleId), select: { id: true } });
    if (!exists) throw new NotFoundError('Cargo não encontrado.');
  }

  const announcement = await prisma.announcement.create({
    data: {
      companyId: ctx.companyId,
      authorId: ctx.membershipId,
      title: input.title,
      body: input.body,
      severity: input.severity ?? 'INFO',
      audience,
      departmentId: input.departmentId ?? null,
      groupId: input.groupId ?? null,
      roleId: input.roleId ?? null,
      pinned: input.pinned ?? false,
      expiresAt: input.expiresAt ?? null,
      publishedAt: new Date(),
    },
  });

  const recipients = await resolveAudience(ctx, audience, input);

  await notify({
    companyId: ctx.companyId,
    recipientIds: recipients,
    actorId: ctx.membershipId,
    kind: 'ANNOUNCEMENT',
    title: input.title,
    body: input.body.slice(0, 160),
    href: '/avisos',
    entityType: 'announcement',
    entityId: announcement.id,
  });

  publish('announcement.published', ctx.companyId, {
    id: announcement.id,
    title: announcement.title,
    severity: announcement.severity,
  });

  await auditFromContext(ctx, {
    action: 'announcement.published',
    entityType: 'announcement',
    entityId: announcement.id,
    metadata: { audience, recipients: recipients.length },
  });

  return announcement;
}

async function resolveAudience(
  ctx: AuthContext,
  audience: AnnouncementAudience,
  input: AnnouncementInput,
): Promise<string[]> {
  if (audience === 'GROUP' && input.groupId) {
    const members = await prisma.groupMember.findMany({ where: { groupId: input.groupId }, select: { membershipId: true } });
    return members.map((m) => m.membershipId);
  }

  const members = await prisma.membership.findMany({
    where: {
      companyId: ctx.companyId,
      status: 'ACTIVE',
      ...(audience === 'DEPARTMENT' && input.departmentId ? { departmentId: input.departmentId } : {}),
      ...(audience === 'ROLE' && input.roleId ? { roleId: input.roleId } : {}),
    },
    select: { id: true },
  });

  return members.map((m) => m.id);
}

export async function markAnnouncementRead(ctx: AuthContext, announcementId: string): Promise<void> {
  const announcement = await prisma.announcement.findFirst({ where: scopedId(ctx, announcementId), select: { id: true } });
  if (!announcement) throw new NotFoundError('Aviso não encontrado.');

  await prisma.announcementRead.upsert({
    where: { announcementId_membershipId: { announcementId, membershipId: ctx.membershipId } },
    create: { announcementId, membershipId: ctx.membershipId },
    update: {},
  });
}

export async function deleteAnnouncement(ctx: AuthContext, announcementId: string): Promise<void> {
  assertPermission(ctx, 'announcements.publish');

  const announcement = await prisma.announcement.findFirst({ where: scopedId(ctx, announcementId), select: { id: true } });
  if (!announcement) throw new NotFoundError('Aviso não encontrado.');

  await prisma.announcement.delete({ where: { id: announcementId } });
}
