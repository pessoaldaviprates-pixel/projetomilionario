import Link from 'next/link';
import type { Metadata } from 'next';
import {
  AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, Flame, Target, Video,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { getTodayBoard } from '@/server/services/tasks.service';
import { getAgenda } from '@/server/services/calendar.service';
import { listPendingActions } from '@/server/services/ai.service';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Progress } from '@/components/ui/misc';
import { TaskRow } from '@/components/app/task-row';
import { AiSuggestionCard } from '@/components/app/ai-suggestion-card';
import { formatLongDate, formatTime, pluralize } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Meu dia' };

export default async function TodayPage() {
  const ctx = await requireAuth();

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [board, agenda, suggestions] = await Promise.all([
    getTodayBoard(ctx),
    getAgenda(ctx, { from: dayStart, to: dayEnd }),
    ctx.can('ai.use') ? listPendingActions(ctx, 4) : Promise.resolve([]),
  ]);

  const meetings = agenda.filter((item) => item.kind === 'MEETING');
  const focusBlocks = agenda.filter((item) => item.kind === 'TIME_BLOCK');

  const priorityTasks = [...board.overdue, ...board.dueToday, ...board.inProgress];
  // Deduplica: uma tarefa atrasada e em andamento apareceria duas vezes.
  const uniquePriority = Array.from(new Map(priorityTasks.map((task) => [task.id, task])).values());

  const completedFocus = focusBlocks.filter((block) => block.isDone).length;
  const focusProgress = focusBlocks.length === 0 ? 0 : Math.round((completedFocus / focusBlocks.length) * 100);

  return (
    <>
      <PageHeader
        title="Meu dia"
        description={formatLongDate(now)}
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/agenda">
              Abrir agenda <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      <PageBody className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            icon={Flame}
            tone={board.overdue.length > 0 ? 'danger' : 'success'}
            value={board.overdue.length}
            label={board.overdue.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}
          />
          <SummaryCard
            icon={Target}
            tone="brand"
            value={board.dueToday.length}
            label={board.dueToday.length === 1 ? 'entrega para hoje' : 'entregas para hoje'}
          />
          <SummaryCard
            icon={Video}
            tone="accent"
            value={meetings.length}
            label={meetings.length === 1 ? 'reunião hoje' : 'reuniões hoje'}
          />
        </section>

        {suggestions.length > 0 ? (
          <Card className="border-accent/25 bg-accent/[0.04]">
            <CardHeader>
              <CardTitle>Sugestões para revisar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestions.map((suggestion) => (
                <AiSuggestionCard key={suggestion.id} suggestion={suggestion} />
              ))}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            {board.overdue.length > 0 ? (
              <Card className="border-danger/25">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-danger">
                    <AlertTriangle className="size-4" aria-hidden />
                    Resolver primeiro
                  </CardTitle>
                </CardHeader>
                <div className="divide-y divide-line border-t border-line">
                  {board.overdue.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Prioridades do dia</CardTitle>
                <Link href="/tarefas?minhas=1" className="text-xs font-medium text-brand hover:underline">
                  Todas as tarefas
                </Link>
              </CardHeader>

              {uniquePriority.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="size-5" />}
                  title="Dia livre por enquanto"
                  description="Nenhuma tarefa atrasada ou vencendo hoje. Bom momento para adiantar o que vem."
                />
              ) : (
                <div className="divide-y divide-line border-t border-line">
                  {uniquePriority.map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              )}
            </Card>

            {board.upcoming.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Próximos dias</CardTitle>
                </CardHeader>
                <div className="divide-y divide-line border-t border-line">
                  {board.upcoming.slice(0, 5).map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              </Card>
            ) : null}
          </div>

          <aside className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="size-4" aria-hidden /> Agenda de hoje
                </CardTitle>
              </CardHeader>

              {agenda.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="size-5" />}
                  title="Sem compromissos"
                  description="Nenhuma reunião ou bloco reservado para hoje."
                />
              ) : (
                <div className="divide-y divide-line border-t border-line">
                  {agenda.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href ?? '/agenda'}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-overlay"
                    >
                      <span
                        className="mt-1 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color ?? '#2E7DFF' }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm ${item.isDone ? 'text-ink-faint line-through' : 'text-ink'}`}>
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {formatTime(item.startsAt)} — {formatTime(item.endsAt)}
                        </p>
                      </div>
                      {item.kind === 'TIME_BLOCK' ? <Badge tone="accent">Foco</Badge> : null}
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {focusBlocks.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="size-4" aria-hidden /> Blocos de foco
                  </CardTitle>
                  <span className="text-xs text-ink-faint tabular-nums">
                    {completedFocus}/{focusBlocks.length}
                  </span>
                </CardHeader>
                <CardContent>
                  <Progress value={focusProgress} tone={focusProgress === 100 ? 'success' : 'brand'} />
                  <p className="mt-2 text-xs text-ink-subtle">
                    {pluralize(focusBlocks.length - completedFocus, 'bloco pendente', 'blocos pendentes')} hoje.
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function SummaryCard({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'danger' | 'success' | 'accent';
  value: number;
  label: string;
}) {
  const tones = {
    brand: 'text-brand bg-brand/12',
    danger: 'text-danger bg-danger/12',
    success: 'text-success bg-success/12',
    accent: 'text-accent bg-accent/12',
  };

  return (
    <Card className="flex items-center gap-3.5 p-4">
      <span className={`flex size-9 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <div>
        <p className="text-2xl leading-none font-semibold text-ink tabular-nums">{value}</p>
        <p className="mt-1 text-sm text-ink-muted">{label}</p>
      </div>
    </Card>
  );
}
