import Link from 'next/link';
import type { Metadata } from 'next';
import { Check, CreditCard, Headphones, ShieldCheck } from 'lucide-react';
import { listPlans } from '@/server/services/billing.service';
import { formatPrice } from '@/lib/billing/entitlements';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = {
  title: 'Planos',
  description: 'Escolha o plano ideal para a sua empresa na Nexora.',
};

const GUARANTEES = [
  { icon: ShieldCheck, title: 'Pagamento seguro', text: 'Seus dados protegidos' },
  { icon: CreditCard, title: 'Cancelamento fácil', text: 'Sem burocracia' },
  { icon: Headphones, title: 'Suporte especializado', text: 'Sempre com você' },
];

export default async function PlansPage() {
  const plans = await listPlans();

  return (
    <div className="relative overflow-hidden">
      <div className="grid-backdrop absolute inset-0 opacity-20" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <header className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
            Escolha o plano ideal para a sua empresa
          </h1>
          <p className="mt-4 text-ink-muted">
            Mais do que uma ferramenta, a Nexora é o sistema operacional da sua equipe. Comece agora
            e leve sua produtividade para o próximo nível.
          </p>
        </header>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.slug}
              className={cn(
                'relative flex flex-col p-6',
                plan.isPopular ? 'border-brand/50 shadow-[0_0_40px_-12px_rgba(46,125,255,0.4)]' : '',
              )}
            >
              {plan.isPopular ? (
                <Badge tone="brand" className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  Mais popular
                </Badge>
              ) : null}

              <div className="mb-5">
                <h2 className="text-lg font-semibold text-ink">{plan.name}</h2>
                <p className="mt-1 text-sm text-ink-subtle">{plan.tagline}</p>
              </div>

              <p className="mb-6">
                <span className="text-4xl font-bold tracking-tight text-ink">{formatPrice(plan.priceCents)}</span>
                <span className="ml-1.5 text-sm text-ink-faint">/mês</span>
                <span className="mt-1 block text-xs text-ink-faint">por empresa</span>
              </p>

              <ul className="mb-7 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-ink-muted">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button asChild variant={plan.isPopular ? 'primary' : 'secondary'} className="w-full">
                <Link href={`/cadastro?plano=${plan.slug}`}>Começar agora</Link>
              </Button>
            </Card>
          ))}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {GUARANTEES.map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <item.icon className="size-5 shrink-0 text-brand" aria-hidden />
              <div>
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <p className="text-xs text-ink-faint">{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-ink-faint">
          Todos os planos incluem isolamento total de dados entre empresas, trilha de auditoria e
          controle granular de permissões. Os valores podem ser ajustados pelo administrador da plataforma.
        </p>
      </div>
    </div>
  );
}
