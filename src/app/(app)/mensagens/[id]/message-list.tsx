'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ListTodo, MoreHorizontal, Pencil, Pin, Smile, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger,
} from '@/components/ui/dropdown';
import { formatRelative, formatTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export interface ChatMessage {
  id: string;
  body: string;
  kind: string;
  createdAt: string | Date;
  isEdited: boolean;
  isPinned: boolean;
  parentId: string | null;
  replyCount: number;
  mentions: string[];
  mentionsEveryone: boolean;
  linkedTaskId: string | null;
  linkedTask: { id: string; title: string; status: string } | null;
  author: {
    id: string;
    user: { name: string; avatarUrl: string | null };
    role: { name: string; color: string } | null;
  };
  reactions: { emoji: string; count: number; reacted: boolean }[];
  attachments: { id: string; name: string; mimeType: string; sizeBytes: number; category: string }[];
}

const QUICK_EMOJIS = ['👍', '🎉', '❤️', '🔥', '👀', '✅'];

/** Agrupa mensagens consecutivas do mesmo autor dentro de 5 minutos. */
function shouldGroup(current: ChatMessage, previous: ChatMessage | undefined): boolean {
  if (!previous) return false;
  if (previous.author.id !== current.author.id) return false;
  const gap = new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime();
  return gap < 5 * 60_000;
}

function dayKey(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function MessageList({
  messages,
  currentMembershipId,
  canModerate,
  canUseAi,
  onChange,
}: {
  messages: ChatMessage[];
  currentMembershipId: string;
  canModerate: boolean;
  canUseAi: boolean;
  onChange: (updater: (current: ChatMessage[]) => ChatMessage[]) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  async function react(messageId: string, emoji: string) {
    onChange((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;
        const existing = message.reactions.find((reaction) => reaction.emoji === emoji);

        if (!existing) {
          return { ...message, reactions: [...message.reactions, { emoji, count: 1, reacted: true }] };
        }

        const count = existing.reacted ? existing.count - 1 : existing.count + 1;
        const reactions =
          count === 0
            ? message.reactions.filter((reaction) => reaction.emoji !== emoji)
            : message.reactions.map((reaction) =>
                reaction.emoji === emoji ? { ...reaction, count, reacted: !reaction.reacted } : reaction,
              );
        return { ...message, reactions };
      }),
    );

    await fetch(`/api/mensagens/${messageId}/reacao`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ emoji }),
    }).catch(() => toast.error('Não foi possível registrar a reação.'));
  }

  async function saveEdit(messageId: string) {
    const body = editValue.trim();
    if (!body) return;

    setBusy(messageId);
    try {
      const response = await fetch(`/api/mensagens/${messageId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) throw new Error('falha');

      onChange((current) =>
        current.map((message) => (message.id === messageId ? { ...message, body, isEdited: true } : message)),
      );
      setEditing(null);
    } catch {
      toast.error('Não foi possível editar a mensagem.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(messageId: string) {
    setBusy(messageId);
    try {
      const response = await fetch(`/api/mensagens/${messageId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('falha');
      onChange((current) => current.filter((message) => message.id !== messageId));
    } catch {
      toast.error('Não foi possível excluir a mensagem.');
    } finally {
      setBusy(null);
    }
  }

  /** O elo chat → tarefa: envia o texto para a IA extrair a ação sugerida. */
  async function turnIntoTask(message: ChatMessage) {
    setBusy(message.id);
    try {
      const response = await fetch('/api/ia/sugerir', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: message.body, sourceType: 'message', sourceId: message.id }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível analisar a mensagem.');

      if (json.data.length === 0) {
        toast.info('Não identificamos uma tarefa clara nesta mensagem.');
        return;
      }

      toast.success(
        `${json.data.length} sugestão(ões) criada(s). Confirme no início ou no assistente.`,
        { action: { label: 'Ver', onClick: () => router.push('/dashboard') } },
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setBusy(null);
    }
  }

  let lastDay = '';

  return (
    <ol className="pb-2">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const grouped = shouldGroup(message, previous);
        const isMine = message.author.id === currentMembershipId;
        const currentDay = dayKey(message.createdAt);
        const showDivider = currentDay !== lastDay;
        lastDay = currentDay;

        return (
          <li key={message.id}>
            {showDivider ? (
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="h-px flex-1 bg-line" aria-hidden />
                <span className="text-[11px] font-medium text-ink-faint">
                  {new Date(message.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <span className="h-px flex-1 bg-line" aria-hidden />
              </div>
            ) : null}

            <article
              className={cn(
                'group relative flex gap-3 px-4 transition-colors hover:bg-surface/50',
                grouped && !showDivider ? 'py-0.5' : 'pt-3 pb-0.5',
              )}
            >
              {grouped && !showDivider ? (
                <span className="w-8 shrink-0 text-right text-[10px] text-ink-faint opacity-0 group-hover:opacity-100">
                  {formatTime(message.createdAt)}
                </span>
              ) : (
                <Avatar
                  name={message.author.user.name}
                  src={message.author.user.avatarUrl}
                  id={message.author.id}
                  size="sm"
                  className="mt-0.5"
                />
              )}

              <div className="min-w-0 flex-1">
                {!grouped || showDivider ? (
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-ink">{message.author.user.name}</span>
                    {message.author.role ? (
                      <span className="text-[11px]" style={{ color: message.author.role.color }}>
                        {message.author.role.name}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-ink-faint">{formatRelative(message.createdAt)}</span>
                    {message.isPinned ? (
                      <Badge tone="warning">
                        <Pin className="size-2.5" aria-hidden /> Fixada
                      </Badge>
                    ) : null}
                  </p>
                ) : null}

                {editing === message.id ? (
                  <div className="mt-1 flex gap-2">
                    <input
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveEdit(message.id);
                        if (event.key === 'Escape') setEditing(null);
                      }}
                      autoFocus
                      aria-label="Editar mensagem"
                      className="h-9 flex-1 rounded-lg border border-brand/50 bg-surface px-3 text-sm text-ink focus:outline-none"
                    />
                    <Button size="sm" onClick={() => saveEdit(message.id)} loading={busy === message.id}>
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">
                    {message.body}
                    {message.isEdited ? <span className="ml-1.5 text-[11px] text-ink-faint">(editada)</span> : null}
                  </p>
                )}

                {message.linkedTask ? (
                  <Link
                    href={`/tarefas/${message.linkedTask.id}`}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg border border-brand/25 bg-brand/[0.06] px-2.5 py-1.5 text-xs text-brand-glow transition-colors hover:bg-brand/12"
                  >
                    <CheckCircle2 className="size-3.5" aria-hidden />
                    Tarefa: {message.linkedTask.title}
                  </Link>
                ) : null}

                {message.attachments.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {message.attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <a
                          href={`/api/arquivos/${attachment.id}`}
                          className="text-xs text-brand hover:underline"
                        >
                          {attachment.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {message.reactions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.reactions.map((reaction) => (
                      <button
                        key={reaction.emoji}
                        type="button"
                        onClick={() => react(message.id, reaction.emoji)}
                        aria-pressed={reaction.reacted}
                        className={cn(
                          'flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                          reaction.reacted
                            ? 'border-brand/40 bg-brand/12 text-brand-glow'
                            : 'border-line bg-surface-overlay text-ink-muted hover:border-line-strong',
                        )}
                      >
                        <span aria-hidden>{reaction.emoji}</span>
                        <span className="tabular-nums">{reaction.count}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Ações da mensagem: aparecem no hover e no foco por teclado. */}
              <div className="absolute top-1 right-4 flex items-center gap-0.5 rounded-lg border border-line bg-surface-overlay p-0.5 opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <Dropdown>
                  <DropdownTrigger asChild>
                    <button
                      type="button"
                      aria-label="Reagir"
                      className="rounded p-1.5 text-ink-subtle hover:bg-surface-hover hover:text-ink"
                    >
                      <Smile className="size-3.5" aria-hidden />
                    </button>
                  </DropdownTrigger>
                  <DropdownContent className="flex min-w-0 gap-0.5 p-1">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => react(message.id, emoji)}
                        aria-label={`Reagir com ${emoji}`}
                        className="rounded p-1.5 text-base hover:bg-surface-hover"
                      >
                        {emoji}
                      </button>
                    ))}
                  </DropdownContent>
                </Dropdown>

                {canUseAi && !message.linkedTask ? (
                  <button
                    type="button"
                    onClick={() => turnIntoTask(message)}
                    disabled={busy === message.id}
                    aria-label="Transformar em tarefa"
                    title="Transformar em tarefa"
                    className="rounded p-1.5 text-ink-subtle hover:bg-surface-hover hover:text-accent disabled:opacity-50"
                  >
                    <ListTodo className="size-3.5" aria-hidden />
                  </button>
                ) : null}

                {isMine || canModerate ? (
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <button
                        type="button"
                        aria-label="Mais ações"
                        className="rounded p-1.5 text-ink-subtle hover:bg-surface-hover hover:text-ink"
                      >
                        <MoreHorizontal className="size-3.5" aria-hidden />
                      </button>
                    </DropdownTrigger>
                    <DropdownContent>
                      {isMine ? (
                        <DropdownItem
                          onSelect={() => {
                            setEditing(message.id);
                            setEditValue(message.body);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden /> Editar
                        </DropdownItem>
                      ) : null}
                      <DropdownSeparator />
                      <DropdownItem danger onSelect={() => remove(message.id)}>
                        <Trash2 className="size-4" aria-hidden /> Excluir
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                ) : null}
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
