'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KanbanSquare, List, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { TaskRow, type TaskRowData } from '@/components/app/task-row';
import { TaskKanban } from '../../tarefas/task-kanban';
import { TaskFormDialog, type TaskFormOption } from '../../tarefas/task-form-dialog';
import { cn } from '@/lib/utils/cn';

export function ProjectBoard({
  projectId,
  tasks: initialTasks,
  members,
  currentMembershipId,
  canCreate,
  canAssign,
}: {
  projectId: string;
  tasks: TaskRowData[];
  members: TaskFormOption[];
  currentMembershipId: string;
  canCreate: boolean;
  canAssign: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [createOpen, setCreateOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function move(taskId: string, status: TaskRowData['status'], position: number) {
    const previous = tasks;
    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status } : task)));

    try {
      const response = await fetch(`/api/tarefas/${taskId}/mover`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, position }),
      });
      if (!response.ok) throw new Error('falha');
      startTransition(() => router.refresh());
    } catch {
      setTasks(previous);
      toast.error('Não foi possível mover a tarefa.');
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl border border-line bg-surface p-0.5" role="tablist" aria-label="Visualização das tarefas">
          {(
            [
              { key: 'kanban' as const, label: 'Kanban', icon: KanbanSquare },
              { key: 'lista' as const, label: 'Lista', icon: List },
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
          <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden /> Nova tarefa
          </Button>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<KanbanSquare className="size-5" />}
            title="Nenhuma tarefa neste projeto"
            description="Adicione a primeira tarefa para começar a acompanhar o progresso."
            action={
              canCreate ? (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4" aria-hidden /> Nova tarefa
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : view === 'kanban' ? (
        <TaskKanban tasks={tasks} onMove={move} />
      ) : (
        <Card className="divide-y divide-line overflow-hidden p-0">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} showProject={false} />
          ))}
        </Card>
      )}

      {canCreate ? (
        <TaskFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          members={members}
          projects={[]}
          canAssign={canAssign}
          currentMembershipId={currentMembershipId}
          defaultProjectId={projectId}
          onCreated={(task) => {
            setTasks((current) => [task, ...current]);
            toast.success('Tarefa criada.');
            startTransition(() => router.refresh());
          }}
        />
      ) : null}
    </div>
  );
}
