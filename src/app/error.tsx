'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Fronteira de erro da aplicação.
 * Mostra uma mensagem legível e oferece nova tentativa — nunca expõe stack
 * trace ao usuário final.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app] erro não tratado:', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-danger/12 text-danger">
        <AlertTriangle className="size-6" aria-hidden />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-ink">Algo deu errado</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-subtle">
        Não conseguimos carregar esta página. Tente novamente — se o problema continuar, avise a equipe.
      </p>

      {error.digest ? (
        <p className="mt-3 font-mono text-[11px] text-ink-faint">Referência: {error.digest}</p>
      ) : null}

      <Button onClick={reset} size="sm" className="mt-7">
        <RotateCcw className="size-4" aria-hidden /> Tentar novamente
      </Button>
    </div>
  );
}
