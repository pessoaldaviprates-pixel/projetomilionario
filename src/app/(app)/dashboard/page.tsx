import Link from 'next/link';
import type { Metadata } from 'next';
import {
  AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardList,
  FolderKanban, MessageSquare, Sparkles, Users, Video,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { getCompanyOverview } from '@/server/services/company.service';
import { getTodayBoard } from '@/server/services/tasks.service';
import { getUpcoming } from '@/server/services/calendar.service';
import { listAnnouncements } from '@/server/services/announcements.service';
import { listPendingActions } from '@/server/services/ai.service';
import { getRecentActivity } from '@/server/services/metrics.service';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/app/stat-card';
import { TaskRow } from '@/components/app/task-row';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/misc';
import { formatLongDate, formatRelative, formatTime, pluralize } from '@/lib/utils/format';
import { ActivityLabel } from '@/components/app/activity-label';
import { AiSuggestionCard } from '@/components/app/ai-suggestion-card';

export const metadata: Metadata = { title: 'Início' };

export default async function DashboardPage() {
  const ctx = await requireAuth();

  // Um único await paralelo: nada de cascata de requisições no servidor.
  const [overview, board, upcoming, announcements, suggestions, activity] = await Promise.all([
    getCompanyOverview(ctx),
    getTodayBoard(ctx),
    getUpcoming(ctx, 4),
    listAnnouncements(ctx, { limit: 2 }),
    ctx.can('ai.use') ? listPendingActions(ctx, 3) : Promise.resolve([]),
    ctx.can('reports.view') ? getRecentActivity(ctx, 6) : Promise.resolve([]),
  ]);

  const firstName = ctx.user.name.split(' ')[0];
  const todayTasks = [...board.overdue, ...board.dueToday];

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}! 👋`}
        description={`Que bom te ver por aqui. Hoje é ${formatLongDate(new Date())}.`}
        actions={
          <Button asChild size="sm">
            <Link href="/hoje">
              Meu dia <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        }
      />

      <PageBody className="space-y-5">
        {/* ── Indicadores ─────────────────────────────────────────────── */}
        <section aria-label="Resumo" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Minhas tarefas"
            value={board.overdue.length + board.dueToday.length + board.inProgress.length}
            hint={
              board.overdue.length > 0
                ? `${pluralize(board.overdue.length, 'atrasada', 'atrasadas')}`
                : 'Nenhuma atrasada'
            }
            icon={ClipboardList}
            tone={board.overdue.length > 0 ? 'danger' : 'brand'}
            href="/tarefas?minhas=1"
          />
          <StatCard
            label="Reuniões de hoje"
            value={overview.meetingsToday}
            hint={`${pluralize(overview.upcomingMeetings, 'agendada', 'agendadas')} no total`}
            icon={Video}
            tone="accent"
            href="/reunioes"
          />
          <StatCard
            label="Projetos em andamento"
            value={overview.activeProjects}
            hint={`${pluralize(overview.openTasks, 'tarefa aberta', 'tarefas abertas')}`}
            icon={FolderKanban}
            tone="info"
            href="/projetos"
          />
          <StatCard
            label="Pessoas ativas"
            value={overview.activeMembers}
            hint={`${pluralize(overview.completedLast30, 'tarefa concluída', 'tarefas concluídas')} em 30 dias`}
            icon={Users}
            tone="success"
            href="/funcionarios"
          />
        </section>

        {/* ── Sugestões da IA ─────────────────────────────────────────── */}
        {suggestions.length > 0 ? (
          <section aria-label="Sugestões da inteligência artificial">
            <Card className="border-accent/25 bg-accent/[0.04]">
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4 text-accent" aria-hidden />
                    A Nexora identificou possíveis tarefas
                  </CardTitle>
                  <p className="mt-1 text-xs text-ink-subtle">
                    Sugestões a partir das suas conversas e reuniões. Nada é criado sem a sua confirmação.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestions.map((suggestion) => (
                  <AiSuggestionCard key={suggestion.id} suggestion={suggestion} />
                ))}
              </CardContent>
            </Card>
          </section>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-3">
          {/* ── Coluna principal ──────────────────────────────────────── */}
          <div className="space-y-5 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Tarefas de hoje</CardTitle>
                <Link href="/tarefas?minhas=1" className="text-xs font-medium text-brand hover:underline">
                  Ver todas
                </Link>
              </CardHeader>
              {todayTasks.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="size-5" />}
                  title="Nada vencendo hoje"
                  description="Você está em dia. Aproveite para adiantar o que vem pela frente."
                  action={
                    <Button asChild variant="secondary" size="sm">
                      <Link href="/tarefas">Ver todas as tarefas</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-line border-t border-line">
                  {todayTasks.slice(0, 7).map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              )}
            </Card>

            {board.overdue.length > 0 ? (
              <Card className="border-danger/25">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-danger">
                    <AlertTriangle className="size-4" aria-hidden />
                    {pluralize(board.overdue.length, 'tarefa atrasada', 'tarefas atrasadas')}
                  </CardTitle>
                </CardHeader>
                <div className="divide-y divide-line border-t border-line">
                  {board.overdue.slice(0, 4).map((task) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                </div>
              </Card>
            ) : null}

            {ctx.can('reports.view') && activity.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Atividade recente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {activity.map((log) => (
                    <div key={log.id} className="flex items-start gap-3">
                      {log.actor ? (
                        <Avatar
                          name={log.actor.user.name}
                          src={log.actor.user.avatarUrl}
                          id={log.actor.id}
                          size="xs"
                        />
                      ) : (
                        <span className="size-6 shrink-0 rounded-full bg-surface-overlay" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink-muted">
                          <span className="font-medium text-ink">{log.actor?.user.name ?? 'Sistema'}</span>{' '}
                          <ActivityLabel action={log.action} metadata={log.metadata} />
                        </p>
                        <p className="text-xs text-ink-faint">{formatRelative(log.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

          {/* ── Coluna lateral ────────────────────────────────────────── */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Próximos compromissos</CardTitle>
                <Link href="/agenda" className="text-xs font-medium text-brand hover:underline">
                  Agenda
                </Link>
              </CardHeader>
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="size-5" />}
                  title="Agenda livre"
                  description="Nenhum compromisso à vista."
                />
              ) : (
                <div className="divide-y divide-line border-t border-line">
                  {upcoming.map((event) => (
                    <Link
                      key={event.id}
                      href={event.meetingId ? `/reunioes/${event.meetingId}` : event.taskId ? `/tarefas/${event.taskId}` : '/agenda'}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-overlay"
                    >
                      <span
                        className={`mt-1 size-2 shrink-0 rounded-full ${
                          event.kind === 'MEETING' ? 'bg-brand' : event.kind === 'DEADLINE' ? 'bg-warning' : 'bg-accent'
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{event.title}</p>
                        <p className="mt-0.5 text-xs text-ink-faint">
                          {formatTime(event.startsAt)} — {formatTime(event.endsAt)}
                          {event.meeting
                            ? ` · ${pluralize(event.meeting._count.participants, 'participante', 'participantes')}`
                            : ''}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

            {announcements.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Avisos da empresa</CardTitle>
                  <Link href="/avisos" className="text-xs font-medium text-brand hover:underline">
                    Ver todos
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {announcements.map((announcement) => (
                    <Link key={announcement.id} href="/avisos" className="block space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={
                            announcement.severity === 'CRITICAL'
                              ? 'danger'
                              : announcement.severity === 'WARNING'
                                ? 'warning'
                                : announcement.severity === 'SUCCESS'
                                  ? 'success'
                                  : 'brand'
                          }
                        >
                          {announcement.severity === 'CRITICAL'
                            ? 'Crítico'
                            : announcement.severity === 'WARNING'
                              ? 'Atenção'
                              : 'Informativo'}
                        </Badge>
                        {!announcement.isRead ? <span className="size-1.5 rounded-full bg-brand" aria-label="Não lido" /> : null}
                      </div>
                      <p className="text-sm font-medium text-ink">{announcement.title}</p>
                      <p className="line-clamp-2 text-xs text-ink-subtle">{announcement.body}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card className="relative overflow-hidden border-brand/25">
              <div
                className="absolute -top-16 -right-16 size-48 rounded-full opacity-20 blur-3xl"
                style={{ background: 'radial-gradient(circle, #2E7DFF 0%, transparent 70%)' }}
                aria-hidden
              />
              <CardContent className="relative pt-5">
                <p className="text-sm font-semibold text-ink">Juntos vamos mais longe</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-subtle">
                  Converse com a equipe, transforme decisões em tarefas e acompanhe tudo em um só lugar.
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link href="/mensagens">
                    <MessageSquare className="size-4" aria-hidden /> Abrir mensagens
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
