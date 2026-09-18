import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/auth/context';
import { OnboardingSteps } from './steps';
import { CreateCompanyForm } from './create-company-form';

export const metadata: Metadata = { title: 'Bem-vindo' };

export default async function OnboardingPage() {
  const ctx = await getUserContext();

  // Quem já tem empresa configurada não precisa passar por aqui de novo.
  if (ctx?.activeCompanyId) redirect('/dashboard');

  const firstName = ctx?.user.name.split(' ')[0] ?? '';

  return (
    <div className="animate-slide-up">
      <OnboardingSteps current="empresa" />

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-balance text-ink">
          Bem-vindo à Nexora{firstName ? `, ${firstName}` : ''}!
        </h1>
        <p className="mt-2 text-ink-muted">
          Vamos criar o ambiente da sua empresa. Leva menos de um minuto — e você pode ajustar tudo depois.
        </p>
      </header>

      <CreateCompanyForm />
    </div>
  );
}
