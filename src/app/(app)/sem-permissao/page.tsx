import Link from 'next/link';
import type { Metadata } from 'next';
import { ShieldAlert } from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageBody } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Sem permissão' };

export default async function ForbiddenPage() {
  const ctx = await requireAuth();

  return (
    <PageBody className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-warning/12 text-warning">
          <ShieldAlert className="size-6" aria-hidden />
        </div>

        <h1 className="text-lg font-semibold text-ink">Acesso não autorizado</h1>
        <p className="mt-2 text-sm text-ink-subtle">
          Seu cargo ({ctx.role.name}) não tem permissão para acessar esta área. Se você precisa deste
          acesso, fale com um administrador da {ctx.company.name}.
        </p>

        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard">Voltar ao início</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/mensagens">Falar com a equipe</Link>
          </Button>
        </div>
      </Card>
    </PageBody>
  );
}
