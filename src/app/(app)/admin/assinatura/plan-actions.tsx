'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { formatPrice } from '@/lib/billing/entitlements';
import { cn } from '@/lib/utils/cn';

interface PlanOption {
  slug: string;
  name: string;
  priceCents: number;
  maxUsers: number | null;
  features: string[];
  isPopular: boolean;
}

export function PlanActions({
  plans,
  currentPlanSlug,
  hasSubscription,
  cancelScheduled,
  seatsUsed,
}: {
  plans: PlanOption[];
  currentPlanSlug: string;
  hasSubscription: boolean;
  cancelScheduled: boolean;
  seatsUsed: number;
}) {
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function cancel() {
    setPending(true);
    try {
      const response = await fetch('/api/billing/assinatura', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Não foi possível cancelar.');
      }

      toast.success('Cancelamento agendado para o fim do período pago.');
      setCancelOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button size="sm" onClick={() => setChangeOpen(true)}>
          {hasSubscription ? 'Alterar plano' : 'Escolher plano'}
        </Button>

        {hasSubscription && !cancelScheduled ? (
          <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)}>
            Cancelar assinatura
          </Button>
        ) : null}
      </div>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent title="Escolher plano" description="O pagamento é processado com segurança pelo gateway." size="lg">
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.slug === currentPlanSlug;
              // Downgrade que não comporta a equipe atual é bloqueado antes do checkout.
              const exceedsSeats = plan.maxUsers !== null && seatsUsed > plan.maxUsers;

              return (
                <div
                  key={plan.slug}
                  className={cn(
                    'flex flex-col rounded-xl border p-4',
                    isCurrent ? 'border-brand/50 bg-brand/[0.05]' : 'border-line',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{plan.name}</p>
                    {plan.isPopular ? <Badge tone="brand">Popular</Badge> : null}
                  </div>

                  <p className="text-xl font-semibold text-ink">
                    {formatPrice(plan.priceCents)}
                    <span className="ml-1 text-xs font-normal text-ink-faint">/mês</span>
                  </p>

                  <ul className="mt-3 flex-1 space-y-1.5">
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature} className="flex items-start gap-1.5 text-xs text-ink-subtle">
                        <Check className="mt-0.5 size-3 shrink-0 text-success" aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <p className="mt-4 text-center text-xs text-brand">Plano atual</p>
                  ) : exceedsSeats ? (
                    <p className="mt-4 text-center text-xs text-warning">
                      Sua equipe tem {seatsUsed} pessoas
                    </p>
                  ) : (
                    <Button asChild size="sm" className="mt-4 w-full">
                      <Link href={`/checkout?plano=${plan.slug}`}>
                        Escolher <ArrowUpRight className="size-3.5" aria-hidden />
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent title="Cancelar assinatura" description="Você mantém o acesso até o fim do período já pago." size="sm">
          <p className="text-sm text-ink-muted">
            Ao cancelar, os recursos do plano deixam de ser renovados. Seus dados continuam guardados e você
            pode reativar quando quiser.
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCancelOpen(false)}>Manter assinatura</Button>
            <Button type="button" variant="danger" onClick={cancel} loading={pending}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
