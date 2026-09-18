'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check, CheckCircle2, FileText, Lightbulb, Lock, Sparkles, Wand2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/input';
import { formatShortDate } from '@/lib/utils/format';

export interface ActionItem {
  id: string;
  title: string;
  assigneeHint: string | null;
  dueHint: string | null;
  dueAt: string | null;
  confidence: number | null;
  status: 'SUGGESTED' | 'ACCEPTED' | 'DISMISSED';
  task: { id: string; title: string; status: string } | null;
}

export interface MeetingIntelligenceProps {
  meetingId: string;
  canManage: boolean;
  aiEnabled: boolean;
  summary: string | null;
  decisions: string[];
  minutes: string | null;
  hasTranscript: boolean;
  actionItems: ActionItem[];
  members: { id: string; name: string }[];
}

/**
 * Painel de inteligência da reunião.
 *
 * Implementa o ciclo completo do diferencial do produto:
 *   transcrição → resumo → decisões → itens de ação → tarefas.
 *
 * Nenhuma tarefa é criada automaticamente: cada item precisa ser aceito por
 * uma pessoa, que pode ajustar responsável antes de confirmar.
 */
export function MeetingIntelligence({
  meetingId,
  canManage,
  aiEnabled,
  summary,
  decisions,
  minutes,
  hasTranscript,
  actionItems,
  members,
}: MeetingIntelligenceProps) {
  const [items, setItems] = useState(actionItems);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showTranscriptForm, setShowTranscriptForm] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const router = useRouter();

  const pending = items.filter((item) => item.status === 'SUGGESTED');
  const accepted = items.filter((item) => item.status === 'ACCEPTED');

  async function processTranscript() {
    const text = transcript.trim();
    if (text.length < 20) {
      toast.error('Cole uma transcrição com pelo menos 20 caracteres.');
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(`/api/reunioes/${meetingId}/transcricao`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível processar.');

      toast.success(
        `Resumo gerado com ${json.data.decisions.length} decisão(ões) e ${json.data.actionCount} item(ns) de ação.`,
      );
      setShowTranscriptForm(false);
      setTranscript('');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setProcessing(false);
    }
  }

  async function decide(item: ActionItem, decision: 'ACCEPT' | 'DISMISS') {
    setBusyItem(item.id);
    try {
      const response = await fetch(`/api/reunioes/${meetingId}/itens/${item.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision,
          assigneeId: assignees[item.id] || undefined,
          dueAt: item.dueAt ?? undefined,
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Não foi possível concluir.');
      }

      if (decision === 'ACCEPT') {
        const json = await response.json();
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: 'ACCEPTED', task: { id: json.data.id, title: json.data.title, status: json.data.status } }
              : entry,
          ),
        );
        toast.success('Tarefa criada a partir da reunião.');
      } else {
        setItems((current) =>
          current.map((entry) => (entry.id === item.id ? { ...entry, status: 'DISMISSED' } : entry)),
        );
      }

      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setBusyItem(null);
    }
  }

  if (!aiEnabled) {
    return (
      <Card className="border-accent/25">
        <CardContent className="flex items-start gap-3 pt-5">
          <Lock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <div>
            <p className="text-sm font-medium text-ink">Resumo automático não está no seu plano</p>
            <p className="mt-1 text-sm text-ink-subtle">
              Faça upgrade para que a Nexora gere resumo, decisões e itens de ação a partir da reunião.
            </p>
            <Button asChild size="sm" variant="secondary" className="mt-3">
              <Link href="/admin/assinatura">Ver planos</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Entrada da transcrição ────────────────────────────────────── */}
      {canManage ? (
        <Card className="border-accent/25 bg-accent/[0.03]">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-accent" aria-hidden />
                Inteligência da reunião
              </CardTitle>
              <p className="mt-1 text-xs text-ink-subtle">
                Cole a transcrição e a Nexora produz resumo, decisões e itens de ação.
              </p>
            </div>
            {!showTranscriptForm ? (
              <Button size="sm" variant="secondary" onClick={() => setShowTranscriptForm(true)}>
                <Wand2 className="size-3.5" aria-hidden />
                {hasTranscript ? 'Reprocessar' : 'Processar'}
              </Button>
            ) : null}
          </CardHeader>

          {showTranscriptForm ? (
            <CardContent className="space-y-3">
              <Textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                label="Transcrição da reunião"
                placeholder={'Lucas: Precisamos corrigir o problema do cliente até sexta.\nRafael: Eu assumo essa correção.'}
                hint="Cole o texto da gravação, da ata ou das suas anotações."
                className="min-h-40 font-mono text-[13px]"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={processTranscript} loading={processing}>
                  Gerar resumo e tarefas
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowTranscriptForm(false)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {/* ── Resumo ───────────────────────────────────────────────────── */}
      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" aria-hidden /> Resumo executivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">{summary}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Decisões ─────────────────────────────────────────────────── */}
      {decisions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-4 text-warning" aria-hidden /> Decisões ({decisions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {decisions.map((decision, index) => (
                <li key={index} className="flex items-start gap-2.5 text-sm text-ink-muted">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
                  {decision}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Itens de ação ────────────────────────────────────────────── */}
      {pending.length > 0 ? (
        <Card className="border-brand/25">
          <CardHeader>
            <div>
              <CardTitle>Itens de ação identificados ({pending.length})</CardTitle>
              <p className="mt-1 text-xs text-ink-subtle">
                Confirme para transformar em tarefa. Nada é criado sem a sua aprovação.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((item) => (
              <div key={item.id} className="rounded-xl border border-line bg-surface p-3.5">
                <p className="text-sm font-medium text-ink">{item.title}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                  {item.assigneeHint ? <span>Sugerido: {item.assigneeHint}</span> : null}
                  {item.dueAt ? <span>Prazo: {formatShortDate(item.dueAt)}</span> : item.dueHint ? <span>Prazo: {item.dueHint}</span> : null}
                  {item.confidence ? <span>Confiança: {Math.round(item.confidence * 100)}%</span> : null}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={assignees[item.id] ?? ''}
                    onChange={(event) =>
                      setAssignees((current) => ({ ...current, [item.id]: event.target.value }))
                    }
                    aria-label={`Responsável por: ${item.title}`}
                    className="h-9 flex-1 rounded-lg border border-line bg-surface-raised px-3 text-xs text-ink-muted focus:border-brand/60 focus:outline-none"
                  >
                    <option value="">
                      {item.assigneeHint ? `Usar sugestão (${item.assigneeHint})` : 'Sem responsável'}
                    </option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => decide(item, 'ACCEPT')}
                      loading={busyItem === item.id}
                      disabled={busyItem !== null}
                    >
                      <Check className="size-3.5" aria-hidden /> Criar tarefa
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => decide(item, 'DISMISS')}
                      disabled={busyItem !== null}
                      aria-label={`Descartar: ${item.title}`}
                    >
                      <X className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {accepted.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              Tarefas geradas nesta reunião ({accepted.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {accepted.map((item) =>
              item.task ? (
                <Link
                  key={item.id}
                  href={`/tarefas/${item.task.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-overlay hover:text-ink"
                >
                  <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.task.title}</span>
                  <Badge>{item.task.status === 'DONE' ? 'Concluída' : 'Aberta'}</Badge>
                </Link>
              ) : null,
            )}
          </CardContent>
        </Card>
      ) : null}

      {minutes ? (
        <Card>
          <CardHeader>
            <CardTitle>Ata completa</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">{minutes}</pre>
          </CardContent>
        </Card>
      ) : null}

      {!summary && !hasTranscript && !canManage ? (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-ink-subtle">
              O resumo aparece aqui depois que o organizador processar a transcrição da reunião.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
