import Link from 'next/link';
import { Compass } from 'lucide-react';
import { NexoraLogo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <NexoraLogo size="sm" className="mb-10" />

      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-surface-overlay text-ink-subtle">
        <Compass className="size-6" aria-hidden />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Página não encontrada</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-subtle">
        O endereço que você tentou abrir não existe, foi movido, ou você não tem acesso a ele.
      </p>

      <div className="mt-7 flex gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href="/">Página inicial</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/dashboard">Ir para o painel</Link>
        </Button>
      </div>
    </div>
  );
}
