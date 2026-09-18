/**
 * Pessoas da empresa (memberships).
 *
 * Um ponto de segurança importante: desativar alguém revoga as sessões do
 * usuário imediatamente se aquela era a única empresa dele. Não basta marcar
 * no banco — quem já está logado tem que perder o acesso na hora.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, scoped, scopedId } from '@/lib/db/tenant';
import { auditFromContext } from '@/lib/audit';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { expiresIn, generateToken, hashToken, TOKEN_TTL } from '@/lib/auth/tokens';
import { sendMail } from '@/lib/mail';
import { invitationMail } from '@/lib/mail/templates';
import { revokeAllSessions } from '@/lib/auth/session';
import { assertSeatAvailable } from '@/lib/billing/subscription';
import { notify } from './notifications.service';
import type { AuthContext } from '@/lib/auth/context';
import type { MembershipStatus } from '@/generated/prisma/enums';

export interface MemberFilters {
  search?: string;
  departmentId?: string;
  roleId?: string;
  status?: MembershipStatus;
}

export async function listMembers(ctx: AuthContext, filters: MemberFilters = {}) {
  assertPermission(ctx, 'users.view');

  const search = filters.search?.trim();

  return prisma.membership.findMany({
    where: {
      ...scoped(ctx),
      ...(filters.status ? { status: filters.status } : { status: { not: 'DEACTIVATED' } }),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.roleId ? { roleId: filters.roleId } : {}),
      ...(search
        ? {
            OR: [
              { user: { name: { contains: search, mode: 'insensitive' as const } } },
              { user: { email: { contains: search, mode: 'insensitive' as const } } },
              { jobTitle: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ role: { rank: 'asc' } }, { user: { name: 'asc' } }],
    select: {
      id: true,
      jobTitle: true,
      status: true,
      presence: true,
      isOwner: true,
      lastSeenAt: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      role: { select: { id: true, name: true, color: true, slug: true } },
      department: { select: { id: true, name: true, color: true } },
      manager: { select: { id: true, user: { select: { name: true } } } },
      _count: { select: { assignedTasks: true, projectMemberships: true } },
    },
  });
}

/** Lista enxuta para seletores (menções, responsáveis, participantes). */
export async function listMemberOptions(ctx: AuthContext) {
  return prisma.membership.findMany({
    where: { ...scoped(ctx), status: 'ACTIVE' },
    orderBy: { user: { name: 'asc' } },
    select: {
      id: true,
      user: { select: { name: true, email: true, avatarUrl: true } },
      role: { select: { name: true, color: true } },
    },
  });
}

export async function getMember(ctx: AuthContext, membershipId: string) {
  assertPermission(ctx, 'users.view');

  const member = await prisma.membership.findFirst({
    where: { id: membershipId, companyId: ctx.companyId },
    select: {
      id: true,
      jobTitle: true,
      status: true,
      presence: true,
      isOwner: true,
      joinedAt: true,
      lastSeenAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true, lastLoginAt: true } },
      role: { select: { id: true, name: true, color: true, permissions: true } },
      department: { select: { id: true, name: true, color: true } },
      manager: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
      reports: {
        where: { status: 'ACTIVE' },
        select: { id: true, user: { select: { name: true, avatarUrl: true } }, role: { select: { name: true } } },
      },
      projectMemberships: {
        select: { project: { select: { id: true, name: true, color: true, status: true, progress: true } } },
        take: 10,
      },
    },
  });

  if (!member) throw new NotFoundError('Funcionário não encontrado.');

  const [openTasks, completedTasks] = await Promise.all([
    prisma.task.count({
      where: { companyId: ctx.companyId, assigneeId: membershipId, deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] } },
    }),
    prisma.task.count({ where: { companyId: ctx.companyId, assigneeId: membershipId, status: 'DONE' } }),
  ]);

  return { ...member, stats: { openTasks, completedTasks } };
}

export interface InviteInput {
  email: string;
  roleId?: string;
  departmentId?: string;
}

export interface InviteResult {
  email: string;
  status: 'invited' | 'already_member' | 'already_invited';
  /** Disponível com MAIL_DRIVER=console para permitir teste ponta a ponta. */
  token?: string;
}

export async function inviteMembers(ctx: AuthContext, invites: InviteInput[]): Promise<InviteResult[]> {
  assertPermission(ctx, 'users.invite');

  const results: InviteResult[] = [];

  for (const invite of invites) {
    await assertSeatAvailable(ctx.companyId);

    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true },
    });

    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: { userId_companyId: { userId: existingUser.id, companyId: ctx.companyId } },
        select: { id: true, status: true },
      });

      if (existingMembership && existingMembership.status !== 'DEACTIVATED') {
        results.push({ email: invite.email, status: 'already_member' });
        continue;
      }
    }

    const roleId = invite.roleId ?? (await resolveDefaultRoleId(ctx.companyId));
    const token = generateToken();

    // Reconvite substitui o convite anterior em vez de acumular tokens válidos.
    await prisma.invitation.upsert({
      where: { companyId_email: { companyId: ctx.companyId, email: invite.email } },
      create: {
        companyId: ctx.companyId,
        email: invite.email,
        roleId,
        departmentId: invite.departmentId ?? null,
        invitedById: ctx.membershipId,
        tokenHash: hashToken(token),
        expiresAt: expiresIn(TOKEN_TTL.invitation),
        status: 'PENDING',
      },
      update: {
        roleId,
        departmentId: invite.departmentId ?? null,
        invitedById: ctx.membershipId,
        tokenHash: hashToken(token),
        expiresAt: expiresIn(TOKEN_TTL.invitation),
        status: 'PENDING',
      },
    });

    await sendMail(invitationMail(invite.email, ctx.company.name, ctx.user.name, token)).catch((error) => {
      console.error('[members] falha ao enviar convite:', error);
    });

    await auditFromContext(ctx, {
      action: 'member.invited',
      entityType: 'invitation',
      metadata: { email: invite.email },
    });

    results.push({ email: invite.email, status: 'invited', token });
  }

  return results;
}

async function resolveDefaultRoleId(companyId: string): Promise<string> {
  const role = await prisma.role.findFirst({
    where: { companyId, isDefault: true, isActive: true },
    select: { id: true },
  });
  if (role) return role.id;

  const fallback = await prisma.role.findFirst({
    where: { companyId, isActive: true },
    orderBy: { rank: 'desc' },
    select: { id: true },
  });
  if (!fallback) throw new ValidationError('A empresa não possui cargos configurados.');
  return fallback.id;
}

/** Aceita um convite e cria o vínculo. Chamado após o usuário autenticar. */
export async function acceptInvitation(userId: string, token: string): Promise<{ companyId: string }> {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { company: { select: { id: true, name: true, deletedAt: true } } },
  });

  if (!invitation || invitation.status !== 'PENDING') {
    throw new ValidationError('Convite inválido ou já utilizado.');
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    throw new ValidationError('Convite expirado. Peça um novo para o administrador.');
  }
  if (invitation.company.deletedAt) throw new NotFoundError('Empresa não encontrada.');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user) throw new NotFoundError('Usuário não encontrado.');

  // O convite é nominal: só vale para o e-mail que foi convidado.
  if (user.email !== invitation.email) {
    throw new ValidationError('Este convite foi enviado para outro endereço de e-mail.');
  }

  const roleId = invitation.roleId ?? (await resolveDefaultRoleId(invitation.companyId));

  const membership = await prisma.membership.upsert({
    where: { userId_companyId: { userId, companyId: invitation.companyId } },
    create: {
      userId,
      companyId: invitation.companyId,
      roleId,
      departmentId: invitation.departmentId,
      status: 'ACTIVE',
      invitedAt: invitation.createdAt,
    },
    update: { status: 'ACTIVE', roleId, departmentId: invitation.departmentId, deactivatedAt: null },
    select: { id: true },
  });

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  });

  // Entra automaticamente nos canais públicos — senão a pessoa chega num vazio.
  const publicChannels = await prisma.channel.findMany({
    where: { companyId: invitation.companyId, kind: 'PUBLIC', isArchived: false },
    select: { id: true },
  });

  if (publicChannels.length > 0) {
    await prisma.channelMember.createMany({
      data: publicChannels.map((channel) => ({ channelId: channel.id, membershipId: membership.id })),
      skipDuplicates: true,
    });
  }

  await recordJoin(invitation.companyId, membership.id, user.email);

  return { companyId: invitation.companyId };
}

async function recordJoin(companyId: string, membershipId: string, email: string): Promise<void> {
  const { recordAudit } = await import('@/lib/audit');
  await recordAudit({
    action: 'member.joined',
    companyId,
    actorId: membershipId,
    actorEmail: email,
    entityType: 'membership',
    entityId: membershipId,
  });
}

export interface UpdateMemberInput {
  jobTitle?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
  roleId?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}

export async function updateMember(
  ctx: AuthContext,
  membershipId: string,
  input: UpdateMemberInput,
): Promise<void> {
  const member = await prisma.membership.findFirst({
    where: { id: membershipId, companyId: ctx.companyId },
    select: { id: true, isOwner: true, userId: true, roleId: true, status: true },
  });
  if (!member) throw new NotFoundError('Funcionário não encontrado.');

  if (input.roleId !== undefined) assertPermission(ctx, 'roles.assign');
  if (input.status !== undefined) assertPermission(ctx, 'users.deactivate');
  if (input.jobTitle !== undefined || input.departmentId !== undefined || input.managerId !== undefined) {
    assertPermission(ctx, 'users.update');
  }

  // O dono do tenant não pode ser rebaixado nem desativado por outra pessoa —
  // caso contrário um administrador poderia tomar a empresa.
  if (member.isOwner && (input.roleId !== undefined || input.status !== undefined)) {
    throw new ConflictError('O proprietário da empresa não pode ter o cargo ou o acesso alterados.');
  }

  if (input.roleId) {
    const role = await prisma.role.findFirst({ where: scopedId(ctx, input.roleId), select: { id: true } });
    if (!role) throw new NotFoundError('Cargo não encontrado.');
  }

  if (input.departmentId) {
    const department = await prisma.department.findFirst({
      where: scopedId(ctx, input.departmentId),
      select: { id: true },
    });
    if (!department) throw new NotFoundError('Departamento não encontrado.');
  }

  if (input.managerId) {
    if (input.managerId === membershipId) {
      throw new ValidationError('Uma pessoa não pode ser o próprio gestor.');
    }
    const manager = await prisma.membership.findFirst({
      where: { id: input.managerId, companyId: ctx.companyId },
      select: { id: true },
    });
    if (!manager) throw new NotFoundError('Gestor não encontrado.');
    if (await createsCycle(ctx.companyId, membershipId, input.managerId)) {
      throw new ValidationError('Essa hierarquia criaria um ciclo no organograma.');
    }
  }

  await prisma.membership.update({
    where: { id: membershipId },
    data: {
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId } : {}),
      ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
      ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
      ...(input.status !== undefined
        ? {
            status: input.status,
            deactivatedAt: input.status === 'DEACTIVATED' ? new Date() : null,
            presence: input.status === 'ACTIVE' ? undefined : 'OFFLINE',
          }
        : {}),
    },
  });

  // Perder o acesso precisa valer para quem já está logado, não só no próximo login.
  if (input.status === 'DEACTIVATED' || input.status === 'SUSPENDED') {
    const otherCompanies = await prisma.membership.count({
      where: { userId: member.userId, status: 'ACTIVE', companyId: { not: ctx.companyId } },
    });
    if (otherCompanies === 0) await revokeAllSessions(member.userId);
  }

  await auditFromContext(ctx, {
    action:
      input.status === 'DEACTIVATED'
        ? 'member.deactivated'
        : input.roleId
          ? 'member.role_changed'
          : 'member.updated',
    entityType: 'membership',
    entityId: membershipId,
    severity: input.status === 'DEACTIVATED' || input.roleId ? 'WARNING' : 'INFO',
    metadata: { ...input },
  });

  if (input.roleId && input.roleId !== member.roleId) {
    const role = await prisma.role.findUnique({ where: { id: input.roleId }, select: { name: true } });
    await notify({
      companyId: ctx.companyId,
      recipientIds: [membershipId],
      actorId: ctx.membershipId,
      kind: 'SYSTEM',
      title: 'Seu cargo foi atualizado',
      body: `Agora você é ${role?.name ?? 'membro'} na ${ctx.company.name}.`,
      href: '/configuracoes/perfil',
    });
  }
}

/** Impede ciclos no organograma (A reporta a B que reporta a A). */
async function createsCycle(companyId: string, membershipId: string, managerId: string): Promise<boolean> {
  let current: string | null = managerId;
  const visited = new Set<string>();

  while (current) {
    if (current === membershipId) return true;
    if (visited.has(current)) return true;
    visited.add(current);

    const node: { managerId: string | null } | null = await prisma.membership.findFirst({
      where: { id: current, companyId },
      select: { managerId: true },
    });
    current = node?.managerId ?? null;
  }

  return false;
}

/** Organograma completo da empresa, já em forma de árvore. */
export interface OrgNode {
  id: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  roleName: string;
  roleColor: string;
  departmentName: string | null;
  children: OrgNode[];
}

export async function getOrgChart(ctx: AuthContext): Promise<OrgNode[]> {
  assertPermission(ctx, 'users.view');

  const members = await prisma.membership.findMany({
    where: { ...scoped(ctx), status: 'ACTIVE' },
    orderBy: [{ role: { rank: 'asc' } }, { user: { name: 'asc' } }],
    select: {
      id: true,
      managerId: true,
      jobTitle: true,
      user: { select: { name: true, avatarUrl: true } },
      role: { select: { name: true, color: true } },
      department: { select: { name: true } },
    },
  });

  const nodes = new Map<string, OrgNode>();
  for (const member of members) {
    nodes.set(member.id, {
      id: member.id,
      name: member.user.name,
      avatarUrl: member.user.avatarUrl,
      jobTitle: member.jobTitle,
      roleName: member.role.name,
      roleColor: member.role.color,
      departmentName: member.department?.name ?? null,
      children: [],
    });
  }

  const roots: OrgNode[] = [];
  for (const member of members) {
    const node = nodes.get(member.id)!;
    const parent = member.managerId ? nodes.get(member.managerId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export async function updatePresence(
  companyId: string,
  membershipId: string,
  presence: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE',
): Promise<void> {
  await prisma.membership.updateMany({
    where: { id: membershipId, companyId },
    data: { presence, lastSeenAt: new Date() },
  });
}
