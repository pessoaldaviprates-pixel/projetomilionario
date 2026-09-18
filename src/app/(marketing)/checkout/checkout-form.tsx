'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, CreditCard, FileText, Lock, QrCode, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatPrice } from '@/lib/billing/entitlements';
import { cn } from '@/lib/utils/cn';

interface PlanOption {
  slug: string;
  name: string;
  tagline: string;
  priceCents: number;
  features: string[];
}

type Method = 'CARD' | 'PIX' | 'BOLETO';

const METHODS = [
  { value: 'CARD' as const, label: 'Cartão de crédito', icon: CreditCard, hint: 'Visa, Mastercard, Elo' },
  { value: 'PIX' as const, label: 'Pix', icon: QrCode, hint: 'Aprovação em instantes' },
  { value: 'BOLETO' as const, label: 'Boleto bancário', icon: FileText, hint: 'Vence em 3 dias úteis' },
];

export function CheckoutForm({
  plans,
  initialPlanSlug,
  companyName,
  userEmail,
}: {
  plans: PlanOption[];
  initialPlanSlug: string;
  companyName: string;
  userEmail: string;
}) {
  const [planSlug, setPlanSlug] = useState(initialPlanSlug);
  const [method, setMethod] = useState<Method>('CARD');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ status: string; pixQrCode: string | null; boletoUrl: string | null } | null>(null);
  const router = useRouter();

  const plan = plans.find((item) => item.slug === planSlug) ?? plans[0]!;

  async function submit(formData: FormData) {
    setPending(true);

    try {
      /*
       * Segurança: os dados do cartão NÃO são enviados ao nosso servidor.
       * Em produção, o SDK do gateway tokeniza no navegador e devolve um token
       * opaco — é ele que trafega. Aqui enviamos apenas bandeira e 4 últimos
       * dígitos, que são dados de exibição, nunca o número completo.
       */
      const cardNumber = String(formData.get('cardNumber') ?? '').replace(/\D/g, '');

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planSlug,
          method,
          ...(method === 'CARD' && cardNumber.length >= 4
            ? { cardLast4: cardNumber.slice(-4), cardBrand: detectBrand(cardNumber) }
            : {}),
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível concluir o pagamento.');

      setResult({
        status: json.data.status,
        pixQrCode: json.data.pixQrCode,
        boletoUrl: json.data.boletoUrl,
      });

      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-success/12 text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </div>

        <h1 className="text-xl font-semibold text-ink">Pedido registrado!</h1>
        <p className="mt-2 text-sm text-ink-subtle">
          {result.status === 'PAID'
            ? `Seu plano ${plan.name} já está ativo.`
            : `Estamos aguardando a confirmação do pagamento. Assim que o gateway confirmar, o plano ${plan.name} é ativado automaticamente.`}
        </p>

        {result.pixQrCode ? (
          <div className="mt-5 rounded-xl border border-line bg-surface p-4">
            <p className="text-xs text-ink-muted">Identificador da cobrança Pix</p>
            <code className="mt-1 block font-mono text-xs break-all text-ink">{result.pixQrCode}</code>
          </div>
        ) : null}

        {result.boletoUrl ? (
          <p className="mt-5 text-sm">
            <a href={result.boletoUrl} className="text-brand hover:underline">Abrir boleto</a>
          </p>
        ) : null}

        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/admin/assinatura">Ver assinatura</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard">Ir para o painel</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <form action={submit} className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Pagamento</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-subtle">
            <Lock className="size-3.5" aria-hidden /> Pagamento seguro
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Plano selecionado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plans.map((option) => (
              <label
                key={option.slug}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors',
                  planSlug === option.slug ? 'border-brand/50 bg-brand/[0.06]' : 'border-line hover:border-line-strong',
                )}
              >
                <input
                  type="radio"
                  name="plan"
                  value={option.slug}
                  checked={planSlug === option.slug}
                  onChange={() => setPlanSlug(option.slug)}
                  className="size-4 accent-brand"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{option.name}</span>
                  <span className="block text-xs text-ink-faint">{option.tagline}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-ink">
                  {formatPrice(option.priceCents)}
                  <span className="text-xs font-normal text-ink-faint">/mês</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Forma de pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {METHODS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors',
                  method === option.value ? 'border-brand/50 bg-brand/[0.06]' : 'border-line hover:border-line-strong',
                )}
              >
                <input
                  type="radio"
                  name="method"
                  value={option.value}
                  checked={method === option.value}
                  onChange={() => setMethod(option.value)}
                  className="size-4 accent-brand"
                />
                <option.icon className="size-4 shrink-0 text-ink-faint" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink">{option.label}</span>
                  <span className="block text-xs text-ink-faint">{option.hint}</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        {method === 'CARD' ? (
          <Card>
            <CardHeader>
              <CardTitle>Dados do cartão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                name="cardNumber"
                label="Número do cartão"
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                autoComplete="cc-number"
                maxLength={19}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input name="cardExpiry" label="Validade" placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" maxLength={5} />
                <Input name="cardCvv" label="CVV" placeholder="000" inputMode="numeric" autoComplete="cc-csc" maxLength={4} />
              </div>

              <Input name="cardName" label="Nome no cartão" placeholder="Como está no cartão" autoComplete="cc-name" />

              <p className="flex items-start gap-2 rounded-xl border border-line bg-surface px-3.5 py-3 text-xs text-ink-subtle">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                Os dados do cartão são processados pelo gateway de pagamento e nunca são armazenados
                nos nossos servidores. Guardamos apenas a bandeira e os 4 últimos dígitos.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Button type="submit" size="lg" loading={pending} className="w-full">
          Finalizar pagamento
        </Button>
      </form>

      <aside>
        <Card className="sticky top-20 p-5">
          <h2 className="text-sm font-semibold text-ink">Resumo da compra</h2>

          <div className="mt-4 space-y-2.5 border-b border-line pb-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-ink-subtle">Empresa</span>
              <span className="truncate text-ink">{companyName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-ink-subtle">E-mail</span>
              <span className="truncate text-ink">{userEmail}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-ink-subtle">Plano</span>
              <span className="text-ink">{plan.name}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-ink-subtle">Ciclo</span>
              <span className="text-ink">Mensal</span>
            </div>
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-sm text-ink-muted">Total</span>
            <span className="text-2xl font-semibold text-ink">{formatPrice(plan.priceCents)}</span>
          </div>

          <ul className="mt-5 space-y-2 border-t border-line pt-4">
            {plan.features.slice(0, 5).map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-xs text-ink-subtle">
                <Check className="mt-0.5 size-3 shrink-0 text-success" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>

          <Badge tone="success" className="mt-5">
            <Lock className="size-2.5" aria-hidden /> Dados criptografados
          </Badge>
        </Card>
      </aside>
    </div>
  );
}

/** Detecta a bandeira pelo prefixo — dado de exibição, não de autorização. */
function detectBrand(cardNumber: string): string {
  if (/^4/.test(cardNumber)) return 'visa';
  if (/^5[1-5]/.test(cardNumber)) return 'mastercard';
  if (/^3[47]/.test(cardNumber)) return 'amex';
  if (/^(4011|4312|4389|5041|6277|6362|6363|650|651|655)/.test(cardNumber)) return 'elo';
  if (/^(606282|3841)/.test(cardNumber)) return 'hipercard';
  return 'desconhecida';
}
