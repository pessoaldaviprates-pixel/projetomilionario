/**
 * Tarefas.
 *
 * É o módulo que conecta todos os outros: uma tarefa pode nascer de uma
 * mensagem, de uma reunião ou da IA, e se projeta na agenda e nas notificações.
 * Por isso `origin`/`originRefId` são gravados sempre — a rastreabilidade de
 * "de onde veio isso" é parte do valor do produto.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, assertPermissionOrOwner, scoped, scopedId } from '@/lib/db/tenant';
import { auditFromContext, diff } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/http/errors';
import { publish } from '@/lib/realtime/bus';
import { notify } from './notifications.service';
import type { AuthContext } from '@/lib/auth/context';
import type { TaskOrigin, TaskPriority, TaskStatus } from '@/generated/prisma/enums';

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  projectId?: string;
  assigneeId?: string;
  search?: string;
  dueBefore?: Date;
  onlyMine?: boolean;
  includeDone?: boolean;
  tag?: string;
}

const OPEN_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'];

function buildTaskWhere(ctx: AuthContext, filters: TaskFilters) {
  const search = filters.search?.trim();

  return {
    ...scoped(ctx),
    deletedAt: null,
    // Subtarefas aparecem dentro da tarefa-mãe, não na listagem principal.
    parentId: null,
    ...(filters.status?.length
      ? { status: { in: filters.status } }
      : filters.includeDone
        ? {}
        : { status: { in: OPEN_STATUSES } }),
    ...(filters.priority?.length ? { priority: { in: filters.priority } } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.onlyMine ? { assigneeId: ctx.membershipId } : filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.dueBefore ? { dueAt: { lte: filters.dueBefore } } : {}),
    ...(filters.tag ? { tags: { has: filters.tag } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

const TASK_LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueAt: true,
  startsAt: true,
  completedAt: true,
  position: true,
  tags: true,
  origin: true,
  createdAt: true,
  estimateMinutes: true,
  assignee: {
    select: { id: true, user: { select: { name: true, avatarUrl: true } } },
  },
  project: { select: { id: true, name: true, color: true, key: true } },
  _count: { select: { subtasks: true, comments: true, checklist: true, files: true } },
  checklist: { select: { isDone: true } },
} as const;

export async function listTasks(ctx: AuthContext, filters: TaskFilters = {}) {
  assertPermission(ctx, 'tasks.view');

  const tasks = await prisma.task.findMany({
    where: buildTaskWhere(ctx, filters),
    orderBy: [{ position: 'asc' }, { dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 300,
    select: TASK_LIST_SELECT,
  });

  return tasks.map((task) => ({
    ...task,
    checklistDone: task.checklist.filter((item) => item.isDone).length,
    checklistTotal: task.checklist.length,
    checklist: undefined,
  }));
}

export async function getTask(ctx: AuthContext, taskId: string) {
  assertPermission(ctx, 'tasks.view');

  const task = await prisma.task.findFirst({
    where: scopedId(ctx, taskId),
    include: {
      assignee: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
      creator: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
      project: { select: { id: true, name: true, color: true, key: true } },
      parent: { select: { id: true, title: true } },
      subtasks: {
        where: { deletedAt: null },
        orderBy: { position: 'asc' },
        select: {
          id: true, title: true, status: true, priority: true, dueAt: true,
          assignee: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
        },
      },
      checklist: { orderBy: { position: 'asc' } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } } },
      },
      files: {
        where: { deletedAt: null },
        select: { id: true, name: true, sizeBytes: true, mimeType: true, category: true, createdAt: true },
      },
      activities: { orderBy: { createdAt: 'desc' }, take: 30 },
      watchers: { select: { membershipId: true } },
      blockedBy: { select: { blocker: { select: { id: true, title: true, status: true } } } },
      blocks: { select: { blocked: { select: { id: true, title: true, status: true } } } },
      timeBlocks: { orderBy: { startsAt: 'asc' }, select: { id: true, startsAt: true, endsAt: true, isDone: true } },
    },
  });

  if (!task) throw new NotFoundError('Tarefa não encontrada.');

  // Mensagens que originaram ou citam a tarefa — o elo "chat → tarefa".
  const sourceMessages = await prisma.message.findMany({
    where: { companyId: ctx.companyId, linkedTaskId: taskId, deletedAt: null },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, body: true, createdAt: true,
      channel: { select: { id: true, name: true } },
      author: { select: { user: { select: { name: true, avatarUrl: true } } } },
    },
  });

  return { ...task, sourceMessages };
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string | null;
  assigneeId?: string | null;
  parentId?: string | null;
  startsAt?: Date | null;
  dueAt?: Date | null;
  estimateMinutes?: number | null;
  tags?: string[];
  checklist?: string[];
  origin?: TaskOrigin;
  originRefId?: string | null;
}

export async function createTask(ctx: AuthContext, input: CreateTaskInput) {
  assertPermission(ctx, 'tasks.create');

  // Atribuir para outra pessoa é uma permissão distinta de criar tarefa.
  if (input.assigneeId && input.assigneeId !== ctx.membershipId) {
    assertPermission(ctx, 'tasks.assign');
  }

  await validateReferences(ctx, input);

  // Nova tarefa entra no topo da coluna do kanban.
  const first = await prisma.task.findFirst({
    where: { companyId: ctx.companyId, projectId: input.projectId ?? null, status: input.status ?? 'TODO' },
    orderBy: { position: 'asc' },
    select: { position: true },
  });

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        companyId: ctx.companyId,
        title: input.title,
        description: input.description || null,
        status: input.status ?? 'TODO',
        priority: input.priority ?? 'MEDIUM',
        projectId: input.projectId ?? null,
        assigneeId: input.assigneeId ?? null,
        parentId: input.parentId ?? null,
        creatorId: ctx.membershipId,
        startsAt: input.startsAt ?? null,
        dueAt: input.dueAt ?? null,
        estimateMinutes: input.estimateMinutes ?? null,
        tags: input.tags ?? [],
        origin: input.origin ?? 'MANUAL',
        originRefId: input.originRefId ?? null,
        position: (first?.position ?? 0) - 1,
      },
    });

    if (input.checklist?.length) {
      await tx.checklistItem.createMany({
        data: input.checklist.map((title, index) => ({ taskId: created.id, title, position: index })),
      });
    }

    await tx.taskActivity.create({
      data: { taskId: created.id, actorId: ctx.membershipId, action: 'created' },
    });

    // Quem cria e quem recebe acompanham a tarefa por padrão.
    const watchers = new Set([ctx.membershipId, ...(input.assigneeId ? [input.assigneeId] : [])]);
    await tx.taskWatcher.createMany({
      data: Array.from(watchers).map((membershipId) => ({ taskId: created.id, membershipId })),
      skipDuplicates: true,
    });

    return created;
  });

  // Tarefa com prazo aparece automaticamente na agenda de quem é responsável.
  if (task.dueAt && task.assigneeId) {
    await syncTaskEvent(ctx.companyId, task.id);
  }

  if (input.projectId) await recalculateProjectProgress(input.projectId);

  await auditFromContext(ctx, {
    action: 'task.created',
    entityType: 'task',
    entityId: task.id,
    metadata: { title: task.title, origin: task.origin },
  });

  publish('task.created', ctx.companyId, { id: task.id, title: task.title, status: task.status });

  if (task.assigneeId && task.assigneeId !== ctx.membershipId) {
    await notify({
      companyId: ctx.companyId,
      recipientIds: [task.assigneeId],
      actorId: ctx.membershipId,
      kind: 'TASK_ASSIGNED',
      title: 'Nova tarefa atribuída a você',
      body: task.title,
      href: `/tarefas/${task.id}`,
      entityType: 'task',
      entityId: task.id,
    });
  }

  return task;
}

async function validateReferences(ctx: AuthContext, input: Partial<CreateTaskInput>): Promise<void> {
  if (input.projectId) {
    const project = await prisma.project.findFirst({ where: scopedId(ctx, input.projectId), select: { id: true } });
    if (!project) throw new NotFoundError('Projeto não encontrado.');
  }
  if (input.assigneeId) {
    const assignee = await prisma.membership.findFirst({
      where: { id: input.assigneeId, companyId: ctx.companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!assignee) throw new NotFoundError('Responsável não encontrado.');
  }
  if (input.parentId) {
    const parent = await prisma.task.findFirst({ where: scopedId(ctx, input.parentId), select: { id: true, parentId: true } });
    if (!parent) throw new NotFoundError('Tarefa principal não encontrada.');
    // Um nível de subtarefa mantém a UI e as queries previsíveis.
    if (parent.parentId) throw new ValidationError('Não é possível criar subtarefa de uma subtarefa.');
  }
  if (input.startsAt && input.dueAt && input.startsAt > input.dueAt) {
    throw new ValidationError('A data de início não pode ser depois do prazo.');
  }
}

export async function updateTask(ctx: AuthContext, taskId: string, input: Partial<CreateTaskInput> & { position?: number }) {
  const current = await prisma.task.findFirst({ where: scopedId(ctx, taskId) });
  if (!current) throw new NotFoundError('Tarefa não encontrada.');

  // Responsável e criador editam livremente; os demais precisam de permissão.
  const owns = current.assigneeId === ctx.membershipId || current.creatorId === ctx.membershipId;
  if (!owns) assertPermission(ctx, 'tasks.update');
  if (input.assigneeId !== undefined && input.assigneeId !== current.assigneeId) {
    assertPermissionOrOwner(ctx, 'tasks.assign', current.creatorId);
  }

  await validateReferences(ctx, { ...input, startsAt: input.startsAt ?? current.startsAt, dueAt: input.dueAt ?? current.dueAt });

  const isCompleting = input.status === 'DONE' && current.status !== 'DONE';
  const isReopening = input.status !== undefined && input.status !== 'DONE' && current.status === 'DONE';

  const data = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
    ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    ...(input.estimateMinutes !== undefined ? { estimateMinutes: input.estimateMinutes } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.position !== undefined ? { position: input.position } : {}),
    ...(isCompleting ? { completedAt: new Date() } : {}),
    ...(isReopening ? { completedAt: null } : {}),
  };

  const task = await prisma.task.update({ where: { id: taskId }, data });

  const changes = diff(current as unknown as Record<string, unknown>, data);
  if (Object.keys(changes).length > 0) {
    await prisma.taskActivity.createMany({
      data: Object.entries(changes).map(([field, [from, to]]) => ({
        taskId,
        actorId: ctx.membershipId,
        action: 'updated',
        field,
        fromValue: from === null ? null : String(from),
        toValue: to === null ? null : String(to),
      })),
    });
  }

  await syncTaskEvent(ctx.companyId, taskId);

  const affectedProjects = new Set([current.projectId, task.projectId].filter(Boolean) as string[]);
  for (const projectId of affectedProjects) await recalculateProjectProgress(projectId);

  await auditFromContext(ctx, {
    action: isCompleting ? 'task.completed' : 'task.updated',
    entityType: 'task',
    entityId: taskId,
    changes,
  });

  publish('task.updated', ctx.companyId, { id: taskId, status: task.status, title: task.title });

  // Avisa quem passou a ser responsável, e quem acompanha quando conclui.
  if (input.assigneeId && input.assigneeId !== current.assigneeId) {
    await notify({
      companyId: ctx.companyId,
      recipientIds: [input.assigneeId],
      actorId: ctx.membershipId,
      kind: 'TASK_ASSIGNED',
      title: 'Tarefa atribuída a você',
      body: task.title,
      href: `/tarefas/${taskId}`,
      entityType: 'task',
      entityId: taskId,
    });
  }

  if (isCompleting) {
    const watchers = await prisma.taskWatcher.findMany({ where: { taskId }, select: { membershipId: true } });
    await notify({
      companyId: ctx.companyId,
      recipientIds: watchers.map((w) => w.membershipId),
      actorId: ctx.membershipId,
      kind: 'TASK_UPDATED',
      title: 'Tarefa concluída',
      body: task.title,
      href: `/tarefas/${taskId}`,
      entityType: 'task',
      entityId: taskId,
    });
  }

  return task;
}

/** Reordenação do kanban: move a tarefa para um status/posição. */
export async function moveTask(
  ctx: AuthContext,
  taskId: string,
  status: TaskStatus,
  position: number,
): Promise<void> {
  const task = await prisma.task.findFirst({ where: scopedId(ctx, taskId), select: { id: true, status: true, projectId: true, assigneeId: true, creatorId: true } });
  if (!task) throw new NotFoundError('Tarefa não encontrada.');

  const owns = task.assigneeId === ctx.membershipId || task.creatorId === ctx.membershipId;
  if (!owns) assertPermission(ctx, 'tasks.update');

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      position,
      ...(status === 'DONE' ? { completedAt: new Date() } : task.status === 'DONE' ? { completedAt: null } : {}),
    },
  });

  if (task.projectId) await recalculateProjectProgress(task.projectId);
  publish('task.updated', ctx.companyId, { id: taskId, status });
}

export async function deleteTask(ctx: AuthContext, taskId: string): Promise<void> {
  const task = await prisma.task.findFirst({ where: scopedId(ctx, taskId), select: { id: true, creatorId: true, projectId: true, title: true } });
  if (!task) throw new NotFoundError('Tarefa não encontrada.');

  assertPermissionOrOwner(ctx, 'tasks.delete', task.creatorId);

  // Exclusão lógica: preserva histórico, auditoria e referências de mensagens.
  await prisma.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
  await prisma.calendarEvent.deleteMany({ where: { companyId: ctx.companyId, taskId } });

  if (task.projectId) await recalculateProjectProgress(task.projectId);

  await auditFromContext(ctx, {
    action: 'task.deleted',
    entityType: 'task',
    entityId: taskId,
    severity: 'WARNING',
    metadata: { title: task.title },
  });

  publish('task.deleted', ctx.companyId, { id: taskId });
}

export async function addComment(ctx: AuthContext, taskId: string, body: string) {
  assertPermission(ctx, 'tasks.view');

  const task = await prisma.task.findFirst({ where: scopedId(ctx, taskId), select: { id: true, title: true } });
  if (!task) throw new NotFoundError('Tarefa não encontrada.');

  const comment = await prisma.taskComment.create({
    data: { taskId, authorId: ctx.membershipId, body },
    include: { author: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } } },
  });

  await prisma.taskWatcher.createMany({
    data: [{ taskId, membershipId: ctx.membershipId }],
    skipDuplicates: true,
  });

  const watchers = await prisma.taskWatcher.findMany({ where: { taskId }, select: { membershipId: true } });
  await notify({
    companyId: ctx.companyId,
    recipientIds: watchers.map((w) => w.membershipId),
    actorId: ctx.membershipId,
    kind: 'COMMENT',
    title: `Novo comentário em "${task.title}"`,
    body: body.slice(0, 140),
    href: `/tarefas/${taskId}`,
    entityType: 'task',
    entityId: taskId,
  });

  return comment;
}

export async function toggleChecklistItem(ctx: AuthContext, taskId: string, itemId: string, isDone: boolean) {
  const task = await prisma.task.findFirst({ where: scopedId(ctx, taskId), select: { id: true } });
  if (!task) throw new NotFoundError('Tarefa não encontrada.');

  await prisma.checklistItem.updateMany({ where: { id: itemId, taskId }, data: { isDone } });
}

export async function addChecklistItem(ctx: AuthContext, taskId: string, title: string) {
  const task = await prisma.task.findFirst({ where: scopedId(ctx, taskId), select: { id: true } });
  if (!task) throw new NotFoundError('Tarefa não encontrada.');

  const last = await prisma.checklistItem.findFirst({ where: { taskId }, orderBy: { position: 'desc' }, select: { position: true } });
  return prisma.checklistItem.create({
    data: { taskId, title, position: (last?.position ?? -1) + 1 },
  });
}

/**
 * Mantém a agenda em sincronia com o prazo da tarefa.
 * Sem prazo ou sem responsável, o evento deixa de existir.
 */
export async function syncTaskEvent(companyId: string, taskId: string): Promise<void> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, companyId },
    select: { id: true, title: true, dueAt: true, assigneeId: true, projectId: true, status: true, deletedAt: true },
  });

  if (!task || !task.dueAt || !task.assigneeId || task.deletedAt || task.status === 'DONE' || task.status === 'CANCELED') {
    await prisma.calendarEvent.deleteMany({ where: { companyId, taskId } });
    return;
  }

  const existing = await prisma.calendarEvent.findFirst({ where: { companyId, taskId }, select: { id: true } });
  const startsAt = new Date(task.dueAt.getTime() - 30 * 60_000);

  if (existing) {
    await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: { title: task.title, startsAt, endsAt: task.dueAt, ownerId: task.assigneeId, projectId: task.projectId },
    });
    return;
  }

  await prisma.calendarEvent.create({
    data: {
      companyId,
      ownerId: task.assigneeId,
      title: task.title,
      kind: 'DEADLINE',
      startsAt,
      endsAt: task.dueAt,
      taskId: task.id,
      projectId: task.projectId,
    },
  });
}

/** Progresso do projeto = tarefas concluídas / tarefas ativas. */
export async function recalculateProjectProgress(projectId: string): Promise<void> {
  const [total, done] = await Promise.all([
    prisma.task.count({ where: { projectId, deletedAt: null, status: { not: 'CANCELED' } } }),
    prisma.task.count({ where: { projectId, deletedAt: null, status: 'DONE' } }),
  ]);

  const progress = total === 0 ? 0 : Math.round((done / total) * 100);
  await prisma.project.update({ where: { id: projectId }, data: { progress } }).catch(() => undefined);
}

/** Agenda do dia: o que a pessoa precisa resolver hoje. */
export async function getTodayBoard(ctx: AuthContext) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

  const [overdue, dueToday, inProgress, upcoming] = await Promise.all([
    prisma.task.findMany({
      where: { ...scoped(ctx), deletedAt: null, assigneeId: ctx.membershipId, status: { in: OPEN_STATUSES }, dueAt: { lt: startOfDay } },
      orderBy: { dueAt: 'asc' },
      take: 20,
      select: TASK_LIST_SELECT,
    }),
    prisma.task.findMany({
      where: { ...scoped(ctx), deletedAt: null, assigneeId: ctx.membershipId, status: { in: OPEN_STATUSES }, dueAt: { gte: startOfDay, lt: endOfDay } },
      orderBy: { priority: 'desc' },
      take: 20,
      select: TASK_LIST_SELECT,
    }),
    prisma.task.findMany({
      where: { ...scoped(ctx), deletedAt: null, assigneeId: ctx.membershipId, status: 'IN_PROGRESS' },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: TASK_LIST_SELECT,
    }),
    prisma.task.findMany({
      where: { ...scoped(ctx), deletedAt: null, assigneeId: ctx.membershipId, status: { in: OPEN_STATUSES }, dueAt: { gte: endOfDay } },
      orderBy: { dueAt: 'asc' },
      take: 10,
      select: TASK_LIST_SELECT,
    }),
  ]);

  const strip = (tasks: typeof overdue) =>
    tasks.map((t) => ({
      ...t,
      checklistDone: t.checklist.filter((c) => c.isDone).length,
      checklistTotal: t.checklist.length,
      checklist: undefined,
    }));

  return { overdue: strip(overdue), dueToday: strip(dueToday), inProgress: strip(inProgress), upcoming: strip(upcoming) };
}
