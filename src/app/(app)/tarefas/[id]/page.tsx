import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, CalendarClock, FolderKanban, History, Link2,
  MessageSquare, Paperclip, Sparkles, User,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { getTask } from '@/server/services/tasks.service';
import { listMemberOptions } from '@/server/services/members.service';
import { NotFoundError } from '@/lib/http/errors';
import { PageBody } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PRIORITY_META, STATUS_META } from '@/components/app/task-row';
import { formatBytes } from '@/lib/storage/format';
import { formatDateTime, formatDueLabel, formatRelative } from '@/lib/utils/format';
import { TaskDetailPanel } from './task-detail-panel';
import { TaskComments } from './task-comments';

export const metadata: Metadata = { title: 'Tarefa' };

const ORIGIN_LABELS: Record<string, string> = {
  MANUAL: 'Criada manualmente',
  MESSAGE: 'Criada a partir de uma mensagem',
  MEETING: 'Criada a partir de uma reunião',
  AI: 'Sugerida pela inteligência artificial',
  AUTOMATION: 'Criada por automação',
  IMPORT: 'Importada',
};

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;

  let task;
  try {
    task = await getTask(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const members = await listMemberOptions(ctx);
  const due = formatDueLabel(task.dueAt);
  const canEdit =
    ctx.can('tasks.update') || task.assigneeId === ctx.membershipId || task.creatorId === ctx.membershipId;

  return (
    <>
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <Link
          href="/tarefas"
          className="inline-flex items-center gap-1.5 text-xs text-ink-subtle transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Voltar para tarefas
        </Link>
      </div>

      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* ── Conteúdo principal ────────────────────────────────────── */}
          <div className="space-y-5">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone={STATUS_META[task.status].tone}>{STATUS_META[task.status].label}</Badge>
                <Badge tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</Badge>
                {task.origin !== 'MANUAL' ? (
                  <Badge tone="accent">
                    <Sparkles className="size-3" aria-hidden />
                    {ORIGIN_LABELS[task.origin]}
                  </Badge>
                ) : null}
                {task.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-balance text-ink">{task.title}</h1>

              {task.parent ? (
                <p className="mt-2 text-sm text-ink-subtle">
                  Subtarefa de{' '}
                  <Link href={`/tarefas/${task.parent.id}`} className="text-brand hover:underline">
                    {task.parent.title}
                  </Link>
                </p>
              ) : null}

              {task.description ? (
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">
                  {task.description}
                </p>
              ) : null}
            </div>

            <TaskDetailPanel
              taskId={task.id}
              checklist={task.checklist}
              canEdit={canEdit}
            />

            {task.subtasks.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Subtarefas ({task.subtasks.length})</CardTitle>
                </CardHeader>
                <div className="divide-y divide-line border-t border-line">
                  {task.subtasks.map((subtask) => (
                    <Link
                      key={subtask.id}
                      href={`/tarefas/${subtask.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-overlay"
                    >
                      <Badge tone={STATUS_META[subtask.status].tone}>{STATUS_META[subtask.status].label}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{subtask.title}</span>
                      {subtask.assignee ? (
                        <Avatar
                          name={subtask.assignee.user.name}
                          src={subtask.assignee.user.avatarUrl}
                          id={subtask.assignee.id}
                          size="xs"
                        />
                      ) : null}
                    </Link>
                  ))}
                </div>
              </Card>
            ) : null}

            {/* Rastreabilidade: de onde esta tarefa veio. */}
            {task.sourceMessages.length > 0 ? (
              <Card className="border-accent/25">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="size-4 text-accent" aria-hidden />
                    Conversa de origem
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {task.sourceMessages.map((message) => (
                    <Link
                      key={message.id}
                      href={`/mensagens/${message.channel.id}`}
                      className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-surface-overlay"
                    >
                      <Avatar name={message.author.user.name} src={message.author.user.avatarUrl} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-ink-faint">
                          {message.author.user.name} em #{message.channel.name} · {formatRelative(message.createdAt)}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-muted">{message.body}</p>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <TaskComments taskId={task.id} comments={task.comments} />
          </div>

          {/* ── Metadados ─────────────────────────────────────────────── */}
          <aside className="space-y-4">
            <Card>
              <CardContent className="space-y-4 pt-5">
                <Meta label="Responsável" icon={User}>
                  {task.assignee ? (
                    <span className="flex items-center gap-2">
                      <Avatar
                        name={task.assignee.user.name}
                        src={task.assignee.user.avatarUrl}
                        id={task.assignee.id}
                        size="xs"
                      />
                      <span className="text-sm text-ink">{task.assignee.user.name}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-ink-faint">Sem responsável</span>
                  )}
                </Meta>

                <Meta label="Prazo" icon={CalendarClock}>
                  {task.dueAt ? (
                    <span className="text-sm text-ink">
                      {formatDateTime(task.dueAt)}
                      <span
                        className={`ml-2 text-xs ${
                          due.tone === 'danger' ? 'text-danger' : due.tone === 'warning' ? 'text-warning' : 'text-ink-faint'
                        }`}
                      >
                        {due.label}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm text-ink-faint">Sem prazo</span>
                  )}
                </Meta>

                {task.project ? (
                  <Meta label="Projeto" icon={FolderKanban}>
                    <Link
                      href={`/projetos/${task.project.id}`}
                      className="flex items-center gap-2 text-sm text-ink hover:text-brand"
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: task.project.color }} aria-hidden />
                      {task.project.name}
                    </Link>
                  </Meta>
                ) : null}

                <Meta label="Criada por" icon={User}>
                  <span className="text-sm text-ink-muted">
                    {task.creator.user.name} · {formatRelative(task.createdAt)}
                  </span>
                </Meta>
              </CardContent>
            </Card>

            {task.timeBlocks.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Blocos de foco</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {task.timeBlocks.map((block) => (
                    <p key={block.id} className="text-xs text-ink-muted">
                      {formatDateTime(block.startsAt)} — {formatDateTime(block.endsAt)}
                      {block.isDone ? ' · concluído' : ''}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {task.files.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="size-4" aria-hidden /> Arquivos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {task.files.map((file) => (
                    <a
                      key={file.id}
                      href={`/api/arquivos/${file.id}`}
                      className="flex items-center justify-between gap-2 text-sm text-ink-muted hover:text-ink"
                    >
                      <span className="truncate">{file.name}</span>
                      <span className="shrink-0 text-xs text-ink-faint">{formatBytes(file.sizeBytes)}</span>
                    </a>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {task.blockedBy.length > 0 || task.blocks.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Dependências</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {task.blockedBy.map(({ blocker }) => (
                    <p key={blocker.id} className="text-ink-muted">
                      Bloqueada por{' '}
                      <Link href={`/tarefas/${blocker.id}`} className="text-brand hover:underline">
                        {blocker.title}
                      </Link>
                    </p>
                  ))}
                  {task.blocks.map(({ blocked }) => (
                    <p key={blocked.id} className="text-ink-muted">
                      Bloqueia{' '}
                      <Link href={`/tarefas/${blocked.id}`} className="text-brand hover:underline">
                        {blocked.title}
                      </Link>
                    </p>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {task.activities.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="size-4" aria-hidden /> Histórico
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {task.activities.slice(0, 8).map((activity) => (
                    <p key={activity.id} className="text-xs text-ink-faint">
                      {activity.action === 'created'
                        ? 'Tarefa criada'
                        : `${activity.field ?? 'campo'} alterado`}{' '}
                      · {formatRelative(activity.createdAt)}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function Meta({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-ink-faint">
        <Icon className="size-3.5" aria-hidden /> {label}
      </p>
      {children}
    </div>
  );
}
