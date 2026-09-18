import Link from 'next/link';
import type { Metadata } from 'next';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyEmail } from '@/server/services/auth.service';

export const metadata: Metadata = { title: 'Confirmar e-mail' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let error: string | null = null;
  let email: string | null = null;

  if (!token) {
    error = 'Link de verificação inválido.';
  } else {
    try {
      const result = await verifyEmail(token);
      email = result.email;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Não foi possível verificar o e-mail.';
    }
  }

  return (
    <div className="space-y-5 text-center">
      {error ? (
        <>
          <XCircle className="mx-auto size-10 text-danger" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold text-ink">Não foi possível confirmar</h1>
            <p className="mt-1.5 text-sm text-ink-subtle">{error}</p>
          </div>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/login">Voltar para o login</Link>
          </Button>
        </>
      ) : (
        <>
          <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold text-ink">E-mail confirmado!</h1>
            <p className="mt-1.5 text-sm text-ink-subtle">
              O endereço {email} está verificado. Sua conta está pronta para uso.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href="/dashboard">Acessar a Nexora</Link>
          </Button>
        </>
      )}
    </div>
  );
}
