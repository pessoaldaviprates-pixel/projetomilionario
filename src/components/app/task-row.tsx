import Link from 'next/link';
import { CheckCircle2, Circle, MessageSquare, Paperclip, ListChecks } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDueLabel } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export const PRIORITY_META = {
  URGENT: { label: 'Urgente', tone: 'danger' as const },
  HIGH: { label: 'Alta', tone: 'warning' as const },
  MEDIUM: { label: 'Média', tone: 'brand' as const },
  LOW: { label: 'Baixa', tone: 'neutral' as const },
};

export const STATUS_META = {
  TODO: { label: 'A fazer', tone: 'neutral' as const },
  IN_PROGRESS: { label: 'Em andamento', tone: 'brand' as const },
  IN_REVIEW: { label: 'Em revisão', tone: 'accent' as const },
  DONE: { label: 'Concluída', tone: 'success' as const },
  CANCELED: { label: 'Cancelada', tone: 'neutral' as const },
};

const DUE_TONES = {
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  neutral: 'text-ink-faint',
};

export interface TaskRowData {
  id: string;
  title: string;
  status: keyof typeof STATUS_META;
  priority: keyof typeof PRIORITY_META;
  dueAt: Date | null;
  tags?: string[];
  assignee?: { id: string; user: { name: string; avatarUrl: string | null } } | null;
  project?: { id: string; name: string; color: string; key: string } | null;
  checklistDone?: number;
  checklistTotal?: number;
  _count?: { subtasks: number; comments: number; checklist: number; files: number };
}

export function TaskRow({ task, showProject = true }: { task: TaskRowData; showProject?: boolean }) {
  const due = formatDueLabel(task.dueAt);
  const isDone = task.status === 'DONE';
  const priority = PRIORITY_META[task.priority];

  return (
    <Link
      href={`/tarefas/${task.id}`}
      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-overlay"
    >
      {isDone ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      ) : (
        <Circle
          className={cn(
            'mt-0.5 size-4 shrink-0',
            task.priority === 'URGENT' ? 'text-danger' : task.priority === 'HIGH' ? 'text-warning' : 'text-ink-faint',
          )}
          aria-hidden
        />
      )}

      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm', isDone ? 'text-ink-faint line-through' : 'text-ink')}>
          {task.title}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={DUE_TONES[due.tone]}>{due.label}</span>

          {showProject && task.project ? (
            <span className="flex items-center gap-1.5 text-ink-faint">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: task.project.color }} aria-hidden />
              {task.project.name}
            </span>
          ) : null}

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

          {task._count?.files ? (
            <span className="flex items-center gap-1 text-ink-faint">
              <Paperclip className="size-3" aria-hidden />
              {task._count.files}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {task.priority !== 'MEDIUM' && !isDone ? (
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
    </Link>
  );
}
