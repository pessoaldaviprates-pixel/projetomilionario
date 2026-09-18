/**
 * Métricas e relatórios.
 *
 * Todo número aqui é contado no banco, sem estimativa nem extrapolação.
 * Quando não há dado suficiente, devolvemos zero — nunca um valor inventado
 * para "encher" o gráfico.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, scoped } from '@/lib/db/tenant';
import type { AuthContext } from '@/lib/auth/context';

export interface DailyPoint {
  date: string;
  criadas: number;
  concluidas: number;
}

/** Série diária de tarefas criadas × concluídas. */
export async function getTaskTrend(ctx: AuthContext, days = 14): Promise<DailyPoint[]> {
  assertPermission(ctx, 'reports.view');

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

  const [created, completed] = await Promise.all([
    prisma.task.findMany({
      where: { ...scoped(ctx), createdAt: { gte: start } },
      select: { createdAt: true },
    }),
    prisma.task.findMany({
      where: { ...scoped(ctx), completedAt: { gte: start } },
      select: { completedAt: true },
    }),
  ]);

  const buckets = new Map<string, DailyPoint>();
  for (let index = 0; index < days; index++) {
    const day = new Date(start.getTime() + index * 86_400_000);
    const key = day.toISOString().slice(0, 10);
    buckets.set(key, { date: key, criadas: 0, concluidas: 0 });
  }

  for (const task of created) {
    const key = task.createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket.criadas++;
  }

  for (const task of completed) {
    if (!task.completedAt) continue;
    const key = task.completedAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket.concluidas++;
  }

  return Array.from(buckets.values());
}

export async function getWorkloadByMember(ctx: AuthContext, limit = 8) {
  assertPermission(ctx, 'reports.view');

  const grouped = await prisma.task.groupBy({
    by: ['assigneeId'],
    where: {
      ...scoped(ctx),
      deletedAt: null,
      status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
      assigneeId: { not: null },
    },
    _count: { _all: true },
    orderBy: { _count: { assigneeId: 'desc' } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const members = await prisma.membership.findMany({
    where: { id: { in: grouped.map((row) => row.assigneeId!) }, companyId: ctx.companyId },
    select: { id: true, user: { select: { name: true, avatarUrl: true } } },
  });

  const byId = new Map(members.map((member) => [member.id, member]));

  return grouped.map((row) => ({
    membershipId: row.assigneeId!,
    name: byId.get(row.assigneeId!)?.user.name ?? 'Desconhecido',
    avatarUrl: byId.get(row.assigneeId!)?.user.avatarUrl ?? null,
    openTasks: row._count._all,
  }));
}

export async function getStatusBreakdown(ctx: AuthContext) {
  const grouped = await prisma.task.groupBy({
    by: ['status'],
    where: { ...scoped(ctx), deletedAt: null },
    _count: { _all: true },
  });

  const labels: Record<string, string> = {
    TODO: 'A fazer',
    IN_PROGRESS: 'Em andamento',
    IN_REVIEW: 'Em revisão',
    DONE: 'Concluída',
    CANCELED: 'Cancelada',
  };

  return grouped.map((row) => ({
    status: row.status,
    label: labels[row.status] ?? row.status,
    count: row._count._all,
  }));
}

/** Indicadores agregados do período — base do dashboard de métricas. */
export async function getProductivityStats(ctx: AuthContext, days = 30) {
  assertPermission(ctx, 'reports.view');

  const since = new Date(Date.now() - days * 86_400_000);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [completed, created, overdue, meetings, messages, activeMembers, completedWithDates] = await Promise.all([
    prisma.task.count({ where: { ...scoped(ctx), status: 'DONE', completedAt: { gte: since } } }),
    prisma.task.count({ where: { ...scoped(ctx), createdAt: { gte: since } } }),
    prisma.task.count({
      where: { ...scoped(ctx), deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] }, dueAt: { lt: startOfDay } },
    }),
    prisma.meeting.count({ where: { ...scoped(ctx), startsAt: { gte: since } } }),
    prisma.message.count({ where: { ...scoped(ctx), deletedAt: null, createdAt: { gte: since } } }),
    prisma.membership.count({ where: { ...scoped(ctx), status: 'ACTIVE' } }),
    prisma.task.findMany({
      where: { ...scoped(ctx), status: 'DONE', completedAt: { gte: since } },
      select: { createdAt: true, completedAt: true },
      take: 500,
    }),
  ]);

  // Tempo médio de ciclo: da criação à conclusão, em horas.
  const cycleTimes = completedWithDates
    .filter((task) => task.completedAt)
    .map((task) => (task.completedAt!.getTime() - task.createdAt.getTime()) / 3_600_000);

  const avgCycleHours =
    cycleTimes.length > 0 ? cycleTimes.reduce((sum, value) => sum + value, 0) / cycleTimes.length : null;

  return {
    completed,
    created,
    overdue,
    meetings,
    messages,
    activeMembers,
    // Só reportamos taxa de conclusão se houve tarefa criada no período.
    completionRate: created > 0 ? Math.round((completed / created) * 100) : null,
    avgCycleHours: avgCycleHours === null ? null : Math.round(avgCycleHours * 10) / 10,
    sampleSize: cycleTimes.length,
  };
}

export async function getRecentActivity(ctx: AuthContext, limit = 12) {
  const logs = await prisma.auditLog.findMany({
    where: {
      ...scoped(ctx),
      // Ações de leitura poluem o feed; mostramos o que mudou o estado.
      action: { notIn: ['auth.login', 'auth.logout', 'file.downloaded', 'auth.login_failed'] },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true,
      actor: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
    },
  });

  return logs;
}
