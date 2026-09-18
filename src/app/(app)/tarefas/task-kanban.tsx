'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, ListChecks } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_META, type TaskRowData } from '@/components/app/task-row';
import { formatDueLabel } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const COLUMNS = [
  { status: 'TODO' as const, label: 'A fazer', accent: 'bg-ink-faint' },
  { status: 'IN_PROGRESS' as const, label: 'Em andamento', accent: 'bg-brand' },
  { status: 'IN_REVIEW' as const, label: 'Em revisão', accent: 'bg-accent' },
  { status: 'DONE' as const, label: 'Concluída', accent: 'bg-success' },
];

const DUE_TONES = {
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  neutral: 'text-ink-faint',
};

export interface TaskKanbanProps {
  tasks: TaskRowData[];
  onMove: (taskId: string, status: TaskRowData['status'], position: number) => void;
}

/**
 * Kanban com arrastar e soltar nativo (HTML5 Drag and Drop).
 *
 * Optamos pela API nativa em vez de uma biblioteca: menos 30 KB no bundle e
 * suporte a teclado implementado explicitamente abaixo — mover cartão sem
 * mouse é requisito de acessibilidade, não um extra.
 */
export function TaskKanban({ tasks, onMove }: TaskKanbanProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  function drop(status: TaskRowData['status']) {
    if (!dragging) return;
    const task = tasks.find((item) => item.id === dragging);
    if (task && task.status !== status) {
      onMove(dragging, status, 0);
    }
    setDragging(null);
    setOverColumn(null);
  }

  /** Move a tarefa entre colunas com as setas do teclado. */
  function onCardKeyDown(event: React.KeyboardEvent, task: TaskRowData) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();

    const currentIndex = COLUMNS.findIndex((column) => column.status === task.status);
    const nextIndex = event.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1;
    const target = COLUMNS[nextIndex];
    if (target) onMove(task.id, target.status, 0);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status);

        return (
          <section
            key={column.status}
            aria-label={`Coluna ${column.label}`}
            onDragOver={(event) => {
              event.preventDefault();
              setOverColumn(column.status);
            }}
            onDragLeave={() => setOverColumn((current) => (current === column.status ? null : current))}
            onDrop={() => drop(column.status)}
            className={cn(
              'flex min-h-32 flex-col rounded-card border bg-surface-raised/60 transition-colors',
              overColumn === column.status ? 'border-brand/50 bg-brand/[0.04]' : 'border-line',
            )}
          >
            <header className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
              <span className={cn('size-2 rounded-full', column.accent)} aria-hidden />
              <h2 className="text-xs font-semibold text-ink">{column.label}</h2>
              <span className="ml-auto text-xs text-ink-faint tabular-nums">{columnTasks.length}</span>
            </header>

            <div className="flex flex-1 flex-col gap-2 p-2">
              {columnTasks.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-ink-faint">Nenhuma tarefa</p>
              ) : (
                columnTasks.map((task) => {
                  const due = formatDueLabel(task.dueAt);
                  const priority = PRIORITY_META[task.priority];

                  return (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                      onKeyDown={(event) => onCardKeyDown(event, task)}
                      tabIndex={0}
                      aria-label={`${task.title}. Coluna ${column.label}. Use as setas esquerda e direita para mover.`}
                      className={cn(
                        'cursor-grab rounded-xl border border-line bg-surface-raised p-3 transition-all active:cursor-grabbing',
                        'hover:border-line-strong focus-visible:border-brand',
                        dragging === task.id ? 'opacity-40' : '',
                      )}
                    >
                      <Link href={`/tarefas/${task.id}`} className="block">
                        <p className="text-sm leading-snug text-ink">{task.title}</p>
                      </Link>

                      {task.project ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: task.project.color }} aria-hidden />
                          {task.project.name}
                        </p>
                      ) : null}

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          {task.dueAt ? <span className={DUE_TONES[due.tone]}>{due.label}</span> : null}
                          {task.checklistTotal ? (
                            <span className="flex items-center gap-1 text-ink-faint">
                              <ListChecks className="size-3" aria-hidden />
                              {task.checklistDone}/{task.checklistTotal}
                            </span>
                          ) : null}
                          {task._count?.comments ? (
                            <span className="flex items-center gap-1 text-ink-faint">
                              <MessageSquare className="size-3" aria-hidden />
                              {task._count.comments}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {task.priority !== 'MEDIUM' ? (
                            <Badge tone={priority.tone}>{priority.label}</Badge>
                          ) : null}
                          {task.assignee ? (
                            <Avatar
                              name={task.assignee.user.name}
                              src={task.assignee.user.avatarUrl}
                              id={task.assignee.id}
                              size="xs"
                            />
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
