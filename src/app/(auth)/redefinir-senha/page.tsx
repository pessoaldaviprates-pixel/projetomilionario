import Link from 'next/link';
import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-form';

export const metadata: Metadata = { title: 'Redefinir senha' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold text-ink">Link inválido</h1>
        <p className="text-sm text-ink-subtle">
          Este link de redefinição não é válido ou está incompleto.
        </p>
        <Link href="/esqueci-senha" className="inline-block text-sm font-medium text-brand hover:underline">
          Solicitar um novo link
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-slide-up">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Criar nova senha</h1>
        <p className="mt-1.5 text-sm text-ink-subtle">
          Escolha uma senha forte. Todas as outras sessões serão encerradas.
        </p>
      </header>

      <ResetPasswordForm token={token} />
    </div>
  );
}
