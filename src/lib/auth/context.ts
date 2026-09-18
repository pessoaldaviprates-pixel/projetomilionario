/**
 * Contexto de autenticação e tenant.
 *
 * TODA rota autenticada e TODO service de negócio recebe um `AuthContext`.
 * O contexto carrega o `companyId` resolvido no servidor a partir da sessão —
 * o cliente nunca informa em qual empresa está operando, o que elimina a classe
 * inteira de bugs de "tenant vindo do request".
 */
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { ALL_PERMISSIONS, type Permission } from '@/lib/authz/permissions';
import { readSession, touchSession } from './session';

export interface AuthContext {
  sessionId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    emailVerifiedAt: Date | null;
    isPlatformAdmin: boolean;
    timezone: string;
  };
  /** Presente apenas quando o usuário já pertence a alguma empresa. */
  companyId: string;
  membershipId: string;
  company: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    onboardedAt: Date | null;
  };
  role: { id: string; name: string; slug: string; color: string };
  isOwner: boolean;
  permissions: Set<Permission>;
  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
}

export interface UserContext {
  sessionId: string;
  userId: string;
  user: AuthContext['user'];
  /** Empresas às quais este usuário pertence. */
  memberships: { companyId: string; companyName: string; companySlug: string; logoUrl: string | null }[];
  activeCompanyId: string | null;
}

/**
 * Resolve o usuário logado sem exigir empresa ativa.
 * Usado em onboarding, seleção de empresa e telas de conta.
 */
export const getUserContext = cache(async (): Promise<UserContext | null> => {
  const session = await readSession();
  if (!session) return null;

  void touchSession(session.id, session.lastActivityAt);

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId, status: { in: ['ACTIVE', 'INVITED'] }, company: { deletedAt: null } },
    select: {
      companyId: true,
      company: { select: { name: true, slug: true, logoUrl: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });

  // Empresa ativa: a da sessão, se o vínculo ainda existir; senão a primeira.
  const sessionCompanyValid =
    session.companyId && memberships.some((m) => m.companyId === session.companyId);
  const activeCompanyId = sessionCompanyValid
    ? session.companyId
    : (memberships[0]?.companyId ?? null);

  return {
    sessionId: session.id,
    userId: session.userId,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      avatarUrl: session.user.avatarUrl,
      emailVerifiedAt: session.user.emailVerifiedAt,
      isPlatformAdmin: session.user.isPlatformAdmin,
      timezone: session.user.timezone,
    },
    memberships: memberships.map((m) => ({
      companyId: m.companyId,
      companyName: m.company.name,
      companySlug: m.company.slug,
      logoUrl: m.company.logoUrl,
    })),
    activeCompanyId,
  };
});

/**
 * Contexto completo com empresa ativa e permissões efetivas.
 * Retorna null se não houver sessão OU se o usuário não tiver empresa.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const userContext = await getUserContext();
  if (!userContext || !userContext.activeCompanyId) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId: userContext.userId, companyId: userContext.activeCompanyId } },
    include: {
      role: { select: { id: true, name: true, slug: true, color: true, permissions: true, isActive: true } },
      company: { select: { id: true, name: true, slug: true, logoUrl: true, onboardedAt: true, status: true, deletedAt: true } },
    },
  });

  if (!membership) return null;
  if (membership.status !== 'ACTIVE') return null;
  if (membership.company.deletedAt || membership.company.status === 'CANCELED') return null;

  // O dono do tenant recebe todas as permissões implicitamente. Cargo inativo
  // não concede nada — é a forma de suspender acesso sem apagar o histórico.
  const granted = membership.isOwner
    ? null // null = tudo
    : new Set((membership.role.isActive ? membership.role.permissions : []) as Permission[]);

  const can = (permission: Permission) => granted === null || granted.has(permission);

  return {
    sessionId: userContext.sessionId,
    userId: userContext.userId,
    user: userContext.user,
    companyId: membership.companyId,
    membershipId: membership.id,
    company: {
      id: membership.company.id,
      name: membership.company.name,
      slug: membership.company.slug,
      logoUrl: membership.company.logoUrl,
      onboardedAt: membership.company.onboardedAt,
    },
    role: {
      id: membership.role.id,
      name: membership.role.name,
      slug: membership.role.slug,
      color: membership.role.color,
    },
    isOwner: membership.isOwner,
    // Para o dono, materializamos o catálogo inteiro: a UI consome este Set
    // para decidir o que renderizar e precisa do conjunto efetivo, não de null.
    permissions: granted ?? new Set<Permission>(ALL_PERMISSIONS),
    can,
    canAny: (...permissions: Permission[]) => permissions.some(can),
  };
});

// ── Guards para Server Components / Server Actions ──────────────────────────

export async function requireUser(): Promise<UserContext> {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  return ctx;
}

/** Exige sessão + empresa ativa. Envia para onboarding quem ainda não tem. */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (ctx) return ctx;

  const userCtx = await getUserContext();
  if (!userCtx) redirect('/login');
  redirect('/onboarding');
}

export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctx.can(permission)) redirect('/sem-permissao');
  return ctx;
}

export async function requirePlatformAdmin(): Promise<UserContext> {
  const ctx = await requireUser();
  if (!ctx.user.isPlatformAdmin) redirect('/sem-permissao');
  return ctx;
}
