'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AiSuggestionCard, type AiSuggestion } from '@/components/app/ai-suggestion-card';
import { formatRelative } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface ChatTurn {
  role: 'USER' | 'ASSISTANT';
  content: string;
  sources?: { type: string; id: string; label: string }[];
}

const EXAMPLES = [
  'O que eu tenho para hoje?',
  'Quais tarefas estão atrasadas?',
  'Quando é minha próxima reunião?',
  'Quais foram as decisões das reuniões recentes?',
  'Como está o andamento dos projetos?',
];

const SOURCE_PATHS: Record<string, string> = {
  task: '/tarefas',
  meeting: '/reunioes',
  project: '/projetos',
};

export function AssistantWorkspace({
  threads,
  suggestions,
  enabled,
  userName,
  companyName,
}: {
  threads: { id: string; title: string; updatedAt: string; messageCount: number }[];
  suggestions: AiSuggestion[];
  enabled: boolean;
  userName: string;
  companyName: string;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [threadId, setThreadId] = useState<string | undefined>();
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    setTurns((current) => [...current, { role: 'USER', content: trimmed }]);
    setQuestion('');
    setPending(true);

    try {
      const response = await fetch('/api/ia/perguntar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: trimmed, threadId }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível responder.');

      setThreadId(json.data.threadId);
      setTurns((current) => [
        ...current,
        { role: 'ASSISTANT', content: json.data.message.content, sources: json.data.sources },
      ]);

      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
      router.refresh();
    } catch (error) {
      setTurns((current) => [
        ...current,
        {
          role: 'ASSISTANT',
          content:
            error instanceof Error
              ? `Não consegui responder: ${error.message}`
              : 'Não consegui responder agora. Tente novamente.',
        },
      ]);
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  if (!enabled) {
    return (
      <>
        <PageHeader title="Assistente" description="Pergunte sobre o seu trabalho e receba respostas com base nos seus dados." />
        <PageBody>
          <Card className="border-accent/25">
            <CardContent className="flex items-start gap-3 pt-5">
              <Lock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <div>
                <p className="text-sm font-medium text-ink">O assistente não está incluído no seu plano</p>
                <p className="mt-1 text-sm text-ink-subtle">
                  Faça upgrade para perguntar sobre tarefas, reuniões e projetos em linguagem natural.
                </p>
                <Button asChild size="sm" variant="secondary" className="mt-3">
                  <Link href="/admin/assinatura">Ver planos</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Assistente Nexora"
        description="Respostas baseadas apenas no que você tem permissão para ver."
      />

      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <Card className="flex min-h-[520px] flex-col overflow-hidden p-0">
            <div className="flex-1 space-y-4 overflow-y-auto p-5 scrollbar-thin">
              {turns.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent/12 text-accent">
                    <Sparkles className="size-6" aria-hidden />
                  </div>
                  <p className="text-base font-medium text-ink">
                    Olá{userName ? `, ${userName}` : ''}! Como posso ajudar?
                  </p>
                  <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-subtle">
                    Pergunte sobre as suas tarefas, reuniões e projetos na {companyName}. Eu só enxergo o que
                    você mesmo pode acessar.
                  </p>

                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {EXAMPLES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => ask(example)}
                        className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted transition-colors hover:border-brand/40 hover:text-ink"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                turns.map((turn, index) => (
                  <div
                    key={index}
                    className={cn('flex gap-3', turn.role === 'USER' ? 'justify-end' : 'justify-start')}
                  >
                    {turn.role === 'ASSISTANT' ? (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
                        <Sparkles className="size-3.5" aria-hidden />
                      </span>
                    ) : null}

                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-2.5',
                        turn.role === 'USER'
                          ? 'bg-brand text-white'
                          : 'border border-line bg-surface text-ink-muted',
                      )}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.content}</p>

                      {turn.sources && turn.sources.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
                          {turn.sources.slice(0, 5).map((source) => (
                            <Link
                              key={`${source.type}-${source.id}`}
                              href={`${SOURCE_PATHS[source.type] ?? ''}/${source.id}`}
                              className="rounded-md border border-line px-2 py-0.5 text-[11px] text-ink-faint transition-colors hover:border-brand/40 hover:text-brand"
                            >
                              {source.label}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}

              {pending ? (
                <div className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
                    <Sparkles className="size-3.5 animate-pulse-soft" aria-hidden />
                  </span>
                  <div className="rounded-2xl border border-line bg-surface px-4 py-2.5">
                    <p className="text-sm text-ink-faint">Consultando seus dados…</p>
                  </div>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                ask(question);
              }}
              className="flex gap-2 border-t border-line p-3"
            >
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Pergunte alguma coisa…"
                aria-label="Sua pergunta"
                maxLength={2000}
                className="h-10 flex-1 rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand/60 focus:ring-2 focus:ring-brand/20 focus:outline-none"
              />
              <Button type="submit" size="icon" loading={pending} disabled={!question.trim()} aria-label="Enviar pergunta">
                <Send className="size-4" aria-hidden />
              </Button>
            </form>
          </Card>

          <aside className="space-y-4">
            {suggestions.length > 0 ? (
              <Card className="border-accent/25">
                <CardHeader>
                  <CardTitle>Sugestões pendentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <AiSuggestionCard key={suggestion.id} suggestion={suggestion} />
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {threads.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Conversas anteriores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {threads.slice(0, 10).map((thread) => (
                    <div key={thread.id} className="space-y-0.5">
                      <p className="truncate text-sm text-ink-muted">{thread.title}</p>
                      <p className="text-xs text-ink-faint">
                        {thread.messageCount} mensagens · {formatRelative(thread.updatedAt)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Como funciona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs leading-relaxed text-ink-subtle">
                <p>
                  <Badge tone="brand" className="mr-1.5">1</Badge>
                  O assistente consulta apenas dados da {companyName} que o seu cargo permite acessar.
                </p>
                <p>
                  <Badge tone="brand" className="mr-1.5">2</Badge>
                  As respostas citam a origem: você pode abrir a tarefa, reunião ou projeto usado.
                </p>
                <p>
                  <Badge tone="brand" className="mr-1.5">3</Badge>
                  Ele nunca cria nem altera nada sozinho — apenas propõe, e você confirma.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
