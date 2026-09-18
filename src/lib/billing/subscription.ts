/**
 * Leitura e verificação de assinatura.
 *
 * `requireEntitlement` é o portão que os services chamam antes de liberar um
 * recurso pago. A checagem é feita no servidor — esconder o botão no frontend
 * é UX, não segurança.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { PaymentRequiredError } from '@/lib/http/errors';
import type { Entitlement } from './entitlements';

export interface CompanyEntitlements {
  planSlug: string;
  planName: string;
  status: string;
  maxUsers: number | null;
  storageGb: number;
  entitlements: Set<Entitlement>;
  isActive: boolean;
  currentPeriodEnd: Date | null;
}

/** Plano de fallback quando a empresa ainda não assinou (período de avaliação). */
const TRIAL_ENTITLEMENTS: Entitlement[] = [
  'chat.basic', 'chat.threads', 'tasks.basic', 'projects.basic',
  'calendar.basic', 'calendar.timeblocking', 'files.basic', 'meetings.basic',
  'ai.assistant', 'ai.meeting_summary', 'ai.suggestions', 'reports.basic',
];

export async function getCompanyEntitlements(companyId: string): Promise<CompanyEntitlements> {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
    include: { plan: true },
  });

  if (!subscription) {
    return {
      planSlug: 'trial',
      planName: 'Avaliação',
      status: 'TRIALING',
      maxUsers: 15,
      storageGb: 5,
      entitlements: new Set(TRIAL_ENTITLEMENTS),
      isActive: true,
      currentPeriodEnd: null,
    };
  }

  // PAST_DUE mantém o acesso (cobrança em retentativa); CANCELED/INCOMPLETE não.
  const isActive = ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(subscription.status);

  return {
    planSlug: subscription.plan.slug,
    planName: subscription.plan.name,
    status: subscription.status,
    maxUsers: subscription.plan.maxUsers,
    storageGb: subscription.plan.storageGb,
    entitlements: new Set(
      (isActive ? subscription.plan.entitlements : []) as Entitlement[],
    ),
    isActive,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}

export async function hasEntitlement(companyId: string, entitlement: Entitlement): Promise<boolean> {
  const plan = await getCompanyEntitlements(companyId);
  return plan.entitlements.has(entitlement);
}

export async function requireEntitlement(companyId: string, entitlement: Entitlement): Promise<void> {
  if (!(await hasEntitlement(companyId, entitlement))) {
    throw new PaymentRequiredError('Seu plano atual não inclui este recurso. Faça upgrade para liberar.');
  }
}

/** Impede ultrapassar o limite de assentos contratado. */
export async function assertSeatAvailable(companyId: string): Promise<void> {
  const plan = await getCompanyEntitlements(companyId);
  if (plan.maxUsers === null) return;

  const activeSeats = await prisma.membership.count({
    where: { companyId, status: { in: ['ACTIVE', 'INVITED'] } },
  });

  if (activeSeats >= plan.maxUsers) {
    throw new PaymentRequiredError(
      `O plano ${plan.planName} permite até ${plan.maxUsers} usuários. Faça upgrade para adicionar mais pessoas.`,
    );
  }
}
