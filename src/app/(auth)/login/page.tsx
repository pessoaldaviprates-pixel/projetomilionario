import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUserContext } from '@/lib/auth/context';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string; criada?: string }>;
}) {
  const params = await searchParams;

  // Quem já está autenticado (e sem convite pendente) vai direto para o produto.
  const ctx = await getUserContext();
  if (ctx && !params.convite) redirect(ctx.activeCompanyId ? '/dashboard' : '/onboarding');

  return (
    <div className="animate-slide-up">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Bem-vindo de volta!</h1>
        <p className="mt-1.5 text-sm text-ink-subtle">Faça login na sua conta para continuar.</p>
      </header>

      {params.criada ? (
        <p
          role="status"
          className="mb-5 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success"
        >
          Conta criada com sucesso. Entre para continuar.
        </p>
      ) : null}

      <LoginForm inviteToken={params.convite} />

      <p className="mt-6 text-center text-sm text-ink-subtle">
        Não tem uma conta?{' '}
        <Link
          href={params.convite ? `/cadastro?convite=${encodeURIComponent(params.convite)}` : '/cadastro'}
          className="font-medium text-brand hover:text-brand-glow hover:underline"
        >
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
