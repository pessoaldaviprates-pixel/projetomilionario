'use server';

/**
 * Server Actions de autenticação.
 *
 * Usamos Server Actions (e não fetch no cliente) para os formulários de conta:
 * o segredo nunca sai do servidor, o cookie de sessão é definido na própria
 * resposta e o formulário continua funcionando sem JavaScript.
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@/lib/validation/schemas';
import { formatZodIssues } from '@/lib/http/api';
import { AppError } from '@/lib/http/errors';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { destroySession } from '@/lib/auth/session';
import {
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from '@/server/services/auth.service';
import { getUserContext } from '@/lib/auth/context';
import { acceptInvitation } from '@/server/services/members.service';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/lib/env';

export interface ActionState {
  ok: boolean;
  message?: string;
  fields?: Record<string, string>;
  /** Exibido apenas em desenvolvimento com MAIL_DRIVER=console. */
  devLink?: string;
}

async function requestMeta() {
  const headerList = await headers();
  return {
    ipAddress: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: headerList.get('user-agent'),
  };
}

function toState(error: unknown): ActionState {
  if (error instanceof ZodError) {
    return { ok: false, message: 'Confira os campos destacados.', fields: formatZodIssues(error) };
  }
  if (error instanceof AppError) {
    return { ok: false, message: error.message, fields: error.details as Record<string, string> | undefined };
  }
  console.error('[auth action] erro inesperado:', error);
  return { ok: false, message: 'Não foi possível concluir. Tente novamente.' };
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const meta = await requestMeta();

  try {
    await enforceRateLimit('register', meta.ipAddress ?? 'anon');

    const parsed = registerSchema.parse({
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      acceptTerms: formData.get('acceptTerms') === 'on' || formData.get('acceptTerms') === 'true',
    });

    const result = await registerUser(parsed, meta);

    // Em desenvolvimento devolvemos o link para permitir testar sem provedor de e-mail.
    const devLink =
      !env.isProduction && result.verificationToken
        ? `/verificar-email?token=${encodeURIComponent(result.verificationToken)}`
        : undefined;

    return { ok: true, message: 'Conta criada com sucesso.', devLink };
  } catch (error) {
    // Conta já existente não é revelada: respondemos como sucesso genérico.
    if (error instanceof AppError && error.code === 'email_taken') {
      return {
        ok: false,
        message: 'Não foi possível criar a conta com este e-mail. Se ele já estiver cadastrado, use "Entrar" ou recupere sua senha.',
        fields: { email: 'Verifique este endereço.' },
      };
    }
    return toState(error);
  }
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const meta = await requestMeta();
  let destination = '/dashboard';

  try {
    await enforceRateLimit('login', meta.ipAddress ?? 'anon');

    const parsed = loginSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
      remember: formData.get('remember') === 'on',
    });

    const { userId } = await loginUser(parsed, meta);

    // Convite pendente no fluxo: aceita logo após autenticar.
    const inviteToken = formData.get('inviteToken');
    if (typeof inviteToken === 'string' && inviteToken) {
      await acceptInvitation(userId, inviteToken).catch(() => undefined);
    }

    const membershipCount = await prisma.membership.count({ where: { userId, status: 'ACTIVE' } });
    destination = membershipCount === 0 ? '/onboarding' : '/dashboard';
  } catch (error) {
    return toState(error);
  }

  // `redirect` lança por design — precisa ficar fora do try/catch.
  redirect(destination);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const meta = await requestMeta();

  try {
    await enforceRateLimit('passwordReset', meta.ipAddress ?? 'anon');
    const parsed = forgotPasswordSchema.parse({ email: formData.get('email') });
    await requestPasswordReset(parsed.email, meta);

    // Resposta idêntica exista ou não a conta — não vazamos quem é cliente.
    return {
      ok: true,
      message: 'Se existir uma conta com este e-mail, enviamos as instruções de recuperação.',
    };
  } catch (error) {
    return toState(error);
  }
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const meta = await requestMeta();

  try {
    const parsed = resetPasswordSchema.parse({
      token: formData.get('token'),
      password: formData.get('password'),
    });
    await resetPassword(parsed.token, parsed.password, meta);
    return { ok: true, message: 'Senha redefinida. Você já pode entrar.' };
  } catch (error) {
    return toState(error);
  }
}

export async function acceptInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getUserContext();
    if (!ctx) return { ok: false, message: 'Entre na sua conta para aceitar o convite.' };

    const token = String(formData.get('token') ?? '');
    await acceptInvitation(ctx.userId, token);
  } catch (error) {
    return toState(error);
  }

  redirect('/dashboard');
}
