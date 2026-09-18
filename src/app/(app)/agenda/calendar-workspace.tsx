'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, GripVertical, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { formatTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export interface AgendaItemDto {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: string | null;
  location: string | null;
  meetingId: string | null;
  taskId: string | null;
  projectName: string | null;
  href: string | null;
  isDone?: boolean;
}

interface UnscheduledTask {
  id: string;
  title: string;
  priority: string;
  dueAt: string | null;
  estimateMinutes: number | null;
}

type View = 'dia' | 'semana' | 'mes';

const KIND_COLORS: Record<string, string> = {
  MEETING: '#2E7DFF',
  DEADLINE: '#F59E0B',
  TASK: '#F59E0B',
  TIME_BLOCK: '#8B5CF6',
  FOCUS: '#8B5CF6',
  REMINDER: '#06B6D4',
  EVENT: '#22C55E',
  OUT_OF_OFFICE: '#94A3B8',
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

export function CalendarWorkspace({
  initialItems,
  unscheduledTasks,
  timeBlockingEnabled,
  canManage,
}: {
  initialItems: AgendaItemDto[];
  unscheduledTasks: UnscheduledTask[];
  timeBlockingEnabled: boolean;
  canManage: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [view, setView] = useState<View>('semana');
  const [anchor, setAnchor] = useState(() => new Date());
  const [draggingTask, setDraggingTask] = useState<UnscheduledTask | null>(null);
  const router = useRouter();

  const today = startOfDay(new Date());

  const visibleDays = useMemo(() => {
    if (view === 'dia') return [startOfDay(anchor)];

    if (view === 'semana') {
      const weekStart = addDays(startOfDay(anchor), -anchor.getDay());
      return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    }

    // Mês: grade completa começando no domingo da primeira semana.
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = addDays(monthStart, -monthStart.getDay());
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [anchor, view]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, AgendaItemDto[]>();
    for (const item of items) {
      const key = startOfDay(new Date(item.startsAt)).toDateString();
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [items]);

  function navigate(direction: -1 | 1) {
    if (view === 'dia') setAnchor((current) => addDays(current, direction));
    else if (view === 'semana') setAnchor((current) => addDays(current, direction * 7));
    else setAnchor((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  /** Solta uma tarefa num horário: cria o bloco de foco ligado à tarefa. */
  async function dropTask(day: Date, hour: number) {
    if (!draggingTask || !timeBlockingEnabled) return;

    const startsAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
    const duration = draggingTask.estimateMinutes ?? 60;
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);

    const task = draggingTask;
    setDraggingTask(null);

    try {
      const response = await fetch('/api/agenda/blocos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          title: task.title,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível criar o bloco.');

      setItems((current) => [
        ...current,
        {
          id: json.data.id,
          title: task.title,
          kind: 'TIME_BLOCK',
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          allDay: false,
          color: KIND_COLORS.TIME_BLOCK!,
          location: null,
          meetingId: null,
          taskId: task.id,
          projectName: null,
          href: `/tarefas/${task.id}`,
          isDone: false,
        },
      ]);

      toast.success('Bloco de foco criado na agenda.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    }
  }

  const periodLabel =
    view === 'mes'
      ? anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      : view === 'semana'
        ? `${visibleDays[0]!.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${visibleDays[6]!.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
        : anchor.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Reuniões, prazos e blocos de foco no mesmo calendário."
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Período anterior">
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
                Hoje
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => navigate(1)} aria-label="Próximo período">
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="flex rounded-xl border border-line bg-surface p-0.5" role="tablist" aria-label="Visualização do calendário">
              {(['dia', 'semana', 'mes'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={view === option}
                  onClick={() => setView(option)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                    view === option ? 'bg-surface-overlay text-ink' : 'text-ink-subtle hover:text-ink',
                  )}
                >
                  {option === 'mes' ? 'Mês' : option}
                </button>
              ))}
            </div>
          </>
        }
      >
        <p className="text-sm font-medium text-ink capitalize">{periodLabel}</p>
      </PageHeader>

      <PageBody>
        <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
          <div>
            {view === 'mes' ? (
              <MonthGrid days={visibleDays} itemsByDay={itemsByDay} anchor={anchor} today={today} />
            ) : (
              <TimeGrid
                days={visibleDays}
                itemsByDay={itemsByDay}
                today={today}
                onDropTask={dropTask}
                dropEnabled={Boolean(draggingTask) && timeBlockingEnabled}
              />
            )}
          </div>

          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="size-4" aria-hidden /> Time blocking
                  </CardTitle>
                  <p className="mt-1 text-xs text-ink-subtle">
                    {timeBlockingEnabled
                      ? 'Arraste uma tarefa para um horário e reserve o tempo.'
                      : 'Disponível a partir do plano Profissional.'}
                  </p>
                </div>
              </CardHeader>

              <CardContent className="space-y-2">
                {unscheduledTasks.length === 0 ? (
                  <p className="py-4 text-center text-xs text-ink-faint">Nenhuma tarefa aberta.</p>
                ) : (
                  unscheduledTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable={timeBlockingEnabled}
                      onDragStart={() => setDraggingTask(task)}
                      onDragEnd={() => setDraggingTask(null)}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border border-line bg-surface p-2.5 text-xs',
                        timeBlockingEnabled ? 'cursor-grab active:cursor-grabbing hover:border-brand/40' : 'opacity-60',
                      )}
                    >
                      {timeBlockingEnabled ? (
                        <GripVertical className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/tarefas/${task.id}`}
                          className="flex min-h-6 items-center truncate py-0.5 text-ink hover:text-brand"
                        >
                          {task.title}
                        </Link>
                        {task.priority === 'URGENT' || task.priority === 'HIGH' ? (
                          <Badge tone={task.priority === 'URGENT' ? 'danger' : 'warning'} className="mt-1">
                            {task.priority === 'URGENT' ? 'Urgente' : 'Alta'}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Legenda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  ['MEETING', 'Reunião'],
                  ['DEADLINE', 'Prazo de tarefa'],
                  ['TIME_BLOCK', 'Bloco de foco'],
                  ['EVENT', 'Evento'],
                ].map(([kind, label]) => (
                  <p key={kind} className="flex items-center gap-2 text-xs text-ink-muted">
                    <span className="size-2.5 rounded-sm" style={{ backgroundColor: KIND_COLORS[kind!] }} aria-hidden />
                    {label}
                  </p>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function MonthGrid({
  days,
  itemsByDay,
  anchor,
  today,
}: {
  days: Date[];
  itemsByDay: Map<string, AgendaItemDto[]>;
  anchor: Date;
  today: Date;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-2 text-center text-[11px] font-semibold text-ink-faint">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayItems = itemsByDay.get(day.toDateString()) ?? [];
          const isCurrentMonth = day.getMonth() === anchor.getMonth();
          const isToday = sameDay(day, today);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-24 border-r border-b border-line p-1.5 last:border-r-0',
                isCurrentMonth ? '' : 'bg-base/40',
              )}
            >
              <span
                className={cn(
                  'inline-flex size-6 items-center justify-center rounded-full text-xs',
                  isToday ? 'bg-brand font-semibold text-white' : isCurrentMonth ? 'text-ink-muted' : 'text-ink-faint',
                )}
              >
                {day.getDate()}
              </span>

              <div className="mt-1 space-y-0.5">
                {dayItems.slice(0, 3).map((item) => (
                  <EventChip key={item.id} item={item} compact />
                ))}
                {dayItems.length > 3 ? (
                  <p className="px-1 text-[10px] text-ink-faint">+{dayItems.length - 3} mais</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TimeGrid({
  days,
  itemsByDay,
  today,
  onDropTask,
  dropEnabled,
}: {
  days: Date[];
  itemsByDay: Map<string, AgendaItemDto[]>;
  today: Date;
  onDropTask: (day: Date, hour: number) => void;
  dropEnabled: boolean;
}) {
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, index) => DAY_START_HOUR + index);
  const hasAny = days.some((day) => (itemsByDay.get(day.toDateString()) ?? []).length > 0);

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div aria-hidden />
        {days.map((day) => {
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()} className="border-l border-line py-2 text-center">
              <p className="text-[11px] text-ink-faint">{WEEKDAYS[day.getDay()]}</p>
              <p
                className={cn(
                  'mx-auto mt-0.5 inline-flex size-6 items-center justify-center rounded-full text-xs',
                  isToday ? 'bg-brand font-semibold text-white' : 'text-ink-muted',
                )}
              >
                {day.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
        {hours.map((hour) => (
          <div
            key={hour}
            className="grid border-b border-line/60"
            style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
          >
            <div className="py-1.5 pr-2 text-right text-[10px] text-ink-faint">
              {String(hour).padStart(2, '0')}:00
            </div>

            {days.map((day) => {
              const slotItems = (itemsByDay.get(day.toDateString()) ?? []).filter(
                (item) => new Date(item.startsAt).getHours() === hour,
              );

              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  onDragOver={(event) => {
                    if (dropEnabled) event.preventDefault();
                  }}
                  onDrop={() => onDropTask(day, hour)}
                  className={cn(
                    'min-h-12 space-y-0.5 border-l border-line p-1',
                    dropEnabled ? 'hover:bg-brand/[0.06]' : '',
                  )}
                >
                  {slotItems.map((item) => (
                    <EventChip key={item.id} item={item} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {!hasAny ? (
        <EmptyState
          icon={<CalendarDays className="size-5" />}
          title="Nada agendado neste período"
          description="Reuniões e prazos de tarefas aparecem aqui automaticamente."
        />
      ) : null}
    </Card>
  );
}

function EventChip({ item, compact }: { item: AgendaItemDto; compact?: boolean }) {
  const color = item.color ?? KIND_COLORS[item.kind] ?? '#2E7DFF';

  const content = (
    <span
      className={cn(
        'flex min-h-6 items-center truncate rounded px-1.5 py-1 text-[10px] leading-tight',
        item.isDone ? 'line-through opacity-60' : '',
      )}
      style={{ backgroundColor: `${color}22`, color, borderLeft: `2px solid ${color}` }}
      title={`${item.title} · ${formatTime(item.startsAt)}`}
    >
      {!compact ? <span className="font-medium">{formatTime(item.startsAt)} </span> : null}
      {item.title}
    </span>
  );

  return item.href ? <Link href={item.href}>{content}</Link> : content;
}
