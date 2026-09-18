/**
 * Assinaturas, checkout e faturas.
 *
 * Nenhum dado sensível de cartão passa por aqui: recebemos no máximo um token
 * opaco do gateway e guardamos bandeira + 4 últimos dígitos para exibição.
 * O ciclo de vida real da cobrança é conduzido por webhook idempotente.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, scoped } from '@/lib/db/tenant';
import { auditFromContext } from '@/lib/audit';
import { NotFoundError, ValidationError } from '@/lib/http/errors';
import { gateway } from '@/lib/billing/gateway';
import { PLAN_SEEDS } from '@/lib/billing/entitlements';
import { getCompanyEntitlements } from '@/lib/billing/subscription';
import { notify } from './notifications.service';
import type { AuthContext } from '@/lib/auth/context';
import type { PaymentMethod } from '@/generated/prisma/enums';

/** Catálogo público de planos (usado na landing e no checkout). */
export async function listPlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
    select: {
      id: true, slug: true, name: true, tagline: true, priceCents: true, currency: true,
      interval: true, maxUsers: true, storageGb: true, features: true, isPopular: true,
    },
  });

  // Primeira execução sem seed: devolve o catálogo inicial para a página não quebrar.
  if (plans.length === 0) {
    return PLAN_SEEDS.map((seed) => ({
      id: seed.slug,
      slug: seed.slug,
      name: seed.name,
      tagline: seed.tagline,
      priceCents: seed.priceCents,
      currency: 'BRL',
      interval: 'MONTHLY' as const,
      maxUsers: seed.maxUsers,
      storageGb: seed.storageGb,
      features: seed.features,
      isPopular: seed.isPopular,
    }));
  }

  return plans;
}

export async function getSubscription(ctx: AuthContext) {
  assertPermission(ctx, 'billing.view');

  const [subscription, entitlements, seatsUsed] = await Promise.all([
    prisma.subscription.findUnique({
      where: { companyId: ctx.companyId },
      include: { plan: true },
    }),
    getCompanyEntitlements(ctx.companyId),
    prisma.membership.count({ where: { companyId: ctx.companyId, status: { in: ['ACTIVE', 'INVITED'] } } }),
  ]);

  return { subscription, entitlements, seatsUsed };
}

export async function listPayments(ctx: AuthContext) {
  assertPermission(ctx, 'billing.view');

  return prisma.payment.findMany({
    where: scoped(ctx),
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, amountCents: true, currency: true, status: true, method: true,
      cardBrand: true, cardLast4: true, invoiceUrl: true, boletoUrl: true,
      paidAt: true, createdAt: true, failureReason: true,
    },
  });
}

export interface CheckoutInput {
  planSlug: string;
  method: PaymentMethod;
  paymentToken?: string;
  cardBrand?: string;
  cardLast4?: string;
}

/**
 * Inicia a assinatura de um plano.
 * A assinatura entra como INCOMPLETE até o gateway confirmar o pagamento —
 * não liberamos recurso pago antes de dinheiro confirmado.
 */
export async function startCheckout(ctx: AuthContext, input: CheckoutInput) {
  assertPermission(ctx, 'billing.manage');

  const plan = await prisma.plan.findUnique({ where: { slug: input.planSlug } });
  if (!plan || !plan.isActive) throw new NotFoundError('Plano não encontrado.');

  const seatsUsed = await prisma.membership.count({
    where: { companyId: ctx.companyId, status: { in: ['ACTIVE', 'INVITED'] } },
  });

  if (plan.maxUsers !== null && seatsUsed > plan.maxUsers) {
    throw new ValidationError(
      `Sua empresa tem ${seatsUsed} pessoas e o plano ${plan.name} permite até ${plan.maxUsers}. Escolha um plano maior ou desative usuários.`,
    );
  }

  const charge = await gateway.createCharge({
    companyId: ctx.companyId,
    amountCents: plan.priceCents,
    currency: plan.currency,
    method: input.method,
    description: `Nexora · plano ${plan.name}`,
    paymentToken: input.paymentToken,
    customerEmail: ctx.user.email,
  });

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + (plan.interval === 'YEARLY' ? 12 : 1));

  const result = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.upsert({
      where: { companyId: ctx.companyId },
      create: {
        companyId: ctx.companyId,
        planId: plan.id,
        status: charge.status === 'PAID' ? 'ACTIVE' : 'INCOMPLETE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
        provider: gateway.name,
        seats: seatsUsed,
      },
      update: {
        planId: plan.id,
        status: charge.status === 'PAID' ? 'ACTIVE' : 'INCOMPLETE',
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        provider: gateway.name,
        seats: seatsUsed,
      },
    });

    const payment = await tx.payment.create({
      data: {
        companyId: ctx.companyId,
        subscriptionId: subscription.id,
        amountCents: plan.priceCents,
        currency: plan.currency,
        status: charge.status,
        method: input.method,
        providerPaymentId: charge.providerPaymentId,
        // Guardamos apenas o que é seguro exibir de volta ao cliente.
        cardBrand: input.cardBrand ?? charge.cardBrand ?? null,
        cardLast4: input.cardLast4 ?? charge.cardLast4 ?? null,
        pixQrCode: charge.pixQrCode ?? null,
        boletoUrl: charge.boletoUrl ?? null,
        invoiceUrl: charge.invoiceUrl ?? null,
        failureReason: charge.failureReason ?? null,
        paidAt: charge.status === 'PAID' ? new Date() : null,
      },
    });

    return { subscription, payment };
  });

  await auditFromContext(ctx, {
    action: 'billing.subscription_created',
    entityType: 'subscription',
    entityId: result.subscription.id,
    metadata: { plan: plan.slug, method: input.method, amountCents: plan.priceCents },
  });

  return {
    paymentId: result.payment.id,
    status: result.payment.status,
    plan: { slug: plan.slug, name: plan.name, priceCents: plan.priceCents },
    pixQrCode: charge.pixQrCode ?? null,
    boletoUrl: charge.boletoUrl ?? null,
  };
}

export async function changePlan(ctx: AuthContext, planSlug: string) {
  assertPermission(ctx, 'billing.manage');

  const [plan, subscription] = await Promise.all([
    prisma.plan.findUnique({ where: { slug: planSlug } }),
    prisma.subscription.findUnique({ where: { companyId: ctx.companyId }, include: { plan: true } }),
  ]);

  if (!plan || !plan.isActive) throw new NotFoundError('Plano não encontrado.');
  if (!subscription) throw new ValidationError('Nenhuma assinatura ativa. Faça a contratação pelo checkout.');
  if (subscription.planId === plan.id) throw new ValidationError('Este já é o seu plano atual.');

  const seatsUsed = await prisma.membership.count({
    where: { companyId: ctx.companyId, status: { in: ['ACTIVE', 'INVITED'] } },
  });

  // Downgrade que não comporta a equipe atual é bloqueado antes de cobrar.
  if (plan.maxUsers !== null && seatsUsed > plan.maxUsers) {
    throw new ValidationError(
      `O plano ${plan.name} permite até ${plan.maxUsers} usuários e sua empresa tem ${seatsUsed}.`,
    );
  }

  const isUpgrade = plan.priceCents > subscription.plan.priceCents;

  await prisma.subscription.update({
    where: { companyId: ctx.companyId },
    data: { planId: plan.id, seats: seatsUsed, cancelAtPeriodEnd: false, canceledAt: null },
  });

  await auditFromContext(ctx, {
    action: 'billing.plan_changed',
    entityType: 'subscription',
    entityId: subscription.id,
    metadata: { from: subscription.plan.slug, to: plan.slug, isUpgrade },
    severity: 'WARNING',
  });

  return { plan: { slug: plan.slug, name: plan.name }, isUpgrade };
}

export async function cancelSubscription(ctx: AuthContext, immediate = false) {
  assertPermission(ctx, 'billing.manage');

  const subscription = await prisma.subscription.findUnique({ where: { companyId: ctx.companyId } });
  if (!subscription) throw new NotFoundError('Nenhuma assinatura encontrada.');

  await prisma.subscription.update({
    where: { companyId: ctx.companyId },
    data: immediate
      ? { status: 'CANCELED', canceledAt: new Date(), cancelAtPeriodEnd: false }
      // Padrão: mantém o acesso até o fim do período já pago.
      : { cancelAtPeriodEnd: true, canceledAt: new Date() },
  });

  await auditFromContext(ctx, {
    action: 'billing.canceled',
    entityType: 'subscription',
    entityId: subscription.id,
    severity: 'CRITICAL',
    metadata: { immediate },
  });

  const owners = await prisma.membership.findMany({
    where: { companyId: ctx.companyId, isOwner: true },
    select: { id: true },
  });

  await notify({
    companyId: ctx.companyId,
    recipientIds: owners.map((o) => o.id),
    kind: 'BILLING',
    title: immediate ? 'Assinatura cancelada' : 'Cancelamento agendado',
    body: immediate
      ? 'O acesso aos recursos do plano foi encerrado.'
      : `Seu acesso continua até ${subscription.currentPeriodEnd.toLocaleDateString('pt-BR')}.`,
    href: '/configuracoes/assinatura',
  });
}

/**
 * Processa um webhook do gateway de forma idempotente.
 * O mesmo evento pode chegar várias vezes — processar duas vezes não pode
 * cobrar, liberar ou revogar duas vezes.
 */
export async function handleWebhook(
  provider: string,
  eventId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<{ processed: boolean; reason?: string }> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider, eventId } },
    select: { id: true, processedAt: true },
  });

  if (existing?.processedAt) return { processed: false, reason: 'already_processed' };

  const event = existing
    ? await prisma.webhookEvent.update({ where: { id: existing.id }, data: { type, payload: payload as never } })
    : await prisma.webhookEvent.create({ data: { provider, eventId, type, payload: payload as never } });

  try {
    const providerPaymentId = typeof payload.paymentId === 'string' ? payload.paymentId : null;

    if (providerPaymentId) {
      const payment = await prisma.payment.findFirst({
        where: { providerPaymentId },
        select: { id: true, companyId: true, subscriptionId: true },
      });

      if (payment) {
        if (type === 'payment.paid' || type === 'payment_intent.succeeded') {
          await prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: 'PAID', paidAt: new Date(), failureReason: null },
            });
            if (payment.subscriptionId) {
              await tx.subscription.update({
                where: { id: payment.subscriptionId },
                data: { status: 'ACTIVE' },
              });
            }
          });
        } else if (type === 'payment.failed' || type === 'payment_intent.payment_failed') {
          await prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: 'FAILED', failureReason: String(payload.reason ?? 'Pagamento recusado') },
            });
            if (payment.subscriptionId) {
              await tx.subscription.update({ where: { id: payment.subscriptionId }, data: { status: 'PAST_DUE' } });
            }
          });
        }
      }
    }

    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    return { processed: true };
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}
