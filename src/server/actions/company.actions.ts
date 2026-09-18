'use server';

/** Server Actions de empresa: criação, onboarding e convites. */
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { createCompanySchema, inviteMembersSchema, updateCompanySchema } from '@/lib/validation/schemas';
import { formatZodIssues } from '@/lib/http/api';
import { AppError } from '@/lib/http/errors';
import { getUserContext, requireAuth } from '@/lib/auth/context';
import { setActiveCompany } from '@/lib/auth/session';
import { completeOnboarding, createCompany, switchCompany, updateCompany } from '@/server/services/company.service';
import { inviteMembers } from '@/server/services/members.service';
import { env } from '@/lib/env';
import type { ActionState } from './auth.actions';

function toState(error: unknown): ActionState {
  if (error instanceof ZodError) {
    return { ok: false, message: 'Confira os campos destacados.', fields: formatZodIssues(error) };
  }
  if (error instanceof AppError) {
    return { ok: false, message: error.message, fields: error.details as Record<string, string> | undefined };
  }
  console.error('[company action] erro inesperado:', error);
  return { ok: false, message: 'Não foi possível concluir. Tente novamente.' };
}

export async function createCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await getUserContext();
    if (!ctx) return { ok: false, message: 'Sessão expirada. Entre novamente.' };

    const parsed = createCompanySchema.parse({
      name: formData.get('name'),
      segment: formData.get('segment') || undefined,
      sizeBand: formData.get('sizeBand') || undefined,
      goal: formData.get('goal') || undefined,
      website: formData.get('website') || undefined,
    });

    const { companyId } = await createCompany(ctx.userId, parsed);

    // A empresa recém-criada vira a empresa ativa da sessão imediatamente.
    await setActiveCompany(ctx.sessionId, companyId);
  } catch (error) {
    return toState(error);
  }

  redirect('/onboarding/equipe');
}

export interface InviteActionState extends ActionState {
  results?: { email: string; status: string; inviteUrl?: string }[];
}

export async function inviteMembersAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  try {
    const ctx = await requireAuth();

    const emails = String(formData.get('emails') ?? '')
      .split(/[\n,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      return { ok: false, message: 'Informe ao menos um e-mail.' };
    }

    const roleId = formData.get('roleId');
    const parsed = inviteMembersSchema.parse({
      invites: emails.map((email) => ({
        email,
        roleId: typeof roleId === 'string' && roleId ? roleId : undefined,
      })),
    });

    const results = await inviteMembers(ctx, parsed.invites);
    revalidatePath('/funcionarios');

    const invited = results.filter((result) => result.status === 'invited').length;

    return {
      ok: true,
      message:
        invited === 0
          ? 'Nenhum convite novo: essas pessoas já fazem parte da empresa.'
          : `${invited} convite(s) enviado(s).`,
      results: results.map((result) => ({
        email: result.email,
        status: result.status,
        // Em desenvolvimento o link é exibido para permitir testar sem e-mail real.
        inviteUrl:
          !env.isProduction && result.token
            ? `${env.appUrl}/convite?token=${encodeURIComponent(result.token)}`
            : undefined,
      })),
    };
  } catch (error) {
    return toState(error);
  }
}

export async function finishOnboardingAction(): Promise<void> {
  const ctx = await requireAuth();
  await completeOnboarding(ctx);
  redirect('/dashboard');
}

export async function updateCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireAuth();

    const parsed = updateCompanySchema.parse({
      name: formData.get('name') || undefined,
      segment: formData.get('segment') || undefined,
      sizeBand: formData.get('sizeBand') || undefined,
      goal: formData.get('goal') || undefined,
      website: formData.get('website') || undefined,
    });

    await updateCompany(ctx, parsed);
    revalidatePath('/configuracoes');

    return { ok: true, message: 'Dados da empresa atualizados.' };
  } catch (error) {
    return toState(error);
  }
}

export async function switchCompanyAction(companyId: string): Promise<void> {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');

  await switchCompany(ctx.userId, ctx.sessionId, companyId);
  redirect('/dashboard');
}
