import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/auth/context';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Criar conta' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string; plano?: string }>;
}) {
  const params = await searchParams;

  // Quem já está autenticado (e sem convite pendente) vai direto para o produto.
  const ctx = await getUserContext();
  if (ctx && !params.convite) redirect(ctx.activeCompanyId ? '/dashboard' : '/onboarding');

  return (
    <div className="animate-slide-up">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Crie sua conta</h1>
        <p className="mt-1.5 text-sm text-ink-subtle">
          Comece a organizar sua empresa em poucos minutos.
        </p>
      </header>

      <RegisterForm inviteToken={params.convite} plan={params.plano} />

      <p className="mt-6 text-center text-sm text-ink-subtle">
        Já tem uma conta?{' '}
        <Link href="/login" className="font-medium text-brand hover:text-brand-glow hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
