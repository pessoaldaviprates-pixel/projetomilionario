import Link from 'next/link';
import type { Metadata } from 'next';
import { FolderKanban, Plus } from 'lucide-react';
import { requireAuth } from '@/lib/auth/context';
import { listProjects } from '@/server/services/projects.service';
import { listMemberOptions } from '@/server/services/members.service';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AvatarStack } from '@/components/ui/avatar';
import { EmptyState, Progress } from '@/components/ui/misc';
import { formatDueLabel, pluralize } from '@/lib/utils/format';
import { ProjectCreateButton } from './project-create-button';

export const metadata: Metadata = { title: 'Projetos' };

const STATUS_META = {
  PLANNING: { label: 'Planejamento', tone: 'neutral' as const },
  ACTIVE: { label: 'Em andamento', tone: 'brand' as const },
  ON_HOLD: { label: 'Pausado', tone: 'warning' as const },
  COMPLETED: { label: 'Concluído', tone: 'success' as const },
  CANCELED: { label: 'Cancelado', tone: 'danger' as const },
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ novo?: string }>;
}) {
  const ctx = await requireAuth();
  const params = await searchParams;

  const [projects, members] = await Promise.all([listProjects(ctx), listMemberOptions(ctx)]);

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Cada projeto reúne suas tarefas, reuniões, arquivos e conversas."
        actions={
          ctx.can('projects.create') ? (
            <ProjectCreateButton
              members={members.map((member) => ({
                id: member.id,
                name: member.user.name,
                avatarUrl: member.user.avatarUrl,
              }))}
              currentMembershipId={ctx.membershipId}
              openInitially={params.novo === '1'}
            />
          ) : null
        }
      />

      <PageBody>
        {projects.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FolderKanban className="size-5" />}
              title="Nenhum projeto ainda"
              description="Crie o primeiro projeto para organizar entregas, prazos e time em um só lugar."
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const due = formatDueLabel(project.dueAt);
              const status = STATUS_META[project.status];

              return (
                <Link key={project.id} href={`/projetos/${project.id}`}>
                  <Card className="h-full p-5 transition-colors hover:border-brand/40">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: project.color }}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-semibold text-ink">{project.name}</h2>
                          <p className="text-xs text-ink-faint">{project.key}</p>
                        </div>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>

                    {project.description ? (
                      <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-ink-subtle">
                        {project.description}
                      </p>
                    ) : null}

                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-ink-faint">Progresso</span>
                      <span className="font-medium text-ink tabular-nums">{project.progress}%</span>
                    </div>
                    <Progress
                      value={project.progress}
                      tone={project.progress === 100 ? 'success' : 'brand'}
                      label={`Progresso do projeto ${project.name}`}
                    />

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <AvatarStack
                        people={project.members.map((member) => ({
                          id: member.membership.id,
                          name: member.membership.user.name,
                          avatarUrl: member.membership.user.avatarUrl,
                        }))}
                        max={4}
                        size="xs"
                      />
                      <div className="text-right text-xs">
                        <p className="text-ink-muted">
                          {pluralize(project.openTasks, 'tarefa aberta', 'tarefas abertas')}
                        </p>
                        {project.dueAt ? (
                          <p className={due.tone === 'danger' ? 'text-danger' : 'text-ink-faint'}>{due.label}</p>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
