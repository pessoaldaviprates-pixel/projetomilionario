import type { Metadata } from 'next';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, MessageSquare, TrendingUp, Users, Video,
} from 'lucide-react';
import { requirePermission } from '@/lib/auth/context';
import { getCompanyOverview } from '@/server/services/company.service';
import {
  getProductivityStats, getRecentActivity, getStatusBreakdown, getTaskTrend, getWorkloadByMember,
} from '@/server/services/metrics.service';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/app/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/misc';
import { ActivityLabel } from '@/components/app/activity-label';
import { formatBytes } from '@/lib/storage/format';
import { formatRelative, pluralize } from '@/lib/utils/format';
import { TaskTrendChart } from './task-trend-chart';

export const metadata: Metadata = { title: 'Painel administrativo' };

export default async function AdminDashboardPage() {
  const ctx = await requirePermission('reports.view');

  const [overview, stats, trend, workload, breakdown, activity] = await Promise.all([
    getCompanyOverview(ctx),
    getProductivityStats(ctx),
    getTaskTrend(ctx, 14),
    getWorkloadByMember(ctx),
    getStatusBreakdown(ctx),
    getRecentActivity(ctx, 10),
  ]);

  const maxWorkload = Math.max(1, ...workload.map((entry) => entry.openTasks));
  const totalByStatus = breakdown.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <PageHeader
        title="Painel administrativo"
        description={`Visão geral da ${ctx.company.name} nos últimos 30 dias.`}
      />

      <PageBody className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pessoas ativas" value={overview.activeMembers} icon={Users} tone="brand" href="/funcionarios" />
          <StatCard
            label="Tarefas concluídas"
            value={stats.completed}
            hint={`${stats.created} criadas no período`}
            icon={CheckCircle2}
            tone="success"
          />
          <StatCard
            label="Tarefas atrasadas"
            value={stats.overdue}
            hint={stats.overdue === 0 ? 'Tudo em dia' : 'Precisam de atenção'}
            icon={AlertTriangle}
            tone={stats.overdue > 0 ? 'danger' : 'success'}
            href="/tarefas"
          />
          <StatCard
            label="Reuniões realizadas"
            value={stats.meetings}
            hint={`${formatBytes(overview.storageBytes)} em arquivos`}
            icon={Video}
            tone="accent"
            href="/reunioes"
          />
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>Tarefas criadas e concluídas</CardTitle>
                <p className="mt-1 text-xs text-ink-subtle">Últimos 14 dias</p>
              </div>
            </CardHeader>
            <CardContent>
              <TaskTrendChart data={trend} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Indicadores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Metric
                icon={TrendingUp}
                label="Taxa de conclusão"
                /* Só reportamos a taxa quando houve tarefa criada no período —
                   dividir por zero viraria um número enganoso. */
                value={stats.completionRate === null ? 'Sem dados' : `${stats.completionRate}%`}
                hint={stats.completionRate === null ? 'Nenhuma tarefa criada no período' : 'concluídas / criadas'}
              />
              <Metric
                icon={Clock}
                label="Tempo médio de conclusão"
                value={stats.avgCycleHours === null ? 'Sem dados' : `${stats.avgCycleHours} h`}
                hint={
                  stats.sampleSize === 0
                    ? 'Nenhuma tarefa concluída no período'
                    : `com base em ${pluralize(stats.sampleSize, 'tarefa', 'tarefas')}`
                }
              />
              <Metric
                icon={MessageSquare}
                label="Mensagens trocadas"
                value={String(stats.messages)}
                hint="nos últimos 30 dias"
              />
              <Metric
                icon={Activity}
                label="Projetos em andamento"
                value={String(overview.activeProjects)}
                hint={`${pluralize(overview.openTasks, 'tarefa aberta', 'tarefas abertas')}`}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Carga por pessoa</CardTitle>
              <span className="text-xs text-ink-faint">tarefas abertas</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {workload.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-faint">Nenhuma tarefa atribuída no momento.</p>
              ) : (
                workload.map((entry) => (
                  <div key={entry.membershipId} className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={entry.name} src={entry.avatarUrl} id={entry.membershipId} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{entry.name}</span>
                      <span className="shrink-0 text-xs text-ink-faint tabular-nums">{entry.openTasks}</span>
                    </div>
                    <Progress
                      value={(entry.openTasks / maxWorkload) * 100}
                      tone={entry.openTasks > maxWorkload * 0.8 ? 'warning' : 'brand'}
                      label={`${entry.name}: ${entry.openTasks} tarefas abertas`}
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição por status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {totalByStatus === 0 ? (
                <p className="py-4 text-center text-sm text-ink-faint">Nenhuma tarefa cadastrada.</p>
              ) : (
                breakdown.map((row) => {
                  const percent = Math.round((row.count / totalByStatus) * 100);
                  const tone =
                    row.status === 'DONE' ? 'success' : row.status === 'IN_PROGRESS' ? 'brand' : 'warning';

                  return (
                    <div key={row.status} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ink-muted">{row.label}</span>
                        <span className="text-ink-faint tabular-nums">
                          {row.count} ({percent}%)
                        </span>
                      </div>
                      <Progress value={percent} tone={tone as 'brand'} label={`${row.label}: ${percent}%`} />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Atividade recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-faint">Nenhuma atividade registrada.</p>
            ) : (
              activity.map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  {log.actor ? (
                    <Avatar name={log.actor.user.name} src={log.actor.user.avatarUrl} id={log.actor.id} size="xs" />
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
              ))
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{value}</p>
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="text-[11px] text-ink-faint">{hint}</p>
      </div>
    </div>
  );
}
