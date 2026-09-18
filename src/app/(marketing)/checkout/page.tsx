import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getAuthContext } from '@/lib/auth/context';
import { listPlans } from '@/server/services/billing.service';
import { CheckoutForm } from './checkout-form';

export const metadata: Metadata = { title: 'Pagamento' };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getAuthContext();

  // O checkout exige empresa ativa: é ela que assina o plano.
  if (!ctx) {
    const target = params.plano ? `/cadastro?plano=${params.plano}` : '/cadastro';
    redirect(target);
  }

  if (!ctx.can('billing.manage')) redirect('/sem-permissao');

  const plans = await listPlans();
  const selected = plans.find((plan) => plan.slug === params.plano) ?? plans.find((plan) => plan.isPopular) ?? plans[0];

  if (!selected) redirect('/planos');

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <CheckoutForm
        plans={plans.map((plan) => ({
          slug: plan.slug,
          name: plan.name,
          tagline: plan.tagline ?? '',
          priceCents: plan.priceCents,
          features: plan.features,
        }))}
        initialPlanSlug={selected.slug}
        companyName={ctx.company.name}
        userEmail={ctx.user.email}
      />
    </div>
  );
}
