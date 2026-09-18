/**
 * Serviço de autenticação.
 *
 * Princípios aplicados:
 *  - Enumeração de contas: nem cadastro nem recuperação revelam se um e-mail
 *    existe. As respostas são idênticas nos dois casos.
 *  - Bloqueio progressivo: falhas consecutivas travam a conta temporariamente,
 *    somado ao rate limit por IP.
 *  - Troca de senha revoga todas as outras sessões.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, revokeAllSessions } from '@/lib/auth/session';
import { expiresIn, generateToken, hashToken, TOKEN_TTL } from '@/lib/auth/tokens';
import { recordAudit } from '@/lib/audit';
import { sendMail } from '@/lib/mail';
import { emailVerificationMail, passwordResetMail } from '@/lib/mail/templates';
import { AppError, UnauthorizedError, ValidationError } from '@/lib/http/errors';
import { isUniqueConstraintError } from '@/lib/db/errors';

const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResult {
  userId: string;
  /** Presente apenas com MAIL_DRIVER=console, para facilitar o teste local. */
  verificationToken?: string;
}

export async function registerUser(input: RegisterInput, meta: RequestMeta): Promise<RegisterResult> {
  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: { id: true, name: true, email: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      // E-mail já cadastrado. Não confirmamos isso ao cliente: a rota responde
      // com sucesso genérico e enviamos um e-mail avisando da tentativa.
      throw new AppError('EMAIL_TAKEN', 409, 'email_taken');
    }
    throw error;
  }

  const token = await issueEmailVerification(user.id, user.email, user.name);

  await createSession({ userId: user.id, ipAddress: meta.ipAddress, userAgent: meta.userAgent });
  await recordAudit({
    action: 'auth.register',
    actorEmail: user.email,
    entityType: 'user',
    entityId: user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { userId: user.id, verificationToken: token };
}

export async function issueEmailVerification(userId: string, email: string, name: string): Promise<string> {
  const token = generateToken();

  await prisma.verificationToken.create({
    data: {
      userId,
      email,
      tokenHash: hashToken(token),
      purpose: 'EMAIL_VERIFICATION',
      expiresAt: expiresIn(TOKEN_TTL.emailVerification),
    },
  });

  await sendMail(emailVerificationMail(email, name, token)).catch((error) => {
    console.error('[auth] falha ao enviar verificação de e-mail:', error);
  });

  return token;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function loginUser(input: LoginInput, meta: RequestMeta): Promise<{ userId: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Mesma mensagem para e-mail inexistente e senha errada.
  const genericFailure = new UnauthorizedError('E-mail ou senha incorretos.');

  if (!user || user.deletedAt) {
    // Gasta tempo comparável ao caminho feliz para não vazar por timing.
    await verifyPassword(input.password, null);
    await recordAudit({
      action: 'auth.login_failed',
      actorEmail: input.email,
      severity: 'WARNING',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { reason: 'user_not_found' },
    });
    throw genericFailure;
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new UnauthorizedError(
      `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minutes} min.`,
    );
  }

  const valid = await verifyPassword(input.password, user.passwordHash);

  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    const shouldLock = failedLoginCount >= MAX_FAILED_LOGINS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
      },
    });

    await recordAudit({
      action: 'auth.login_failed',
      actorEmail: user.email,
      entityType: 'user',
      entityId: user.id,
      severity: shouldLock ? 'CRITICAL' : 'WARNING',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { attempts: failedLoginCount, locked: shouldLock },
    });

    throw genericFailure;
  }

  // Empresa ativa: a última usada continua sendo a primeira opção no próximo login.
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: 'ACTIVE', company: { deletedAt: null } },
    orderBy: { joinedAt: 'asc' },
    select: { companyId: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await createSession({
    userId: user.id,
    companyId: membership?.companyId ?? null,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  await recordAudit({
    action: 'auth.login',
    companyId: membership?.companyId ?? null,
    actorEmail: user.email,
    entityType: 'user',
    entityId: user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { userId: user.id };
}

export async function requestPasswordReset(email: string, meta: RequestMeta): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, deletedAt: true } });

  await recordAudit({
    action: 'auth.password_reset_requested',
    actorEmail: email,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { found: Boolean(user) },
  });

  // Conta inexistente: encerra em silêncio. O chamador responde sucesso de
  // qualquer forma, então quem está sondando não descobre nada.
  if (!user || user.deletedAt) return;

  // Invalida pedidos anteriores ainda abertos.
  await prisma.verificationToken.updateMany({
    where: { userId: user.id, purpose: 'PASSWORD_RESET', usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateToken();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      email: user.email,
      tokenHash: hashToken(token),
      purpose: 'PASSWORD_RESET',
      expiresAt: expiresIn(TOKEN_TTL.passwordReset),
    },
  });

  await sendMail(passwordResetMail(user.email, user.name, token)).catch((error) => {
    console.error('[auth] falha ao enviar reset de senha:', error);
  });
}

export async function resetPassword(token: string, newPassword: string, meta: RequestMeta): Promise<void> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record || !record.user || record.purpose !== 'PASSWORD_RESET') {
    throw new ValidationError('Link inválido ou já utilizado.');
  }
  if (record.usedAt) throw new ValidationError('Este link já foi utilizado.');
  if (record.expiresAt.getTime() < Date.now()) throw new ValidationError('Link expirado. Solicite um novo.');

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user.id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  // Senha trocada significa possível comprometimento: derruba tudo.
  await revokeAllSessions(record.user.id);

  await recordAudit({
    action: 'auth.password_changed',
    actorEmail: record.user.email,
    entityType: 'user',
    entityId: record.user.id,
    severity: 'WARNING',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export async function verifyEmail(token: string): Promise<{ email: string }> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record || !record.user || record.purpose !== 'EMAIL_VERIFICATION') {
    throw new ValidationError('Link de verificação inválido.');
  }
  if (record.expiresAt.getTime() < Date.now()) throw new ValidationError('Link expirado. Solicite um novo e-mail.');

  if (!record.usedAt) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.user.id }, data: { emailVerifiedAt: new Date() } }),
      prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    await recordAudit({
      action: 'auth.email_verified',
      actorEmail: record.user.email,
      entityType: 'user',
      entityId: record.user.id,
    });
  }

  return { email: record.user.email };
}
