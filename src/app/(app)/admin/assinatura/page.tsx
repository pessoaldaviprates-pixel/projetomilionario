import Link from 'next/link';
import type { Metadata } from 'next';
import { CheckCircle2, CreditCard, Users, Wallet } from 'lucide-react';
import { requirePermission } from '@/lib/auth/context';
import { getSubscription, listPayments, listPlans } from '@/server/services/billing.service';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/misc';
import { formatPrice } from '@/lib/billing/entitlements';
import { formatDate, pluralize } from '@/lib/utils/format';
import { PlanActions } from './plan-actions';

export const metadata: Metadata = { title: 'Assinatura' };

const STATUS_META: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'brand' }> = {
  ACTIVE: { label: 'Ativa', tone: 'success' },
  TRIALING: { label: 'Em avaliação', tone: 'brand' },
  PAST_DUE: { label: 'Pagamento pendente', tone: 'warning' },
  CANCELED: { label: 'Cancelada', tone: 'danger' },
  INCOMPLETE: { label: 'Aguardando pagamento', tone: 'warning' },
};

const PAYMENT_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  PAID: { label: 'Pago', tone: 'success' },
  PENDING: { label: 'Pendente', tone: 'warning' },
  PROCESSING: { label: 'Processando', tone: 'warning' },
  FAILED: { label: 'Recusado', tone: 'danger' },
  REFUNDED: { label: 'Estornado', tone: 'neutral' },
};

const METHOD_LABELS: Record<string, string> = {
  CARD: 'Cartão',
  PIX: 'Pix',
  BOLETO: 'Boleto',
  MANUAL: 'Manual',
};

export default async function SubscriptionPage() {
  const ctx = await requirePermission('billing.view');

  const [{ subscription, entitlements, seatsUsed }, payments, plans] = await Promise.all([
    getSubscription(ctx),
    listPayments(ctx),
    listPlans(),
  ]);

  const status = STATUS_META[entitlements.status] ?? STATUS_META.TRIALING!;
  const seatLimit = entitlements.maxUsers;
  const seatPercent = seatLimit === null ? 0 : Math.min(100, (seatsUsed / seatLimit) * 100);

  return (
    <>
      <PageHeader
        title="Assinatura"
        description="Plano atual, faturas e limites da sua empresa."
      />

      <PageBody className="space-y-5">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="size-4" aria-hidden /> Plano {entitlements.planName}
              </CardTitle>
              <p className="mt-1 text-xs text-ink-subtle">
                {subscription
                  ? `Próxima cobrança em ${formatDate(subscription.currentPeriodEnd)}`
                  : 'Período de avaliação — escolha um plano para continuar com todos os recursos.'}
              </p>
            </div>
            <Badge tone={status.tone} dot>{status.label}</Badge>
          </CardHeader>

          <CardContent className="space-y-5">
            {subscription ? (
              <p className="text-2xl font-semibold text-ink">
                {formatPrice(subscription.plan.priceCents)}
                <span className="ml-1 text-sm font-normal text-ink-faint">/mês</span>
              </p>
            ) : null}

            <div>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <Users className="size-3.5" aria-hidden /> Usuários
                </span>
                <span className="text-ink-faint tabular-nums">
                  {seatsUsed} {seatLimit === null ? '(ilimitado)' : `de ${seatLimit}`}
                </span>
              </div>
              {seatLimit !== null ? (
                <Progress
                  value={seatPercent}
                  tone={seatPercent > 90 ? 'danger' : seatPercent > 70 ? 'warning' : 'brand'}
                  label="Uso de assentos"
                />
              ) : null}
            </div>

            {subscription?.cancelAtPeriodEnd ? (
              <p className="rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning">
                O cancelamento está agendado. O acesso continua até {formatDate(subscription.currentPeriodEnd)}.
              </p>
            ) : null}

            {ctx.can('billing.manage') ? (
              <PlanActions
                plans={plans.map((plan) => ({
                  slug: plan.slug,
                  name: plan.name,
                  priceCents: plan.priceCents,
                  maxUsers: plan.maxUsers,
                  features: plan.features,
                  isPopular: plan.isPopular,
                }))}
                currentPlanSlug={entitlements.planSlug}
                hasSubscription={Boolean(subscription)}
                cancelScheduled={Boolean(subscription?.cancelAtPeriodEnd)}
                seatsUsed={seatsUsed}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recursos incluídos</CardTitle>
            <span className="text-xs text-ink-faint">{entitlements.entitlements.size} recursos</span>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from(entitlements.entitlements).map((entitlement) => (
                <li key={entitlement} className="flex items-center gap-2 text-xs text-ink-subtle">
                  <CheckCircle2 className="size-3 shrink-0 text-success" aria-hidden />
                  {entitlement}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="overflow-hidden p-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4" aria-hidden /> Histórico de pagamentos
            </CardTitle>
          </CardHeader>

          {payments.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-ink-faint">Nenhum pagamento registrado ainda.</p>
          ) : (
            <div className="relative w-full overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[520px]">
              <caption className="sr-only">Pagamentos da assinatura</caption>
              <thead>
                <tr className="border-y border-line text-left">
                  <th scope="col" className="px-5 py-2.5 text-xs font-medium text-ink-faint">Data</th>
                  <th scope="col" className="px-5 py-2.5 text-xs font-medium text-ink-faint">Valor</th>
                  <th scope="col" className="hidden px-5 py-2.5 text-xs font-medium text-ink-faint sm:table-cell">Método</th>
                  <th scope="col" className="px-5 py-2.5 text-xs font-medium text-ink-faint">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((payment) => {
                  const paymentStatus = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS.PENDING!;

                  return (
                    <tr key={payment.id}>
                      <td className="px-5 py-2.5 text-sm text-ink-muted">
                        {formatDate(payment.paidAt ?? payment.createdAt)}
                      </td>
                      <td className="px-5 py-2.5 text-sm text-ink tabular-nums">
                        {formatPrice(payment.amountCents, payment.currency)}
                      </td>
                      <td className="hidden px-5 py-2.5 text-sm text-ink-subtle sm:table-cell">
                        {METHOD_LABELS[payment.method] ?? payment.method}
                        {payment.cardLast4 ? ` •••• ${payment.cardLast4}` : ''}
                      </td>
                      <td className="px-5 py-2.5">
                        <Badge tone={paymentStatus.tone}>{paymentStatus.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-ink-faint">
          Precisa de uma nota fiscal ou plano personalizado?{' '}
          <Link href="/planos" className="text-brand hover:underline">Ver todos os planos</Link>
        </p>
      </PageBody>
    </>
  );
}
