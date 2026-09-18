'use client';

import { useRef, useState } from 'react';
import { AtSign, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { ChatMessage } from './message-list';

export interface MentionOption {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export function MessageComposer({
  channelId,
  mentionOptions,
  onSent,
}: {
  channelId: string;
  mentionOptions: MentionOption[];
  onSent: (message: ChatMessage) => void;
}) {
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentioned, setMentioned] = useState<MentionOption[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const suggestions =
    mentionQuery === null
      ? []
      : mentionOptions
          .filter((option) =>
            option.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
              .includes(
                mentionQuery
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[̀-ͯ]/g, ''),
              ),
          )
          .slice(0, 6);

  function onInput(value: string) {
    setBody(value);

    // Detecta "@" em digitação para abrir o seletor de menção.
    const match = value.slice(0, textareaRef.current?.selectionStart ?? value.length).match(/@([\p{L}\s]{0,20})$/u);
    setMentionQuery(match ? match[1]! : null);
    setHighlighted(0);
  }

  function applyMention(option: MentionOption) {
    const cursor = textareaRef.current?.selectionStart ?? body.length;
    const before = body.slice(0, cursor).replace(/@([\p{L}\s]{0,20})$/u, `@${option.name} `);
    const next = before + body.slice(cursor);

    setBody(next);
    setMentionQuery(null);
    setMentioned((current) =>
      current.some((item) => item.id === option.id) ? current : [...current, option],
    );
    textareaRef.current?.focus();
  }

  async function send() {
    const text = body.trim();
    if (!text || pending) return;

    setPending(true);
    try {
      // Só enviamos como menção quem realmente continua citado no texto final.
      const mentions = mentioned.filter((option) => text.includes(`@${option.name}`)).map((option) => option.id);

      const response = await fetch('/api/mensagens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          channelId,
          body: text,
          mentions,
          mentionsEveryone: /@(everyone|todos|canal)\b/i.test(text),
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível enviar.');

      onSent({
        id: json.data.id,
        body: json.data.body,
        kind: 'TEXT',
        createdAt: json.data.createdAt,
        isEdited: false,
        isPinned: false,
        parentId: null,
        replyCount: 0,
        mentions,
        mentionsEveryone: false,
        linkedTaskId: null,
        linkedTask: null,
        author: {
          id: json.data.author.id,
          user: { name: json.data.author.user.name, avatarUrl: json.data.author.user.avatarUrl },
          role: null,
        },
        reactions: [],
        attachments: [],
      });

      setBody('');
      setMentioned([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlighted((current) => (current + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlighted((current) => (current - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const option = suggestions[highlighted];
        if (option) applyMention(option);
        return;
      }
      if (event.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    // Enter envia, Shift+Enter quebra linha.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="relative shrink-0 border-t border-line p-3">
      {suggestions.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Sugestões de menção"
          className="absolute bottom-full left-3 mb-2 w-64 overflow-hidden rounded-xl border border-line bg-surface-overlay shadow-2xl"
        >
          {suggestions.map((option, index) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={highlighted === index}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => applyMention(option)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                  highlighted === index ? 'bg-surface-hover text-ink' : 'text-ink-muted',
                )}
              >
                <Avatar name={option.name} src={option.avatarUrl} id={option.id} size="xs" />
                {option.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-end gap-2 rounded-xl border border-line bg-surface p-2 focus-within:border-brand/50">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={8000}
          placeholder="Escreva uma mensagem…  (@ para mencionar)"
          aria-label="Escreva uma mensagem"
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          style={{ height: 'auto' }}
          onInput={(event) => {
            // Cresce com o conteúdo, até o limite de altura.
            const element = event.currentTarget;
            element.style.height = 'auto';
            element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
          }}
        />

        <button
          type="button"
          onClick={() => {
            setBody((current) => `${current}@`);
            textareaRef.current?.focus();
            setMentionQuery('');
          }}
          aria-label="Mencionar alguém"
          className="rounded-lg p-2 text-ink-subtle transition-colors hover:bg-surface-overlay hover:text-ink"
        >
          <AtSign className="size-4" aria-hidden />
        </button>

        <Button
          size="icon"
          onClick={send}
          loading={pending}
          disabled={!body.trim()}
          aria-label="Enviar mensagem"
        >
          <Send className="size-4" aria-hidden />
        </Button>
      </div>

      <p className="mt-1.5 px-1 text-[11px] text-ink-faint">
        Enter envia · Shift + Enter quebra linha
      </p>
    </div>
  );
}
