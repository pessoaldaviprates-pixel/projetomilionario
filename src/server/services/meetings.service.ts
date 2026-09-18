/**
 * Reuniões.
 *
 * O ciclo completo do diferencial do produto vive aqui:
 *   reunião → transcrição → resumo → decisões → itens de ação → tarefas.
 *
 * A IA produz SUGESTÕES (MeetingActionItem com status SUGGESTED). Só quando
 * uma pessoa aceita é que a tarefa é criada de fato.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, assertPermissionOrOwner, scoped, scopedId } from '@/lib/db/tenant';
import { auditFromContext } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/http/errors';
import { aiProvider } from '@/lib/ai/provider';
import { requireEntitlement } from '@/lib/billing/subscription';
import { notify } from './notifications.service';
import { createTask } from './tasks.service';
import type { AuthContext } from '@/lib/auth/context';
import type { MeetingProvider } from '@/generated/prisma/enums';

export interface MeetingInput {
  title: string;
  description?: string;
  agenda?: string;
  startsAt: Date;
  endsAt: Date;
  location?: string;
  roomUrl?: string;
  provider?: MeetingProvider;
  projectId?: string | null;
  participantIds?: string[];
  recurrenceRule?: string | null;
}

export async function listMeetings(
  ctx: AuthContext,
  options: { from?: Date; to?: Date; projectId?: string; onlyMine?: boolean } = {},
) {
  assertPermission(ctx, 'meetings.view');

  return prisma.meeting.findMany({
    where: {
      ...scoped(ctx),
      ...(options.projectId ? { projectId: options.projectId } : {}),
      ...(options.from || options.to
        ? { startsAt: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
        : {}),
      ...(options.onlyMine
        ? { OR: [{ organizerId: ctx.membershipId }, { participants: { some: { membershipId: ctx.membershipId } } }] }
        : {}),
    },
    orderBy: { startsAt: 'asc' },
    take: 200,
    select: {
      id: true, title: true, description: true, startsAt: true, endsAt: true, status: true,
      location: true, roomUrl: true, provider: true, recurrenceRule: true,
      organizer: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
      project: { select: { id: true, name: true, color: true } },
      participants: {
        take: 8,
        select: {
          response: true,
          membership: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
        },
      },
      _count: { select: { participants: true, actionItems: true, notes: true } },
    },
  });
}

export async function getMeeting(ctx: AuthContext, meetingId: string) {
  assertPermission(ctx, 'meetings.view');

  const meeting = await prisma.meeting.findFirst({
    where: scopedId(ctx, meetingId),
    include: {
      organizer: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
      project: { select: { id: true, name: true, color: true } },
      participants: {
        select: {
          response: true, joinedAt: true,
          membership: {
            select: {
              id: true,
              user: { select: { name: true, avatarUrl: true, email: true } },
              role: { select: { name: true, color: true } },
            },
          },
        },
      },
      notes: { orderBy: { createdAt: 'desc' } },
      actionItems: {
        orderBy: { createdAt: 'asc' },
        include: { task: { select: { id: true, title: true, status: true } } },
      },
      recordings: true,
      files: { where: { deletedAt: null }, select: { id: true, name: true, sizeBytes: true, mimeType: true, category: true } },
    },
  });

  if (!meeting) throw new NotFoundError('Reunião não encontrada.');
  return meeting;
}

export async function createMeeting(ctx: AuthContext, input: MeetingInput) {
  assertPermission(ctx, 'meetings.create');

  if (input.endsAt <= input.startsAt) {
    throw new ValidationError('O término deve ser depois do início.');
  }

  if (input.projectId) {
    const project = await prisma.project.findFirst({ where: scopedId(ctx, input.projectId), select: { id: true } });
    if (!project) throw new NotFoundError('Projeto não encontrado.');
  }

  const participantIds = await validParticipants(ctx, [ctx.membershipId, ...(input.participantIds ?? [])]);

  const meeting = await prisma.$transaction(async (tx) => {
    const created = await tx.meeting.create({
      data: {
        companyId: ctx.companyId,
        title: input.title,
        description: input.description || null,
        agenda: input.agenda || null,
        organizerId: ctx.membershipId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        location: input.location || null,
        roomUrl: input.roomUrl || null,
        provider: input.provider ?? 'NEXORA',
        projectId: input.projectId ?? null,
        recurrenceRule: input.recurrenceRule ?? null,
      },
    });

    await tx.meetingParticipant.createMany({
      data: participantIds.map((membershipId) => ({
        meetingId: created.id,
        membershipId,
        response: membershipId === ctx.membershipId ? 'ACCEPTED' : 'PENDING',
      })),
      skipDuplicates: true,
    });

    // A reunião aparece na agenda de cada participante — módulos conectados.
    await tx.calendarEvent.createMany({
      data: participantIds.map((membershipId) => ({
        companyId: ctx.companyId,
        ownerId: membershipId,
        title: created.title,
        description: created.description,
        kind: 'MEETING' as const,
        startsAt: created.startsAt,
        endsAt: created.endsAt,
        location: created.location,
        meetingId: created.id,
        projectId: created.projectId,
      })),
    });

    return created;
  });

  await auditFromContext(ctx, {
    action: 'meeting.created',
    entityType: 'meeting',
    entityId: meeting.id,
    metadata: { title: meeting.title, participants: participantIds.length },
  });

  await notify({
    companyId: ctx.companyId,
    recipientIds: participantIds,
    actorId: ctx.membershipId,
    kind: 'MEETING_INVITE',
    title: 'Convite para reunião',
    body: `${meeting.title} — ${meeting.startsAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`,
    href: `/reunioes/${meeting.id}`,
    entityType: 'meeting',
    entityId: meeting.id,
  });

  return meeting;
}

async function validParticipants(ctx: AuthContext, ids: string[]): Promise<string[]> {
  const unique = Array.from(new Set(ids));
  const members = await prisma.membership.findMany({
    where: { id: { in: unique }, companyId: ctx.companyId, status: 'ACTIVE' },
    select: { id: true },
  });
  return members.map((m) => m.id);
}

export async function updateMeeting(ctx: AuthContext, meetingId: string, input: Partial<MeetingInput>) {
  const meeting = await prisma.meeting.findFirst({ where: scopedId(ctx, meetingId), select: { id: true, organizerId: true } });
  if (!meeting) throw new NotFoundError('Reunião não encontrada.');

  assertPermissionOrOwner(ctx, 'meetings.manage', meeting.organizerId);

  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.agenda !== undefined ? { agenda: input.agenda || null } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
      ...(input.location !== undefined ? { location: input.location || null } : {}),
      ...(input.roomUrl !== undefined ? { roomUrl: input.roomUrl || null } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    },
  });

  // Reagenda o evento na agenda de todos os participantes.
  if (input.startsAt || input.endsAt || input.title) {
    await prisma.calendarEvent.updateMany({
      where: { companyId: ctx.companyId, meetingId },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.startsAt ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt ? { endsAt: input.endsAt } : {}),
      },
    });

    const participants = await prisma.meetingParticipant.findMany({ where: { meetingId }, select: { membershipId: true } });
    await notify({
      companyId: ctx.companyId,
      recipientIds: participants.map((p) => p.membershipId),
      actorId: ctx.membershipId,
      kind: 'MEETING_REMINDER',
      title: 'Reunião atualizada',
      body: updated.title,
      href: `/reunioes/${meetingId}`,
      entityType: 'meeting',
      entityId: meetingId,
    });
  }

  await auditFromContext(ctx, { action: 'meeting.updated', entityType: 'meeting', entityId: meetingId });
  return updated;
}

export async function cancelMeeting(ctx: AuthContext, meetingId: string): Promise<void> {
  const meeting = await prisma.meeting.findFirst({ where: scopedId(ctx, meetingId), select: { id: true, organizerId: true, title: true } });
  if (!meeting) throw new NotFoundError('Reunião não encontrada.');

  assertPermissionOrOwner(ctx, 'meetings.manage', meeting.organizerId);

  await prisma.$transaction([
    prisma.meeting.update({ where: { id: meetingId }, data: { status: 'CANCELED' } }),
    prisma.calendarEvent.deleteMany({ where: { companyId: ctx.companyId, meetingId } }),
  ]);

  const participants = await prisma.meetingParticipant.findMany({ where: { meetingId }, select: { membershipId: true } });
  await notify({
    companyId: ctx.companyId,
    recipientIds: participants.map((p) => p.membershipId),
    actorId: ctx.membershipId,
    kind: 'MEETING_REMINDER',
    title: 'Reunião cancelada',
    body: meeting.title,
    href: `/reunioes/${meetingId}`,
  });

  await auditFromContext(ctx, { action: 'meeting.canceled', entityType: 'meeting', entityId: meetingId, severity: 'WARNING' });
}

export async function respondToMeeting(
  ctx: AuthContext,
  meetingId: string,
  response: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE',
): Promise<void> {
  const participant = await prisma.meetingParticipant.findFirst({
    where: { meetingId, membershipId: ctx.membershipId, meeting: { companyId: ctx.companyId } },
    select: { id: true },
  });
  if (!participant) throw new NotFoundError('Você não foi convidado para esta reunião.');

  await prisma.meetingParticipant.update({ where: { id: participant.id }, data: { response } });
}

/**
 * Processa a transcrição: gera resumo, decisões e itens de ação.
 * Os itens ficam como SUGESTÃO — nenhuma tarefa é criada automaticamente.
 */
export async function processTranscript(ctx: AuthContext, meetingId: string, transcript: string) {
  await requireEntitlement(ctx.companyId, 'ai.meeting_summary');

  const meeting = await prisma.meeting.findFirst({
    where: scopedId(ctx, meetingId),
    select: {
      id: true, title: true, organizerId: true,
      participants: {
        select: { membership: { select: { id: true, user: { select: { name: true } } } } },
      },
    },
  });
  if (!meeting) throw new NotFoundError('Reunião não encontrada.');

  assertPermissionOrOwner(ctx, 'meetings.manage', meeting.organizerId);

  const people = meeting.participants.map((p) => ({ id: p.membership.id, name: p.membership.user.name }));
  const result = await aiProvider.summarizeMeeting(transcript, people, meeting.title);

  await prisma.$transaction(async (tx) => {
    await tx.meetingNote.deleteMany({ where: { meetingId, kind: { in: ['TRANSCRIPT', 'SUMMARY', 'DECISIONS', 'MINUTES'] } } });

    await tx.meetingNote.createMany({
      data: [
        { meetingId, kind: 'TRANSCRIPT' as const, content: transcript, generatedBy: aiProvider.name },
        { meetingId, kind: 'SUMMARY' as const, content: result.summary, generatedBy: aiProvider.name },
        {
          meetingId,
          kind: 'DECISIONS' as const,
          content: result.decisions.join('\n'),
          structured: { decisions: result.decisions } as never,
          generatedBy: aiProvider.name,
        },
        { meetingId, kind: 'MINUTES' as const, content: result.minutes, generatedBy: aiProvider.name },
      ],
    });

    await tx.meetingActionItem.deleteMany({ where: { meetingId, status: 'SUGGESTED' } });

    if (result.actions.length > 0) {
      await tx.meetingActionItem.createMany({
        data: result.actions.map((action) => ({
          meetingId,
          title: action.title,
          assigneeHint: action.assigneeHint,
          dueHint: action.dueHint,
          dueAt: action.dueAt,
          confidence: action.confidence,
          status: 'SUGGESTED' as const,
        })),
      });
    }

    await tx.meeting.update({ where: { id: meetingId }, data: { status: 'ENDED' } });
  });

  return {
    summary: result.summary,
    decisions: result.decisions,
    actionCount: result.actions.length,
    minutes: result.minutes,
  };
}

/** Aceita um item de ação da reunião e o transforma numa tarefa real. */
export async function acceptActionItem(
  ctx: AuthContext,
  meetingId: string,
  itemId: string,
  overrides?: { title?: string; assigneeId?: string | null; dueAt?: Date | null; projectId?: string | null },
) {
  const item = await prisma.meetingActionItem.findFirst({
    where: { id: itemId, meetingId, meeting: { companyId: ctx.companyId } },
    include: { meeting: { select: { id: true, title: true, projectId: true, organizerId: true } } },
  });
  if (!item) throw new NotFoundError('Item de ação não encontrado.');
  if (item.status === 'ACCEPTED') throw new ValidationError('Este item já virou tarefa.');

  // Se a IA identificou o nome mas não o id, resolvemos aqui pelo nome exato.
  let assigneeId = overrides?.assigneeId ?? null;
  if (!assigneeId && item.assigneeHint) {
    const match = await prisma.membership.findFirst({
      where: { companyId: ctx.companyId, status: 'ACTIVE', user: { name: item.assigneeHint } },
      select: { id: true },
    });
    assigneeId = match?.id ?? null;
  }

  const task = await createTask(ctx, {
    title: overrides?.title ?? item.title,
    description: `Item de ação da reunião "${item.meeting.title}".`,
    assigneeId,
    dueAt: overrides?.dueAt ?? item.dueAt,
    projectId: overrides?.projectId ?? item.meeting.projectId,
    origin: 'MEETING',
    originRefId: meetingId,
  });

  await prisma.meetingActionItem.update({
    where: { id: itemId },
    data: { status: 'ACCEPTED', taskId: task.id },
  });

  return task;
}

export async function dismissActionItem(ctx: AuthContext, meetingId: string, itemId: string): Promise<void> {
  const item = await prisma.meetingActionItem.findFirst({
    where: { id: itemId, meetingId, meeting: { companyId: ctx.companyId } },
    select: { id: true },
  });
  if (!item) throw new NotFoundError('Item de ação não encontrado.');

  await prisma.meetingActionItem.update({ where: { id: itemId }, data: { status: 'DISMISSED' } });
}
