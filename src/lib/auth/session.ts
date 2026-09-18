/**
 * Sessões opacas persistidas em banco.
 *
 * Optamos por sessão em banco em vez de JWT stateless porque o produto precisa
 * de: revogação imediata (desligar um funcionário corta o acesso na hora),
 * listagem de dispositivos ativos, e troca de empresa ativa sem novo login.
 * O custo é uma query indexada por request — aceitável e cacheável.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/lib/env';
import { generateToken, hashToken } from './tokens';

export const SESSION_COOKIE = 'nexora_session';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: env.isProduction,
};

export interface CreateSessionInput {
  userId: string;
  companyId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function createSession(input: CreateSessionInput): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash: hashToken(token),
      companyId: input.companyId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, { ...COOKIE_OPTIONS, expires: expiresAt });
  return token;
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Sessão válida + usuário, ou null. Não lança — quem decide é o guard. */
export async function readSession() {
  const token = await getSessionToken();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  if (session.user.deletedAt) return null;

  return session;
}

/** Atualiza a empresa ativa da sessão (troca de tenant). */
export async function setActiveCompany(sessionId: string, companyId: string): Promise<void> {
  await prisma.session.update({ where: { id: sessionId }, data: { companyId } });
}

/** Marca atividade; usado com throttle para não escrever a cada request. */
export async function touchSession(sessionId: string, lastActivityAt: Date): Promise<void> {
  const FIVE_MINUTES = 5 * 60 * 1000;
  if (Date.now() - lastActivityAt.getTime() < FIVE_MINUTES) return;
  await prisma.session
    .update({ where: { id: sessionId }, data: { lastActivityAt: new Date() } })
    .catch(() => undefined);
}

export async function destroySession(): Promise<void> {
  const token = await getSessionToken();
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  if (!token) return;
  await prisma.session
    .updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
}

/** Revoga todas as sessões de um usuário (troca de senha, desligamento). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}
