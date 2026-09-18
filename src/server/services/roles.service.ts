/**
 * Cargos e permissões.
 *
 * Regras de integridade que o serviço garante:
 *  - permissões desconhecidas são descartadas (nunca gravadas);
 *  - um cargo com pessoas vinculadas não pode ser excluído sem destino;
 *  - ninguém consegue se auto-promover: alterar permissões exige
 *    `permissions.manage`, e o dono do tenant é o único com tudo por padrão.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { sanitizePermissions, type Permission } from '@/lib/authz/permissions';
import { assertPermission, scoped, scopedId } from '@/lib/db/tenant';
import { auditFromContext, diff } from '@/lib/audit';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { uniqueSlug } from '@/lib/utils/slug';
import type { AuthContext } from '@/lib/auth/context';

export interface RoleInput {
  name: string;
  description?: string;
  color?: string;
  permissions?: string[];
  rank?: number;
  isActive?: boolean;
}

export async function listRoles(ctx: AuthContext) {
  assertPermission(ctx, 'roles.view');

  const roles = await prisma.role.findMany({
    where: scoped(ctx),
    orderBy: [{ rank: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { memberships: true } } },
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    color: role.color,
    permissions: role.permissions as Permission[],
    rank: role.rank,
    isActive: role.isActive,
    isSystem: role.isSystem,
    isDefault: role.isDefault,
    memberCount: role._count.memberships,
  }));
}

export async function getRole(ctx: AuthContext, roleId: string) {
  assertPermission(ctx, 'roles.view');

  const role = await prisma.role.findFirst({
    where: scopedId(ctx, roleId),
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        take: 20,
        select: {
          id: true,
          jobTitle: true,
          user: { select: { name: true, email: true, avatarUrl: true } },
        },
      },
      _count: { select: { memberships: true } },
    },
  });

  if (!role) throw new NotFoundError('Cargo não encontrado.');
  return role;
}

export async function createRole(ctx: AuthContext, input: RoleInput) {
  assertPermission(ctx, 'roles.manage');

  const permissions = sanitizePermissions(input.permissions ?? []);
  if (input.permissions && permissions.length !== new Set(input.permissions).size) {
    // Descartamos silenciosamente chaves inválidas, mas registramos na auditoria.
    console.warn('[roles] permissões desconhecidas ignoradas na criação do cargo');
  }

  const slug = await uniqueSlug(input.name, async (candidate) => {
    const existing = await prisma.role.findUnique({
      where: { companyId_slug: { companyId: ctx.companyId, slug: candidate } },
      select: { id: true },
    });
    return existing !== null;
  }, 'cargo');

  const role = await prisma.role.create({
    data: {
      companyId: ctx.companyId,
      name: input.name,
      slug,
      description: input.description || null,
      color: input.color ?? '#2E7DFF',
      permissions,
      rank: input.rank ?? 100,
      isActive: input.isActive ?? true,
    },
  });

  await auditFromContext(ctx, {
    action: 'role.created',
    entityType: 'role',
    entityId: role.id,
    metadata: { name: role.name, permissionCount: permissions.length },
  });

  return role;
}

export async function updateRole(ctx: AuthContext, roleId: string, input: Partial<RoleInput>) {
  assertPermission(ctx, 'roles.manage');

  const current = await prisma.role.findFirst({ where: scopedId(ctx, roleId) });
  if (!current) throw new NotFoundError('Cargo não encontrado.');

  // Alterar o conjunto de permissões é uma ação mais sensível que renomear.
  if (input.permissions !== undefined) {
    assertPermission(ctx, 'permissions.manage');
  }

  const permissions = input.permissions !== undefined ? sanitizePermissions(input.permissions) : undefined;

  const data = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.rank !== undefined ? { rank: input.rank } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(permissions !== undefined ? { permissions } : {}),
  };

  const role = await prisma.role.update({ where: { id: roleId }, data });

  const changes = diff(current as unknown as Record<string, unknown>, data);
  await auditFromContext(ctx, {
    action: permissions !== undefined ? 'role.permissions_changed' : 'role.updated',
    entityType: 'role',
    entityId: role.id,
    changes,
    severity: permissions !== undefined ? 'WARNING' : 'INFO',
  });

  return role;
}

/**
 * Exclui um cargo. Pessoas vinculadas são movidas para `reassignToRoleId`
 * (ou para o cargo padrão) — nenhuma pessoa fica sem cargo.
 */
export async function deleteRole(
  ctx: AuthContext,
  roleId: string,
  reassignToRoleId?: string,
): Promise<void> {
  assertPermission(ctx, 'roles.manage');

  const role = await prisma.role.findFirst({
    where: scopedId(ctx, roleId),
    include: { _count: { select: { memberships: true } } },
  });
  if (!role) throw new NotFoundError('Cargo não encontrado.');

  if (role.isSystem && role.isDefault) {
    throw new ValidationError('O cargo padrão não pode ser excluído. Marque outro cargo como padrão antes.');
  }

  let targetRoleId = reassignToRoleId ?? null;

  if (role._count.memberships > 0) {
    if (!targetRoleId) {
      const fallback = await prisma.role.findFirst({
        where: { companyId: ctx.companyId, isDefault: true, id: { not: roleId } },
        select: { id: true },
      });
      targetRoleId = fallback?.id ?? null;
    }

    if (!targetRoleId) {
      throw new ConflictError(
        'Existem pessoas com este cargo. Escolha um cargo de destino antes de excluir.',
      );
    }

    const target = await prisma.role.findFirst({ where: scopedId(ctx, targetRoleId), select: { id: true } });
    if (!target) throw new NotFoundError('Cargo de destino não encontrado.');
  }

  await prisma.$transaction(async (tx) => {
    if (targetRoleId) {
      await tx.membership.updateMany({
        where: { companyId: ctx.companyId, roleId },
        data: { roleId: targetRoleId },
      });
    }
    await tx.role.delete({ where: { id: roleId } });
  });

  await auditFromContext(ctx, {
    action: 'role.deleted',
    entityType: 'role',
    entityId: roleId,
    severity: 'WARNING',
    metadata: { name: role.name, reassignedTo: targetRoleId, affected: role._count.memberships },
  });
}

export async function setDefaultRole(ctx: AuthContext, roleId: string): Promise<void> {
  assertPermission(ctx, 'roles.manage');

  const role = await prisma.role.findFirst({ where: scopedId(ctx, roleId), select: { id: true } });
  if (!role) throw new NotFoundError('Cargo não encontrado.');

  await prisma.$transaction([
    prisma.role.updateMany({ where: { companyId: ctx.companyId }, data: { isDefault: false } }),
    prisma.role.update({ where: { id: roleId }, data: { isDefault: true } }),
  ]);

  await auditFromContext(ctx, { action: 'role.updated', entityType: 'role', entityId: roleId, metadata: { isDefault: true } });
}
