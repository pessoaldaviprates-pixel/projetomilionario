/**
 * Agenda e time blocking.
 *
 * A agenda não é uma tabela separada da realidade: ela reflete reuniões,
 * prazos de tarefa e blocos de foco. Arrastar uma tarefa para o calendário
 * cria um TimeBlock ligado à tarefa — os dois lados permanecem sincronizados.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, scoped, scopedId } from '@/lib/db/tenant';
import { NotFoundError, ValidationError } from '@/lib/http/errors';
import { requireEntitlement } from '@/lib/billing/subscription';
import type { AuthContext } from '@/lib/auth/context';
import type { EventKind } from '@/generated/prisma/enums';

export interface CalendarRange {
  from: Date;
  to: Date;
  /** Sem isso, a agenda mostra apenas os próprios compromissos. */
  includeTeam?: boolean;
}

export interface AgendaItem {
  id: string;
  title: string;
  kind: EventKind | 'TIME_BLOCK';
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  color: string | null;
  location: string | null;
  meetingId: string | null;
  taskId: string | null;
  projectName: string | null;
  href: string | null;
  isDone?: boolean;
}

export async function getAgenda(ctx: AuthContext, range: CalendarRange): Promise<AgendaItem[]> {
  assertPermission(ctx, 'calendar.view');

  if (range.to.getTime() - range.from.getTime() > 400 * 86_400_000) {
    throw new ValidationError('Período muito longo. Consulte no máximo 13 meses por vez.');
  }

  const [events, blocks] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: {
        ...scoped(ctx),
        ...(range.includeTeam
          ? {}
          : { OR: [{ ownerId: ctx.membershipId }, { attendees: { some: { membershipId: ctx.membershipId } } }] }),
        startsAt: { lt: range.to },
        endsAt: { gt: range.from },
      },
      orderBy: { startsAt: 'asc' },
      take: 500,
      select: {
        id: true, title: true, kind: true, startsAt: true, endsAt: true, allDay: true,
        color: true, location: true, meetingId: true, taskId: true,
        project: { select: { name: true, color: true } },
      },
    }),
    prisma.timeBlock.findMany({
      where: {
        ...scoped(ctx),
        membershipId: ctx.membershipId,
        startsAt: { lt: range.to },
        endsAt: { gt: range.from },
      },
      orderBy: { startsAt: 'asc' },
      take: 300,
      select: {
        id: true, title: true, startsAt: true, endsAt: true, isDone: true,
        task: { select: { id: true, priority: true, status: true } },
      },
    }),
  ]);

  const eventItems: AgendaItem[] = events.map((event) => ({
    id: event.id,
    title: event.title,
    kind: event.kind,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    color: event.color ?? event.project?.color ?? null,
    location: event.location,
    meetingId: event.meetingId,
    taskId: event.taskId,
    projectName: event.project?.name ?? null,
    href: event.meetingId ? `/reunioes/${event.meetingId}` : event.taskId ? `/tarefas/${event.taskId}` : null,
  }));

  const blockItems: AgendaItem[] = blocks.map((block) => ({
    id: block.id,
    title: block.title,
    kind: 'TIME_BLOCK',
    startsAt: block.startsAt,
    endsAt: block.endsAt,
    allDay: false,
    color: '#8B5CF6',
    location: null,
    meetingId: null,
    taskId: block.task?.id ?? null,
    projectName: null,
    href: block.task ? `/tarefas/${block.task.id}` : null,
    isDone: block.isDone,
  }));

  return [...eventItems, ...blockItems].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export interface EventInput {
  title: string;
  description?: string;
  kind?: EventKind;
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
  location?: string;
  color?: string;
  attendeeIds?: string[];
}

export async function createEvent(ctx: AuthContext, input: EventInput) {
  assertPermission(ctx, 'calendar.manage');

  if (input.endsAt < input.startsAt) throw new ValidationError('O término deve ser depois do início.');

  const event = await prisma.calendarEvent.create({
    data: {
      companyId: ctx.companyId,
      ownerId: ctx.membershipId,
      title: input.title,
      description: input.description || null,
      kind: input.kind ?? 'EVENT',
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      allDay: input.allDay ?? false,
      location: input.location || null,
      color: input.color || null,
    },
  });

  if (input.attendeeIds?.length) {
    const valid = await prisma.membership.findMany({
      where: { id: { in: input.attendeeIds }, companyId: ctx.companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    await prisma.eventAttendee.createMany({
      data: valid.map((member) => ({ eventId: event.id, membershipId: member.id })),
      skipDuplicates: true,
    });
  }

  return event;
}

export async function deleteEvent(ctx: AuthContext, eventId: string): Promise<void> {
  const event = await prisma.calendarEvent.findFirst({
    where: scopedId(ctx, eventId),
    select: { id: true, ownerId: true, meetingId: true, taskId: true },
  });
  if (!event) throw new NotFoundError('Evento não encontrado.');

  // Eventos espelhados não são apagados aqui: remova a reunião ou o prazo.
  if (event.meetingId) throw new ValidationError('Este evento vem de uma reunião. Cancele a reunião para removê-lo.');
  if (event.taskId) throw new ValidationError('Este evento vem do prazo de uma tarefa. Altere o prazo da tarefa.');

  if (event.ownerId !== ctx.membershipId) assertPermission(ctx, 'calendar.manage');

  await prisma.calendarEvent.delete({ where: { id: eventId } });
}

export interface TimeBlockInput {
  taskId?: string | null;
  title: string;
  startsAt: Date;
  endsAt: Date;
}

/** Arrastar uma tarefa para a agenda cria um bloco de foco. */
export async function createTimeBlock(ctx: AuthContext, input: TimeBlockInput) {
  await requireEntitlement(ctx.companyId, 'calendar.timeblocking');

  if (input.endsAt <= input.startsAt) throw new ValidationError('O término deve ser depois do início.');

  if (input.taskId) {
    const task = await prisma.task.findFirst({ where: scopedId(ctx, input.taskId), select: { id: true } });
    if (!task) throw new NotFoundError('Tarefa não encontrada.');
  }

  // Aviso de conflito é responsabilidade da UI; aqui só bloqueamos sobreposição
  // exata do mesmo bloco para evitar duplicidade por clique duplo.
  const duplicate = await prisma.timeBlock.findFirst({
    where: {
      companyId: ctx.companyId,
      membershipId: ctx.membershipId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      taskId: input.taskId ?? null,
    },
    select: { id: true },
  });
  if (duplicate) return duplicate;

  return prisma.timeBlock.create({
    data: {
      companyId: ctx.companyId,
      membershipId: ctx.membershipId,
      taskId: input.taskId ?? null,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    },
  });
}

export async function moveTimeBlock(ctx: AuthContext, blockId: string, startsAt: Date, endsAt: Date) {
  const block = await prisma.timeBlock.findFirst({
    where: { id: blockId, companyId: ctx.companyId, membershipId: ctx.membershipId },
    select: { id: true },
  });
  if (!block) throw new NotFoundError('Bloco não encontrado.');
  if (endsAt <= startsAt) throw new ValidationError('O término deve ser depois do início.');

  return prisma.timeBlock.update({ where: { id: blockId }, data: { startsAt, endsAt } });
}

export async function toggleTimeBlock(ctx: AuthContext, blockId: string, isDone: boolean): Promise<void> {
  await prisma.timeBlock.updateMany({
    where: { id: blockId, companyId: ctx.companyId, membershipId: ctx.membershipId },
    data: { isDone },
  });
}

export async function deleteTimeBlock(ctx: AuthContext, blockId: string): Promise<void> {
  await prisma.timeBlock.deleteMany({
    where: { id: blockId, companyId: ctx.companyId, membershipId: ctx.membershipId },
  });
}

/** Próximos compromissos para o dashboard. */
export async function getUpcoming(ctx: AuthContext, limit = 5) {
  const now = new Date();

  return prisma.calendarEvent.findMany({
    where: {
      ...scoped(ctx),
      endsAt: { gte: now },
      OR: [{ ownerId: ctx.membershipId }, { attendees: { some: { membershipId: ctx.membershipId } } }],
    },
    orderBy: { startsAt: 'asc' },
    take: limit,
    select: {
      id: true, title: true, kind: true, startsAt: true, endsAt: true, location: true,
      meetingId: true, taskId: true,
      meeting: { select: { id: true, roomUrl: true, status: true, _count: { select: { participants: true } } } },
    },
  });
}
