import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/context';
import { listTasks } from '@/server/services/tasks.service';
import { listMemberOptions } from '@/server/services/members.service';
import { listProjects } from '@/server/services/projects.service';
import { TasksWorkspace } from './tasks-workspace';

export const metadata: Metadata = { title: 'Tarefas' };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ minhas?: string; projeto?: string; status?: string; q?: string; nova?: string }>;
}) {
  const ctx = await requireAuth();
  const params = await searchParams;

  const [tasks, members, projects] = await Promise.all([
    listTasks(ctx, {
      onlyMine: params.minhas === '1',
      projectId: params.projeto,
      search: params.q,
      includeDone: true,
    }),
    listMemberOptions(ctx),
    listProjects(ctx),
  ]);

  return (
    <TasksWorkspace
      initialTasks={tasks}
      members={members.map((member) => ({
        id: member.id,
        name: member.user.name,
        avatarUrl: member.user.avatarUrl,
      }))}
      projects={projects.map((project) => ({ id: project.id, name: project.name, color: project.color }))}
      currentMembershipId={ctx.membershipId}
      canCreate={ctx.can('tasks.create')}
      canAssign={ctx.can('tasks.assign')}
      initialFilters={{ onlyMine: params.minhas === '1', projectId: params.projeto ?? null, search: params.q ?? '' }}
      openCreate={params.nova === '1'}
    />
  );
}
