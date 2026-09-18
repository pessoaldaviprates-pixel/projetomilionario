/**
 * Departamentos e grupos/equipes.
 * Formam a estrutura organizacional usada pelo organograma e pelos avisos
 * segmentados por público-alvo.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, scoped, scopedId } from '@/lib/db/tenant';
import { auditFromContext } from '@/lib/audit';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { uniqueSlug } from '@/lib/utils/slug';
import type { AuthContext } from '@/lib/auth/context';

export interface DepartmentInput {
  name: string;
  description?: string;
  color?: string;
  parentId?: string | null;
  leadId?: string | null;
}

export async function listDepartments(ctx: AuthContext) {
  assertPermission(ctx, 'departments.view');

  return prisma.department.findMany({
    where: scoped(ctx),
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, slug: true, description: true, color: true, parentId: true,
      lead: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
      _count: { select: { members: true, groups: true, children: true } },
    },
  });
}

export async function createDepartment(ctx: AuthContext, input: DepartmentInput) {
  assertPermission(ctx, 'departments.manage');

  const slug = await uniqueSlug(input.name, async (candidate) => {
    const existing = await prisma.department.findUnique({
      where: { companyId_slug: { companyId: ctx.companyId, slug: candidate } },
      select: { id: true },
    });
    return existing !== null;
  }, 'departamento');

  const department = await prisma.department.create({
    data: {
      companyId: ctx.companyId,
      name: input.name,
      slug,
      description: input.description || null,
      color: input.color ?? '#2E7DFF',
      parentId: input.parentId ?? null,
      leadId: input.leadId ?? null,
    },
  });

  await auditFromContext(ctx, {
    action: 'department.created',
    entityType: 'department',
    entityId: department.id,
    metadata: { name: department.name },
  });

  return department;
}

export async function updateDepartment(ctx: AuthContext, departmentId: string, input: Partial<DepartmentInput>) {
  assertPermission(ctx, 'departments.manage');

  const current = await prisma.department.findFirst({ where: scopedId(ctx, departmentId), select: { id: true } });
  if (!current) throw new NotFoundError('Departamento não encontrado.');

  if (input.parentId === departmentId) {
    throw new ValidationError('Um departamento não pode ser subordinado a si mesmo.');
  }

  const department = await prisma.department.update({
    where: { id: departmentId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
    },
  });

  await auditFromContext(ctx, { action: 'department.updated', entityType: 'department', entityId: departmentId });
  return department;
}

export async function deleteDepartment(ctx: AuthContext, departmentId: string): Promise<void> {
  assertPermission(ctx, 'departments.manage');

  const department = await prisma.department.findFirst({
    where: scopedId(ctx, departmentId),
    select: { id: true, name: true, _count: { select: { members: true, children: true } } },
  });
  if (!department) throw new NotFoundError('Departamento não encontrado.');

  if (department._count.children > 0) {
    throw new ConflictError('Este departamento possui subdepartamentos. Remova-os primeiro.');
  }

  // Pessoas ficam sem departamento (SetNull no schema), não são excluídas.
  await prisma.department.delete({ where: { id: departmentId } });

  await auditFromContext(ctx, {
    action: 'department.deleted',
    entityType: 'department',
    entityId: departmentId,
    severity: 'WARNING',
    metadata: { name: department.name, membersAffected: department._count.members },
  });
}

export interface GroupInput {
  name: string;
  description?: string;
  color?: string;
  departmentId?: string | null;
  isPrivate?: boolean;
  memberIds?: string[];
}

export async function listGroups(ctx: AuthContext) {
  assertPermission(ctx, 'groups.view');

  return prisma.group.findMany({
    where: {
      ...scoped(ctx),
      // Grupos privados só aparecem para quem participa.
      OR: [{ isPrivate: false }, { members: { some: { membershipId: ctx.membershipId } } }],
    },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, slug: true, description: true, color: true, isPrivate: true,
      department: { select: { id: true, name: true, color: true } },
      members: {
        take: 8,
        select: { membership: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } } },
      },
      _count: { select: { members: true } },
    },
  });
}

export async function createGroup(ctx: AuthContext, input: GroupInput) {
  assertPermission(ctx, 'groups.manage');

  const slug = await uniqueSlug(input.name, async (candidate) => {
    const existing = await prisma.group.findUnique({
      where: { companyId_slug: { companyId: ctx.companyId, slug: candidate } },
      select: { id: true },
    });
    return existing !== null;
  }, 'grupo');

  const memberIds = Array.from(new Set([ctx.membershipId, ...(input.memberIds ?? [])]));
  const valid = await prisma.membership.findMany({
    where: { id: { in: memberIds }, companyId: ctx.companyId, status: 'ACTIVE' },
    select: { id: true },
  });

  const group = await prisma.group.create({
    data: {
      companyId: ctx.companyId,
      name: input.name,
      slug,
      description: input.description || null,
      color: input.color ?? '#2E7DFF',
      departmentId: input.departmentId ?? null,
      isPrivate: input.isPrivate ?? false,
      members: {
        create: valid.map((member) => ({ membershipId: member.id, isLead: member.id === ctx.membershipId })),
      },
    },
  });

  return group;
}

export async function updateGroupMembers(ctx: AuthContext, groupId: string, memberIds: string[]): Promise<void> {
  assertPermission(ctx, 'groups.manage');

  const group = await prisma.group.findFirst({ where: scopedId(ctx, groupId), select: { id: true } });
  if (!group) throw new NotFoundError('Grupo não encontrado.');

  const valid = await prisma.membership.findMany({
    where: { id: { in: memberIds }, companyId: ctx.companyId, status: 'ACTIVE' },
    select: { id: true },
  });
  const validIds = valid.map((m) => m.id);

  await prisma.$transaction([
    prisma.groupMember.deleteMany({ where: { groupId, membershipId: { notIn: validIds } } }),
    prisma.groupMember.createMany({
      data: validIds.map((membershipId) => ({ groupId, membershipId })),
      skipDuplicates: true,
    }),
  ]);
}

export async function deleteGroup(ctx: AuthContext, groupId: string): Promise<void> {
  assertPermission(ctx, 'groups.manage');

  const group = await prisma.group.findFirst({ where: scopedId(ctx, groupId), select: { id: true } });
  if (!group) throw new NotFoundError('Grupo não encontrado.');

  await prisma.group.delete({ where: { id: groupId } });
}
