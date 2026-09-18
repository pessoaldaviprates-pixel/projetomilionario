import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { hashToken } from '@/lib/auth/tokens';
import { getUserContext } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import { AcceptInviteForm } from './accept-form';

export const metadata: Metadata = { title: 'Convite' };

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold text-ink">Convite inválido</h1>
        <p className="text-sm text-ink-subtle">Este link de convite não é válido ou está incompleto.</p>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/login">Ir para o login</Link>
        </Button>
      </div>
    );
  }

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      email: true,
      status: true,
      expiresAt: true,
      company: { select: { name: true, logoUrl: true } },
    },
  });

  const invalid =
    !invitation || invitation.status !== 'PENDING' || invitation.expiresAt.getTime() < Date.now();

  if (invalid) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold text-ink">Convite expirado</h1>
        <p className="text-sm text-ink-subtle">
          Este convite já foi usado ou passou do prazo. Peça um novo para o administrador da empresa.
        </p>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/login">Ir para o login</Link>
        </Button>
      </div>
    );
  }

  const ctx = await getUserContext();

  // Quem ainda não tem conta cria uma com o e-mail do convite.
  if (!ctx) {
    redirect(`/cadastro?convite=${encodeURIComponent(token)}`);
  }

  // Convite é nominal: só vale para o endereço convidado.
  const emailMismatch = ctx.user.email !== invitation.email;

  return (
    <div className="animate-slide-up space-y-6 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand/12 text-brand">
        <Building2 className="size-6" aria-hidden />
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Convite para a {invitation.company.name}
        </h1>
        <p className="mt-2 text-sm text-ink-subtle">
          Você foi convidado para fazer parte da equipe na Nexora.
        </p>
      </div>

      {emailMismatch ? (
        <div className="space-y-3 rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-warning">
          <p>
            Este convite foi enviado para <strong>{invitation.email}</strong>, mas você está conectado
            como <strong>{ctx.user.email}</strong>.
          </p>
          <p className="text-xs">Saia da conta atual e entre com o e-mail convidado.</p>
        </div>
      ) : (
        <AcceptInviteForm token={token} companyName={invitation.company.name} />
      )}
    </div>
  );
}
