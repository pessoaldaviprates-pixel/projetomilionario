import Link from 'next/link';
import type { Metadata } from 'next';
import { ForgotPasswordForm } from './forgot-form';

export const metadata: Metadata = { title: 'Recuperar senha' };

export default function ForgotPasswordPage() {
  return (
    <div className="animate-slide-up">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Recuperar senha</h1>
        <p className="mt-1.5 text-sm text-ink-subtle">
          Informe seu e-mail e enviaremos as instruções para criar uma nova senha.
        </p>
      </header>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm text-ink-subtle">
        Lembrou a senha?{' '}
        <Link href="/login" className="font-medium text-brand hover:text-brand-glow hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
