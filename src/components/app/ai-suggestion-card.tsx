'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatShortDate } from '@/lib/utils/format';

export interface AiSuggestion {
  id: string;
  kind: string;
  payload: unknown;
  rationale: string | null;
  confidence: number | null;
  createdAt: Date | string;
}

interface Payload {
  title: string;
  assigneeHint: string | null;
  dueAt: string | null;
  dueHint: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

const PRIORITY_LABELS = { LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente' };

/**
 * Cartão de sugestão da IA.
 *
 * A decisão é sempre da pessoa: aceitar cria a tarefa de verdade (com auditoria),
 * descartar registra a recusa. Nunca há criação silenciosa.
 */
export function AiSuggestionCard({ suggestion }: { suggestion: AiSuggestion }) {
  const [pending, setPending] = useState<'accept' | 'dismiss' | null>(null);
  const [resolved, setResolved] = useState(false);
  const router = useRouter();

  const payload = suggestion.payload as Payload;

  async function decide(decision: 'ACCEPT' | 'DISMISS') {
    setPending(decision === 'ACCEPT' ? 'accept' : 'dismiss');

    try {
      const response = await fetch(`/api/ia/acoes/${suggestion.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision }),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(error?.error?.message ?? 'Não foi possível concluir.');
      }

      setResolved(true);
      toast.success(decision === 'ACCEPT' ? 'Tarefa criada com sucesso.' : 'Sugestão descartada.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(null);
    }
  }

  if (resolved) return null;

  const confidencePercent = suggestion.confidence ? Math.round(suggestion.confidence * 100) : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-3.5 sm:flex-row sm:items-center">
      <Sparkles className="hidden size-4 shrink-0 text-accent sm:block" aria-hidden />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{payload.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          {payload.assigneeHint ? <span>Responsável sugerido: {payload.assigneeHint}</span> : null}
          {payload.dueAt ? <span>Prazo: {formatShortDate(payload.dueAt)}</span> : null}
          {payload.priority !== 'MEDIUM' ? (
            <Badge tone={payload.priority === 'URGENT' ? 'danger' : 'warning'}>
              {PRIORITY_LABELS[payload.priority]}
            </Badge>
          ) : null}
          {confidencePercent !== null ? <span>Confiança: {confidencePercent}%</span> : null}
        </div>
        {suggestion.rationale ? (
          <p className="mt-1 text-xs text-ink-faint italic">{suggestion.rationale}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          size="sm"
          onClick={() => decide('ACCEPT')}
          loading={pending === 'accept'}
          disabled={pending !== null}
        >
          <Check className="size-3.5" aria-hidden /> Criar tarefa
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => decide('DISMISS')}
          loading={pending === 'dismiss'}
          disabled={pending !== null}
          aria-label="Descartar sugestão"
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
