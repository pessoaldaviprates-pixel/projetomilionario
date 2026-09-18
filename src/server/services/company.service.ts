/**
 * Serviço de empresas (tenants).
 *
 * A criação de uma empresa é a operação mais importante do sistema: ela
 * provisiona, em UMA transação, todo o ambiente inicial — cargos, departamentos,
 * canais padrão e o vínculo do fundador como dono. Se qualquer passo falhar,
 * nada é criado pela metade.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { DEFAULT_ROLE_PRESETS } from '@/lib/authz/permissions';
import { slugify, uniqueSlug } from '@/lib/utils/slug';
import { recordAudit } from '@/lib/audit';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/http/errors';
import type { AuthContext } from '@/lib/auth/context';
import { assertPermission } from '@/lib/db/tenant';
import type { CompanySize } from '@/generated/prisma/enums';
import { setActiveCompany } from '@/lib/auth/session';

export interface CreateCompanyInput {
  name: string;
  segment?: string;
  sizeBand?: CompanySize;
  goal?: string;
  website?: string;
  logoUrl?: string;
}

const DEFAULT_DEPARTMENTS = [
  { name: 'Diretoria', color: '#2E7DFF' },
  { name: 'Tecnologia', color: '#8B5CF6' },
  { name: 'Marketing', color: '#EC4899' },
  { name: 'Financeiro', color: '#10B981' },
  { name: 'Operações', color: '#F59E0B' },
  { name: 'Recursos Humanos', color: '#06B6D4' },
];

const DEFAULT_CHANNELS = [
  { name: 'geral', topic: 'Avisos e conversas de toda a empresa' },
  { name: 'anuncios', topic: 'Comunicados oficiais da liderança' },
  { name: 'aleatorio', topic: 'Assuntos livres do time' },
];

export async function createCompany(
  userId: string,
  input: CreateCompanyInput,
): Promise<{ companyId: string; membershipId: string }> {
  const slug = await uniqueSlug(input.name, async (candidate) => {
    const existing = await prisma.company.findUnique({ where: { slug: candidate }, select: { id: true } });
    return existing !== null;
  }, 'empresa');

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: input.name,
        slug,
        segment: input.segment || null,
        sizeBand: input.sizeBand ?? null,
        goal: input.goal || null,
        website: input.website || null,
        logoUrl: input.logoUrl || null,
        ownerId: userId,
      },
    });

    // Cargos padrão — editáveis depois, inclusive nas permissões.
    await tx.role.createMany({
      data: DEFAULT_ROLE_PRESETS.map((preset) => ({
        companyId: company.id,
        name: preset.name,
        slug: preset.slug,
        description: preset.description,
        color: preset.color,
        rank: preset.rank,
        permissions: preset.permissions,
        isSystem: true,
        isDefault: preset.isDefault ?? false,
      })),
    });

    await tx.department.createMany({
      data: DEFAULT_DEPARTMENTS.map((dept) => ({
        companyId: company.id,
        name: dept.name,
        slug: slugify(dept.name),
        color: dept.color,
      })),
    });

    const ceoRole = await tx.role.findFirstOrThrow({
      where: { companyId: company.id, slug: 'ceo' },
      select: { id: true },
    });

    const boardDepartment = await tx.department.findFirst({
      where: { companyId: company.id, slug: 'diretoria' },
      select: { id: true },
    });

    // Quem cria a empresa é o dono: recebe todas as permissões implicitamente.
    const membership = await tx.membership.create({
      data: {
        userId,
        companyId: company.id,
        roleId: ceoRole.id,
        departmentId: boardDepartment?.id ?? null,
        isOwner: true,
        status: 'ACTIVE',
        jobTitle: 'CEO',
      },
    });

    const channels = await Promise.all(
      DEFAULT_CHANNELS.map((channel) =>
        tx.channel.create({
          data: {
            companyId: company.id,
            name: channel.name,
            slug: channel.name,
            topic: channel.topic,
            kind: 'PUBLIC',
          },
        }),
      ),
    );

    await tx.channelMember.createMany({
      data: channels.map((channel) => ({
        channelId: channel.id,
        membershipId: membership.id,
        isAdmin: true,
      })),
    });

    return { companyId: company.id, membershipId: membership.id };
  });

  await recordAudit({
    action: 'company.created',
    companyId: result.companyId,
    actorId: result.membershipId,
    entityType: 'company',
    entityId: result.companyId,
    metadata: { name: input.name },
  });

  return result;
}

/** Troca a empresa ativa da sessão, validando o vínculo antes. */
export async function switchCompany(
  userId: string,
  sessionId: string,
  companyId: string,
): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { status: true },
  });

  if (!membership || membership.status !== 'ACTIVE') {
    throw new NotFoundError('Você não tem acesso a esta empresa.');
  }

  await setActiveCompany(sessionId, companyId);
}

export async function updateCompany(
  ctx: AuthContext,
  input: Partial<CreateCompanyInput>,
): Promise<void> {
  assertPermission(ctx, 'company.manage');

  await prisma.company.update({
    where: { id: ctx.companyId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.segment !== undefined ? { segment: input.segment || null } : {}),
      ...(input.sizeBand !== undefined ? { sizeBand: input.sizeBand } : {}),
      ...(input.goal !== undefined ? { goal: input.goal || null } : {}),
      ...(input.website !== undefined ? { website: input.website || null } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
    },
  });

  await recordAudit({
    action: 'company.updated',
    companyId: ctx.companyId,
    actorId: ctx.membershipId,
    entityType: 'company',
    entityId: ctx.companyId,
    changes: Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, [null, value] as [unknown, unknown]]),
    ),
  });
}

export async function completeOnboarding(ctx: AuthContext): Promise<void> {
  await prisma.company.update({
    where: { id: ctx.companyId },
    data: { onboardedAt: new Date() },
  });

  await recordAudit({
    action: 'company.onboarded',
    companyId: ctx.companyId,
    actorId: ctx.membershipId,
    entityType: 'company',
    entityId: ctx.companyId,
  });
}

/** Painel "Resumo da empresa" — números reais, sem estimativa. */
export async function getCompanyOverview(ctx: AuthContext) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    activeMembers,
    activeProjects,
    openTasks,
    overdueTasks,
    completedLast30,
    upcomingMeetings,
    unreadAnnouncements,
    storageUsed,
  ] = await Promise.all([
    prisma.membership.count({ where: { companyId: ctx.companyId, status: 'ACTIVE' } }),
    prisma.project.count({ where: { companyId: ctx.companyId, status: 'ACTIVE' } }),
    prisma.task.count({
      where: { companyId: ctx.companyId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] } },
    }),
    prisma.task.count({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
        dueAt: { lt: startOfDay },
      },
    }),
    prisma.task.count({
      where: { companyId: ctx.companyId, status: 'DONE', completedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.meeting.count({
      where: { companyId: ctx.companyId, status: 'SCHEDULED', startsAt: { gte: now } },
    }),
    prisma.announcement.count({
      where: {
        companyId: ctx.companyId,
        publishedAt: { not: null, lte: now },
        reads: { none: { membershipId: ctx.membershipId } },
      },
    }),
    prisma.fileObject.aggregate({
      where: { companyId: ctx.companyId, deletedAt: null },
      _sum: { sizeBytes: true },
    }),
  ]);

  const meetingsToday = await prisma.meeting.count({
    where: {
      companyId: ctx.companyId,
      status: { in: ['SCHEDULED', 'LIVE'] },
      startsAt: { gte: startOfDay, lt: endOfDay },
    },
  });

  return {
    activeMembers,
    activeProjects,
    openTasks,
    overdueTasks,
    completedLast30,
    upcomingMeetings,
    meetingsToday,
    unreadAnnouncements,
    storageBytes: storageUsed._sum.sizeBytes ?? 0,
  };
}

export async function ensureSlugAvailable(name: string): Promise<void> {
  const existing = await prisma.company.findUnique({ where: { slug: slugify(name) }, select: { id: true } });
  if (existing) throw new ConflictError('Já existe uma empresa com esse nome.');
}

export function validateCompanyName(name: string): void {
  if (slugify(name).length < 2) {
    throw new ValidationError('Informe um nome de empresa válido.');
  }
}
