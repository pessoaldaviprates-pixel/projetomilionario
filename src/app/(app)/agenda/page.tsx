import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/context';
import { getAgenda } from '@/server/services/calendar.service';
import { listTasks } from '@/server/services/tasks.service';
import { hasEntitlement } from '@/lib/billing/subscription';
import { CalendarWorkspace } from './calendar-workspace';

export const metadata: Metadata = { title: 'Agenda' };

export default async function CalendarPage() {
  const ctx = await requireAuth();

  // Carregamos o mês corrente com folga nas bordas para cobrir a grade completa.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1 - 7);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 7);

  const [items, tasks, timeBlockingEnabled] = await Promise.all([
    getAgenda(ctx, { from, to }),
    listTasks(ctx, { onlyMine: true }),
    hasEntitlement(ctx.companyId, 'calendar.timeblocking'),
  ]);

  return (
    <CalendarWorkspace
      initialItems={items.map((item) => ({
        ...item,
        startsAt: item.startsAt.toISOString(),
        endsAt: item.endsAt.toISOString(),
      }))}
      unscheduledTasks={tasks
        .filter((task) => task.status !== 'DONE')
        .slice(0, 20)
        .map((task) => ({
          id: task.id,
          title: task.title,
          priority: task.priority,
          dueAt: task.dueAt ? task.dueAt.toISOString() : null,
          estimateMinutes: task.estimateMinutes,
        }))}
      timeBlockingEnabled={timeBlockingEnabled}
      canManage={ctx.can('calendar.manage')}
    />
  );
}
