'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AtSign, Bell, CalendarClock, CheckCheck, FileText, FolderKanban,
  ListTodo, Megaphone, MessageSquare, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { formatRelative } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface NotificationDto {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

const KIND_META: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  MESSAGE: { icon: MessageSquare, tone: 'text-brand bg-brand/12' },
  MENTION: { icon: AtSign, tone: 'text-accent bg-accent/12' },
  TASK_ASSIGNED: { icon: ListTodo, tone: 'text-success bg-success/12' },
  TASK_UPDATED: { icon: ListTodo, tone: 'text-brand bg-brand/12' },
  TASK_DUE: { icon: CalendarClock, tone: 'text-warning bg-warning/12' },
  MEETING_INVITE: { icon: CalendarClock, tone: 'text-accent bg-accent/12' },
  MEETING_REMINDER: { icon: CalendarClock, tone: 'text-warning bg-warning/12' },
  COMMENT: { icon: MessageSquare, tone: 'text-info bg-info/12' },
  FILE_SHARED: { icon: FileText, tone: 'text-info bg-info/12' },
  PROJECT_UPDATED: { icon: FolderKanban, tone: 'text-brand bg-brand/12' },
  ANNOUNCEMENT: { icon: Megaphone, tone: 'text-warning bg-warning/12' },
  BILLING: { icon: Wallet, tone: 'text-success bg-success/12' },
  SYSTEM: { icon: Bell, tone: 'text-ink-subtle bg-surface-overlay' },
};

const FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'nao-lidas', label: 'Não lidas' },
  { key: 'MENTION', label: 'Menções' },
  { key: 'TASK_ASSIGNED', label: 'Tarefas' },
  { key: 'MEETING_INVITE', label: 'Reuniões' },
  { key: 'SYSTEM', label: 'Sistema' },
];

export function NotificationsList({
  initialItems,
  nextCursor,
}: {
  initialItems: NotificationDto[];
  nextCursor: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(nextCursor);
  const [filter, setFilter] = useState('todas');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const filtered = useMemo(() => {
    if (filter === 'todas') return items;
    if (filter === 'nao-lidas') return items.filter((item) => !item.readAt);
    if (filter === 'TASK_ASSIGNED') {
      return items.filter((item) => item.kind.startsWith('TASK'));
    }
    if (filter === 'MEETING_INVITE') {
      return items.filter((item) => item.kind.startsWith('MEETING'));
    }
    return items.filter((item) => item.kind === filter);
  }, [items, filter]);

  const unreadCount = items.filter((item) => !item.readAt).length;

  async function markOne(id: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)),
    );
    await fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
    router.refresh();
  }

  async function markAll() {
    const previous = items;
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));

    try {
      const response = await fetch('/api/notificacoes', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ todas: true }),
      });
      if (!response.ok) throw new Error('falha');
      router.refresh();
    } catch {
      setItems(previous);
      toast.error('Não foi possível marcar todas como lidas.');
    }
  }

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);

    try {
      const response = await fetch(`/api/notificacoes?cursor=${cursor}`);
      if (!response.ok) throw new Error('falha');
      const json = (await response.json()) as { data: NotificationDto[]; meta: { nextCursor: string | null } };
      setItems((current) => [...current, ...json.data]);
      setCursor(json.meta.nextCursor);
    } catch {
      toast.error('Não foi possível carregar mais notificações.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Notificações"
        description={
          unreadCount > 0
            ? `${unreadCount} ${unreadCount === 1 ? 'notificação não lida' : 'notificações não lidas'}`
            : 'Tudo em dia por aqui.'
        }
        actions={
          unreadCount > 0 ? (
            <Button size="sm" variant="secondary" onClick={markAll}>
              <CheckCheck className="size-4" aria-hidden /> Marcar todas como lidas
            </Button>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              aria-pressed={filter === option.key}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                filter === option.key
                  ? 'bg-surface-overlay text-ink'
                  : 'text-ink-subtle hover:bg-surface-overlay hover:text-ink',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <PageBody>
        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Bell className="size-5" />}
              title="Nenhuma notificação"
              description="Você será avisado sobre menções, tarefas atribuídas, reuniões e comunicados."
            />
          </Card>
        ) : (
          <Card className="divide-y divide-line overflow-hidden p-0">
            {filtered.map((item) => {
              const meta = KIND_META[item.kind] ?? KIND_META.SYSTEM!;
              const Icon = meta.icon;
              const isUnread = !item.readAt;

              const content = (
                <>
                  <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl', meta.tone)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', isUnread ? 'font-medium text-ink' : 'text-ink-muted')}>
                      {item.title}
                    </span>
                    {item.body ? (
                      <span className="mt-0.5 block truncate text-xs text-ink-subtle">{item.body}</span>
                    ) : null}
                    <span className="mt-1 block text-xs text-ink-faint">{formatRelative(item.createdAt)}</span>
                  </span>
                  {isUnread ? (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-label="Não lida" />
                  ) : null}
                </>
              );

              const className = cn(
                'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-overlay',
                isUnread ? 'bg-brand/[0.03]' : '',
              );

              return item.href ? (
                <Link key={item.id} href={item.href} onClick={() => isUnread && markOne(item.id)} className={className}>
                  {content}
                </Link>
              ) : (
                <button key={item.id} type="button" onClick={() => isUnread && markOne(item.id)} className={className}>
                  {content}
                </button>
              );
            })}
          </Card>
        )}

        {cursor ? (
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" size="sm" onClick={loadMore} loading={loading}>
              Carregar mais
            </Button>
          </div>
        ) : null}
      </PageBody>
    </>
  );
}
