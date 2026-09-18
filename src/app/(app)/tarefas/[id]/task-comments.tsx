'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatRelative } from '@/lib/utils/format';

interface Comment {
  id: string;
  body: string;
  createdAt: Date | string;
  author: { id: string; user: { name: string; avatarUrl: string | null } };
}

export function TaskComments({ taskId, comments }: { taskId: string; comments: Comment[] }) {
  const [list, setList] = useState(comments);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;

    setPending(true);
    try {
      const response = await fetch(`/api/tarefas/${taskId}/comentarios`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });

      if (!response.ok) throw new Error('falha');

      const json = await response.json();
      setList((current) => [...current, json.data]);
      setBody('');
      router.refresh();
    } catch {
      toast.error('Não foi possível enviar o comentário.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-4" aria-hidden /> Comentários ({list.length})
        </CardTitle>
      </CardHeader>

      <div className="space-y-4 px-5 pb-5">
        {list.length === 0 ? (
          <p className="text-sm text-ink-faint">
            Nenhum comentário ainda. Use este espaço para alinhar detalhes da tarefa.
          </p>
        ) : (
          <ul className="space-y-4">
            {list.map((comment) => (
              <li key={comment.id} className="flex gap-3">
                <Avatar
                  name={comment.author.user.name}
                  src={comment.author.user.avatarUrl}
                  id={comment.author.id}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-ink">{comment.author.user.name}</span>
                    <span className="text-xs text-ink-faint">{formatRelative(comment.createdAt)}</span>
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-ink-muted">{comment.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="flex gap-2 border-t border-line pt-4">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              // Enter envia; Shift+Enter quebra linha — convenção esperada em chat.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit(event);
              }
            }}
            placeholder="Escreva um comentário…"
            aria-label="Novo comentário"
            maxLength={4000}
            rows={2}
            className="min-h-10 flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand/60 focus:ring-2 focus:ring-brand/20 focus:outline-none"
          />
          <Button type="submit" size="icon" loading={pending} disabled={!body.trim()} aria-label="Enviar comentário">
            <Send className="size-4" aria-hidden />
          </Button>
        </form>
      </div>
    </Card>
  );
}
