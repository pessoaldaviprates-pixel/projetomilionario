'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, KanbanSquare, List, ListTodo, Plus, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { TaskRow, type TaskRowData } from '@/components/app/task-row';
import { TaskKanban } from './task-kanban';
import { TaskFormDialog, type TaskFormOption } from './task-form-dialog';
import { cn } from '@/lib/utils/cn';

export interface TasksWorkspaceProps {
  initialTasks: TaskRowData[];
  members: TaskFormOption[];
  projects: { id: string; name: string; color: string }[];
  currentMembershipId: string;
  canCreate: boolean;
  canAssign: boolean;
  initialFilters: { onlyMine: boolean; projectId: string | null; search: string };
  openCreate?: boolean;
}

type View = 'lista' | 'kanban';

const STATUS_FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'abertas', label: 'Abertas' },
  { key: 'TODO', label: 'A fazer' },
  { key: 'IN_PROGRESS', label: 'Em andamento' },
  { key: 'IN_REVIEW', label: 'Em revisão' },
  { key: 'DONE', label: 'Concluídas' },
] as const;

export function TasksWorkspace({
  initialTasks,
  members,
  projects,
  currentMembershipId,
  canCreate,
  canAssign,
  initialFilters,
  openCreate,
}: TasksWorkspaceProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<View>('lista');
  const [statusFilter, setStatusFilter] = useState<string>('abertas');
  const [onlyMine, setOnlyMine] = useState(initialFilters.onlyMine);
  const [search, setSearch] = useState(initialFilters.search);
  const [projectId, setProjectId] = useState(initialFilters.projectId ?? '');
  const [createOpen, setCreateOpen] = useState(Boolean(openCreate));
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Filtro aplicado no cliente sobre a lista já escopada pelo servidor:
  // resposta instantânea sem uma ida ao banco por clique.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (onlyMine && task.assignee?.id !== currentMembershipId) return false;
      if (projectId && task.project?.id !== projectId) return false;
      if (statusFilter === 'abertas' && (task.status === 'DONE' || task.status === 'CANCELED')) return false;
      if (statusFilter !== 'todas' && statusFilter !== 'abertas' && task.status !== statusFilter) return false;
      if (term && !task.title.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [tasks, onlyMine, projectId, statusFilter, search, currentMembershipId]);

  async function moveTask(taskId: string, status: TaskRowData['status'], position: number) {
    const previous = tasks;

    // Atualização otimista: o cartão move na hora; erro reverte e avisa.
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, status, position } : task)),
    );

    try {
      const response = await fetch(`/api/tarefas/${taskId}/mover`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, position }),
      });
      if (!response.ok) throw new Error('falha ao mover');
      startTransition(() => router.refresh());
    } catch {
      setTasks(previous);
      toast.error('Não foi possível mover a tarefa.');
    }
  }

  function onCreated(task: TaskRowData) {
    setTasks((current) => [task, ...current]);
    toast.success('Tarefa criada.');
    startTransition(() => router.refresh());
  }

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="Tudo o que precisa ser feito, com prazo, responsável e contexto."
        actions={
          <>
            <div className="flex rounded-xl border border-line bg-surface p-0.5" role="tablist" aria-label="Modo de visualização">
              {(
                [
                  { key: 'lista' as const, label: 'Lista', icon: List },
                  { key: 'kanban' as const, label: 'Kanban', icon: KanbanSquare },
                ]
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="tab"
                  aria-selected={view === option.key}
                  onClick={() => setView(option.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    view === option.key ? 'bg-surface-overlay text-ink' : 'text-ink-subtle hover:text-ink',
                  )}
                >
                  <option.icon className="size-3.5" aria-hidden />
                  {option.label}
                </button>
              ))}
            </div>

            {canCreate ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" aria-hidden /> Nova tarefa
              </Button>
            ) : null}
          </>
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tarefa…"
              aria-label="Buscar tarefa"
              className="h-9 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-brand/60 focus:ring-2 focus:ring-brand/20 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyMine((current) => !current)}
              aria-pressed={onlyMine}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors',
                onlyMine
                  ? 'border-brand/40 bg-brand/12 text-brand-glow'
                  : 'border-line bg-surface text-ink-subtle hover:text-ink',
              )}
            >
              <User className="size-3.5" aria-hidden /> Minhas
            </button>

            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              aria-label="Filtrar por projeto"
              className="h-9 rounded-xl border border-line bg-surface px-3 text-xs text-ink-muted focus:border-brand/60 focus:outline-none"
            >
              <option value="">Todos os projetos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>

            <div className="flex flex-wrap gap-1">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setStatusFilter(filter.key)}
                  aria-pressed={statusFilter === filter.key}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    statusFilter === filter.key
                      ? 'bg-surface-overlay text-ink'
                      : 'text-ink-subtle hover:bg-surface-overlay hover:text-ink',
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PageHeader>

      <PageBody>
        <p className="mb-3 text-xs text-ink-faint" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'tarefa encontrada' : 'tarefas encontradas'}
        </p>

        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ListTodo className="size-5" />}
              title="Nenhuma tarefa encontrada"
              description={
                search || onlyMine || projectId
                  ? 'Tente ajustar os filtros para ver mais resultados.'
                  : 'Crie a primeira tarefa e comece a organizar o trabalho da equipe.'
              }
              action={
                canCreate ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-4" aria-hidden /> Nova tarefa
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : view === 'lista' ? (
          <Card className="divide-y divide-line overflow-hidden p-0">
            {filtered.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </Card>
        ) : (
          <TaskKanban tasks={filtered} onMove={moveTask} />
        )}
      </PageBody>

      {canCreate ? (
        <TaskFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          members={members}
          projects={projects}
          canAssign={canAssign}
          currentMembershipId={currentMembershipId}
          onCreated={onCreated}
        />
      ) : null}
    </>
  );
}
