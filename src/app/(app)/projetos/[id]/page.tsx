import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, CalendarClock, FileText, Hash, ListTodo, MessageSquare, Users, Video,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { getProject } from '@/server/services/projects.service';
import { listMemberOptions } from '@/server/services/members.service';
import { NotFoundError } from '@/lib/http/errors';
import { PageBody } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarStack } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/misc';
import { formatBytes } from '@/lib/storage/format';
import { formatDateTime, formatDueLabel, pluralize } from '@/lib/utils/format';
import { ProjectBoard } from './project-board';

export const metadata: Metadata = { title: 'Projeto' };

const STATUS_META = {
  PLANNING: { label: 'Planejamento', tone: 'neutral' as const },
  ACTIVE: { label: 'Em andamento', tone: 'brand' as const },
  ON_HOLD: { label: 'Pausado', tone: 'warning' as const },
  COMPLETED: { label: 'Concluído', tone: 'success' as const },
  CANCELED: { label: 'Cancelado', tone: 'danger' as const },
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;

  let project;
  try {
    project = await getProject(ctx, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const members = await listMemberOptions(ctx);
  const due = formatDueLabel(project.dueAt);
  const status = STATUS_META[project.status];
  const openTasks = project.tasks.filter((task) => task.status !== 'DONE' && task.status !== 'CANCELED').length;

  return (
    <>
      <div className="border-b border-line px-4 py-4 sm:px-6">
        <Link
          href="/projetos"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-ink-subtle transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Voltar para projetos
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: project.color }} aria-hidden />
              <Badge tone={status.tone}>{status.label}</Badge>
              <Badge>{project.key}</Badge>
              {project.dueAt ? (
                <Badge tone={due.tone === 'danger' ? 'danger' : 'neutral'}>
                  <CalendarClock className="size-3" aria-hidden /> {due.label}
                </Badge>
              ) : null}
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-balance text-ink">{project.name}</h1>
            {project.description ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{project.description}</p>
            ) : null}
          </div>

          <div className="w-full shrink-0 space-y-2 lg:w-64">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-faint">Progresso</span>
              <span className="font-medium text-ink tabular-nums">{project.progress}%</span>
            </div>
            <Progress value={project.progress} tone={project.progress === 100 ? 'success' : 'brand'} />
            <p className="text-xs text-ink-faint">
              {pluralize(openTasks, 'tarefa aberta', 'tarefas abertas')} de {project.tasks.length}
            </p>
          </div>
        </div>
      </div>

      <PageBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat icon={ListTodo} label="Tarefas" value={project.tasks.length} />
          <MiniStat icon={Users} label="Pessoas" value={project.members.length} />
          <MiniStat icon={Video} label="Reuniões" value={project.meetings.length} />
          <MiniStat icon={FileText} label="Arquivos" value={project.files.length} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <ProjectBoard
            projectId={project.id}
            tasks={project.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              status: task.status,
              priority: task.priority,
              dueAt: task.dueAt,
              tags: task.tags,
              assignee: task.assignee,
              project: null,
              _count: { subtasks: task._count.subtasks, comments: task._count.comments, checklist: 0, files: 0 },
            }))}
            members={members.map((member) => ({
              id: member.id,
              name: member.user.name,
              avatarUrl: member.user.avatarUrl,
            }))}
            currentMembershipId={ctx.membershipId}
            canCreate={ctx.can('tasks.create')}
            canAssign={ctx.can('tasks.assign')}
          />

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Equipe</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {project.lead ? (
                  <div className="flex items-center gap-2.5 border-b border-line pb-3">
                    <Avatar
                      name={project.lead.user.name}
                      src={project.lead.user.avatarUrl}
                      id={project.lead.id}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{project.lead.user.name}</p>
                      <p className="text-xs text-ink-faint">Responsável</p>
                    </div>
                  </div>
                ) : null}

                {project.members.map((member) => (
                  <div key={member.membership.id} className="flex items-center gap-2.5">
                    <Avatar
                      name={member.membership.user.name}
                      src={member.membership.user.avatarUrl}
                      id={member.membership.id}
                      size="xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink-muted">{member.membership.user.name}</p>
                    </div>
                    <span className="text-xs" style={{ color: member.membership.role.color }}>
                      {member.membership.role.name}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {project.channels.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="size-4" aria-hidden /> Conversas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {project.channels.map((channel) => (
                    <Link
                      key={channel.id}
                      href={`/mensagens/${channel.id}`}
                      className="flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-brand"
                    >
                      <Hash className="size-3.5 text-ink-faint" aria-hidden /> {channel.name}
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {project.meetings.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="size-4" aria-hidden /> Próximas reuniões
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {project.meetings.map((meeting) => (
                    <Link key={meeting.id} href={`/reunioes/${meeting.id}`} className="block">
                      <p className="truncate text-sm text-ink-muted hover:text-brand">{meeting.title}</p>
                      <p className="text-xs text-ink-faint">{formatDateTime(meeting.startsAt)}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {project.files.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="size-4" aria-hidden /> Arquivos recentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {project.files.map((file) => (
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
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <Icon className="size-4 text-ink-faint" aria-hidden />
      <div>
        <p className="text-lg leading-none font-semibold text-ink tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-ink-subtle">{label}</p>
      </div>
    </Card>
  );
}
