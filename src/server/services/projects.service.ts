/**
 * Projetos.
 *
 * Um projeto é o ponto de encontro dos módulos: agrega tarefas, reuniões,
 * arquivos e um canal de conversa. Criar um projeto cria também o canal —
 * é o que evita que a discussão do projeto fique espalhada.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, scoped, scopedId } from '@/lib/db/tenant';
import { auditFromContext, diff } from '@/lib/audit';
import { NotFoundError } from '@/lib/http/errors';
import { projectKeyFrom, slugify, uniqueSlug } from '@/lib/utils/slug';
import { notify } from './notifications.service';
import { publish } from '@/lib/realtime/bus';
import type { AuthContext } from '@/lib/auth/context';
import type { ProjectStatus } from '@/generated/prisma/enums';

export interface ProjectInput {
  name: string;
  key?: string;
  description?: string;
  color?: string;
  status?: ProjectStatus;
  leadId?: string | null;
  startsAt?: Date | null;
  dueAt?: Date | null;
  memberIds?: string[];
}

export async function listProjects(ctx: AuthContext, options: { status?: ProjectStatus; search?: string } = {}) {
  assertPermission(ctx, 'projects.view');

  const search = options.search?.trim();

  const projects = await prisma.project.findMany({
    where: {
      ...scoped(ctx),
      archivedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { key: { contains: search, mode: 'insensitive' as const } }] } : {}),
    },
    orderBy: [{ status: 'asc' }, { dueAt: { sort: 'asc', nulls: 'last' } }],
    select: {
      id: true, name: true, key: true, description: true, color: true, status: true,
      progress: true, startsAt: true, dueAt: true, createdAt: true,
      lead: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
      members: {
        take: 6,
        select: { membership: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } } },
      },
      _count: { select: { tasks: true, members: true, meetings: true, files: true } },
    },
  });

  // Contagem de tarefas abertas por projeto em UMA query agregada, não N+1.
  const openCounts = await prisma.task.groupBy({
    by: ['projectId'],
    where: { companyId: ctx.companyId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] }, projectId: { in: projects.map((p) => p.id) } },
    _count: { _all: true },
  });

  const openByProject = new Map(openCounts.map((row) => [row.projectId, row._count._all]));

  return projects.map((project) => ({ ...project, openTasks: openByProject.get(project.id) ?? 0 }));
}

export async function getProject(ctx: AuthContext, projectId: string) {
  assertPermission(ctx, 'projects.view');

  const project = await prisma.project.findFirst({
    where: scopedId(ctx, projectId),
    include: {
      lead: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
      members: {
        select: {
          isLead: true,
          membership: {
            select: {
              id: true,
              user: { select: { name: true, avatarUrl: true } },
              role: { select: { name: true, color: true } },
            },
          },
        },
      },
      channels: { select: { id: true, name: true, slug: true } },
      meetings: {
        where: { status: { in: ['SCHEDULED', 'LIVE'] } },
        orderBy: { startsAt: 'asc' },
        take: 5,
        select: { id: true, title: true, startsAt: true, endsAt: true, status: true },
      },
      files: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, sizeBytes: true, mimeType: true, category: true, createdAt: true },
      },
    },
  });

  if (!project) throw new NotFoundError('Projeto não encontrado.');

  const [tasks, statusCounts] = await Promise.all([
    prisma.task.findMany({
      where: { companyId: ctx.companyId, projectId, deletedAt: null, parentId: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      take: 300,
      select: {
        id: true, title: true, status: true, priority: true, dueAt: true, position: true, tags: true,
        assignee: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
        _count: { select: { subtasks: true, comments: true } },
      },
    }),
    prisma.task.groupBy({
      by: ['status'],
      where: { companyId: ctx.companyId, projectId, deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  return {
    ...project,
    tasks,
    statusCounts: Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])),
  };
}

export async function createProject(ctx: AuthContext, input: ProjectInput) {
  assertPermission(ctx, 'projects.create');

  const key = await uniqueProjectKey(ctx.companyId, input.key || projectKeyFrom(input.name));

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        companyId: ctx.companyId,
        name: input.name,
        key,
        description: input.description || null,
        color: input.color ?? '#2E7DFF',
        status: input.status ?? 'ACTIVE',
        leadId: input.leadId ?? ctx.membershipId,
        startsAt: input.startsAt ?? null,
        dueAt: input.dueAt ?? null,
      },
    });

    const memberIds = new Set([...(input.memberIds ?? []), input.leadId ?? ctx.membershipId]);

    await tx.projectMember.createMany({
      data: Array.from(memberIds).map((membershipId) => ({
        projectId: created.id,
        membershipId,
        isLead: membershipId === (input.leadId ?? ctx.membershipId),
      })),
      skipDuplicates: true,
    });

    return { created, memberIds: Array.from(memberIds) };
  });

  // Canal dedicado: a conversa do projeto nasce junto com ele.
  const channelSlug = await uniqueSlug(`proj-${input.name}`, async (candidate) => {
    const existing = await prisma.channel.findUnique({
      where: { companyId_slug: { companyId: ctx.companyId, slug: candidate } },
      select: { id: true },
    });
    return existing !== null;
  }, 'projeto');

  const channel = await prisma.channel.create({
    data: {
      companyId: ctx.companyId,
      projectId: project.created.id,
      name: slugify(input.name).slice(0, 40) || channelSlug,
      slug: channelSlug,
      topic: `Conversas do projeto ${input.name}`,
      kind: 'PUBLIC',
    },
  });

  await prisma.channelMember.createMany({
    data: project.memberIds.map((membershipId) => ({ channelId: channel.id, membershipId })),
    skipDuplicates: true,
  });

  await auditFromContext(ctx, {
    action: 'project.created',
    entityType: 'project',
    entityId: project.created.id,
    metadata: { name: input.name, key },
  });

  await notify({
    companyId: ctx.companyId,
    recipientIds: project.memberIds,
    actorId: ctx.membershipId,
    kind: 'PROJECT_UPDATED',
    title: 'Você foi adicionado a um projeto',
    body: input.name,
    href: `/projetos/${project.created.id}`,
    entityType: 'project',
    entityId: project.created.id,
  });

  return project.created;
}

async function uniqueProjectKey(companyId: string, base: string): Promise<string> {
  const root = base.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PRJ';

  for (let suffix = 0; suffix < 100; suffix++) {
    const candidate = suffix === 0 ? root : `${root}${suffix}`;
    const existing = await prisma.project.findUnique({
      where: { companyId_key: { companyId, key: candidate } },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  return `${root}${Date.now().toString(36).toUpperCase().slice(-3)}`;
}

export async function updateProject(ctx: AuthContext, projectId: string, input: Partial<ProjectInput>) {
  assertPermission(ctx, 'projects.update');

  const current = await prisma.project.findFirst({ where: scopedId(ctx, projectId) });
  if (!current) throw new NotFoundError('Projeto não encontrado.');

  const data = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
    ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
  };

  const project = await prisma.project.update({ where: { id: projectId }, data });

  if (input.memberIds) {
    await syncProjectMembers(ctx, projectId, input.memberIds, input.leadId ?? current.leadId);
  }

  await auditFromContext(ctx, {
    action: 'project.updated',
    entityType: 'project',
    entityId: projectId,
    changes: diff(current as unknown as Record<string, unknown>, data),
  });

  publish('project.updated', ctx.companyId, { id: projectId, name: project.name, status: project.status });

  return project;
}

async function syncProjectMembers(
  ctx: AuthContext,
  projectId: string,
  memberIds: string[],
  leadId: string | null,
): Promise<void> {
  const valid = await prisma.membership.findMany({
    where: { id: { in: memberIds }, companyId: ctx.companyId, status: 'ACTIVE' },
    select: { id: true },
  });
  const validIds = valid.map((m) => m.id);

  await prisma.$transaction([
    prisma.projectMember.deleteMany({ where: { projectId, membershipId: { notIn: validIds } } }),
    prisma.projectMember.createMany({
      data: validIds.map((membershipId) => ({ projectId, membershipId, isLead: membershipId === leadId })),
      skipDuplicates: true,
    }),
  ]);
}

export async function deleteProject(ctx: AuthContext, projectId: string): Promise<void> {
  assertPermission(ctx, 'projects.delete');

  const project = await prisma.project.findFirst({ where: scopedId(ctx, projectId), select: { id: true, name: true } });
  if (!project) throw new NotFoundError('Projeto não encontrado.');

  // Arquivamento em vez de exclusão: tarefas e histórico continuam válidos.
  await prisma.project.update({
    where: { id: projectId },
    data: { archivedAt: new Date(), status: 'CANCELED' },
  });

  await auditFromContext(ctx, {
    action: 'project.deleted',
    entityType: 'project',
    entityId: projectId,
    severity: 'WARNING',
    metadata: { name: project.name },
  });
}
