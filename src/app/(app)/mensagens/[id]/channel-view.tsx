'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Hash, Lock, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AvatarStack } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { MessageList, type ChatMessage } from './message-list';
import { MessageComposer } from './message-composer';

export interface ChannelViewProps {
  channelId: string;
  title: string;
  topic: string | null;
  kind: 'PUBLIC' | 'PRIVATE' | 'DIRECT' | 'GROUP_DM';
  memberCount: number;
  peers: { id: string; name: string; avatarUrl: string | null; presence: string; roleName: string }[];
  initialMessages: ChatMessage[];
  nextCursor: string | null;
  currentMembershipId: string;
  mentionOptions: { id: string; name: string; avatarUrl: string | null }[];
  canModerate: boolean;
  canUseAi: boolean;
}

export function ChannelView({
  channelId,
  title,
  topic,
  kind,
  memberCount,
  peers,
  initialMessages,
  nextCursor,
  currentMembershipId,
  mentionOptions,
  canModerate,
  canUseAi,
}: ChannelViewProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [cursor, setCursor] = useState(nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Troca de canal: o estado do canal anterior não pode vazar para o novo.
  useEffect(() => {
    setMessages(initialMessages);
    setCursor(nextCursor);
  }, [channelId, initialMessages, nextCursor]);

  // Marca como lido ao abrir, para o badge não ficar preso.
  useEffect(() => {
    fetch(`/api/canais/${channelId}/ler`, { method: 'POST' })
      .then(() => router.refresh())
      .catch(() => undefined);
  }, [channelId, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [channelId]);

  const handleRealtime = useCallback(
    (event: { type: string; topic?: string; payload: unknown }) => {
      if (event.topic !== channelId) return;

      if (event.type === 'message.created') {
        const payload = event.payload as {
          id: string;
          parentId: string | null;
          body: string;
          author: { id: string; name: string; avatarUrl: string | null };
          createdAt: string;
        };

        // Threads têm painel próprio; aqui só entra mensagem de nível raiz.
        if (payload.parentId) return;

        setMessages((current) => {
          if (current.some((message) => message.id === payload.id)) return current;
          return [
            ...current,
            {
              id: payload.id,
              body: payload.body,
              kind: 'TEXT',
              createdAt: payload.createdAt,
              isEdited: false,
              isPinned: false,
              parentId: null,
              replyCount: 0,
              mentions: [],
              mentionsEveryone: false,
              linkedTaskId: null,
              linkedTask: null,
              author: {
                id: payload.author.id,
                user: { name: payload.author.name, avatarUrl: payload.author.avatarUrl },
                role: null,
              },
              reactions: [],
              attachments: [],
            },
          ];
        });

        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
      }

      if (event.type === 'message.deleted') {
        const payload = event.payload as { id: string };
        setMessages((current) => current.filter((message) => message.id !== payload.id));
      }

      if (event.type === 'message.updated') {
        const payload = event.payload as { id: string; body?: string; isPinned?: boolean };
        setMessages((current) =>
          current.map((message) =>
            message.id === payload.id
              ? {
                  ...message,
                  body: payload.body ?? message.body,
                  isPinned: payload.isPinned ?? message.isPinned,
                  isEdited: payload.body ? true : message.isEdited,
                }
              : message,
          ),
        );
      }
    },
    [channelId],
  );

  useRealtime(['message.created', 'message.updated', 'message.deleted', 'message.reaction'], handleRealtime);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);

    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;

    try {
      const response = await fetch(`/api/canais/${channelId}/mensagens?cursor=${cursor}&limit=40`);
      if (!response.ok) throw new Error('falha');

      const json = (await response.json()) as { data: ChatMessage[]; meta: { nextCursor: string | null } };
      setMessages((current) => [...json.data, ...current]);
      setCursor(json.meta.nextCursor);

      // Mantém a posição de leitura depois de prepender o histórico.
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - previousHeight;
      });
    } catch {
      toast.error('Não foi possível carregar mensagens anteriores.');
    } finally {
      setLoadingMore(false);
    }
  }

  function onSent(message: ChatMessage) {
    setMessages((current) =>
      current.some((item) => item.id === message.id) ? current : [...current, message],
    );
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
    router.refresh();
  }

  const isDirect = kind === 'DIRECT' || kind === 'GROUP_DM';

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <Link
          href="/mensagens"
          className="rounded-lg p-1.5 text-ink-subtle hover:bg-surface-overlay hover:text-ink md:hidden"
          aria-label="Voltar para conversas"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>

        {!isDirect ? (
          kind === 'PRIVATE' ? (
            <Lock className="size-4 shrink-0 text-ink-faint" aria-hidden />
          ) : (
            <Hash className="size-4 shrink-0 text-ink-faint" aria-hidden />
          )
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-ink">{title}</h1>
          {topic ? <p className="truncate text-xs text-ink-faint">{topic}</p> : null}
        </div>

        {!isDirect ? (
          <span className="flex items-center gap-2 text-xs text-ink-faint">
            <Users className="size-3.5" aria-hidden />
            {memberCount}
          </span>
        ) : null}

        {peers.length > 0 ? <AvatarStack people={peers} max={3} size="xs" /> : null}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        {cursor ? (
          <div className="flex justify-center p-3">
            <Button variant="ghost" size="sm" onClick={loadMore} loading={loadingMore}>
              Carregar mensagens anteriores
            </Button>
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium text-ink">{title}</p>
            <p className="mt-1 text-xs text-ink-faint">
              {isDirect
                ? 'Este é o começo da sua conversa.'
                : 'Este é o começo do canal. Tudo o que for combinado aqui pode virar tarefa.'}
            </p>
          </div>
        )}

        <MessageList
          messages={messages}
          currentMembershipId={currentMembershipId}
          canModerate={canModerate}
          canUseAi={canUseAi}
          onChange={setMessages}
        />

        <div ref={bottomRef} />
      </div>

      {canUseAi ? (
        <p className="flex items-center gap-1.5 border-t border-line bg-surface/50 px-4 py-1.5 text-[11px] text-ink-faint">
          <Sparkles className="size-3 text-accent" aria-hidden />
          Passe o mouse sobre uma mensagem para transformá-la em tarefa.
        </p>
      ) : null}

      <MessageComposer channelId={channelId} mentionOptions={mentionOptions} onSent={onSent} />
    </div>
  );
}
