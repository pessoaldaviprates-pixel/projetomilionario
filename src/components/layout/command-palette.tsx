'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar, FileText, FolderKanban, ListTodo, Loader2, Megaphone,
  MessageSquare, Plus, Search, Users, Video,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';

const TYPE_ICONS = {
  people: Users,
  tasks: ListTodo,
  projects: FolderKanban,
  meetings: Video,
  files: FileText,
  messages: MessageSquare,
  announcements: Megaphone,
} as const;

const TYPE_LABELS = {
  people: 'Pessoa',
  tasks: 'Tarefa',
  projects: 'Projeto',
  meetings: 'Reunião',
  files: 'Arquivo',
  messages: 'Mensagem',
  announcements: 'Aviso',
} as const;

interface Hit {
  type: keyof typeof TYPE_ICONS;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  meta?: string;
}

/** Ações rápidas — sempre disponíveis, mesmo sem digitar nada. */
const QUICK_ACTIONS = [
  { label: 'Nova tarefa', href: '/tarefas?nova=1', icon: ListTodo },
  { label: 'Nova reunião', href: '/reunioes?nova=1', icon: Video },
  { label: 'Novo projeto', href: '/projetos?novo=1', icon: FolderKanban },
  { label: 'Abrir agenda', href: '/agenda', icon: Calendar },
  { label: 'Nova mensagem', href: '/mensagens', icon: MessageSquare },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  // ⌘K / Ctrl+K abre de qualquer lugar do app.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Busca com debounce; requisição anterior é cancelada para evitar corrida.
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`/api/busca?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('falha na busca');
        const payload = (await response.json()) as { data: Hit[] };
        setHits(payload.data);
        setHighlighted(0);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  const actions = query.trim().length < 2 ? QUICK_ACTIONS : [];
  const total = hits.length + actions.length;

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery('');
      router.push(href);
    },
    [router],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((current) => (current + 1) % Math.max(total, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((current) => (current - 1 + Math.max(total, 1)) % Math.max(total, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = actions.length > 0 ? actions[highlighted] : hits[highlighted];
      if (target) go(target.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-sm text-ink-faint transition-colors hover:border-line-strong hover:text-ink-subtle"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Buscar pessoas, tarefas, projetos…</span>
        <kbd className="hidden rounded border border-line bg-surface-overlay px-1.5 py-0.5 font-sans text-[10px] text-ink-faint sm:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Busca global" description="Encontre qualquer coisa ou execute uma ação." size="lg">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Digite para buscar…"
                aria-label="Termo de busca"
                className="h-11 w-full rounded-xl border border-line bg-surface pr-10 pl-10 text-sm text-ink placeholder:text-ink-faint focus:border-brand/60 focus:ring-2 focus:ring-brand/20 focus:outline-none"
              />
              {loading ? (
                <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-ink-faint" aria-hidden />
              ) : null}
            </div>

            <div className="max-h-96 overflow-y-auto scrollbar-thin" role="listbox" aria-label="Resultados">
              {actions.length > 0 ? (
                <>
                  <p className="px-1 py-2 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
                    Ações rápidas
                  </p>
                  {actions.map((action, index) => (
                    <button
                      key={action.href}
                      type="button"
                      role="option"
                      aria-selected={highlighted === index}
                      onClick={() => go(action.href)}
                      onMouseEnter={() => setHighlighted(index)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                        highlighted === index ? 'bg-surface-hover text-ink' : 'text-ink-muted',
                      )}
                    >
                      <action.icon className="size-4 text-ink-faint" aria-hidden />
                      <span className="flex-1">{action.label}</span>
                      <Plus className="size-3.5 text-ink-faint" aria-hidden />
                    </button>
                  ))}
                </>
              ) : null}

              {hits.map((hit, index) => {
                const Icon = TYPE_ICONS[hit.type];
                return (
                  <button
                    key={`${hit.type}-${hit.id}`}
                    type="button"
                    role="option"
                    aria-selected={highlighted === index}
                    onClick={() => go(hit.href)}
                    onMouseEnter={() => setHighlighted(index)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      highlighted === index ? 'bg-surface-hover' : '',
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-ink-faint" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{hit.title}</span>
                      {hit.subtitle ? (
                        <span className="block truncate text-xs text-ink-faint">{hit.subtitle}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-ink-faint">
                      {TYPE_LABELS[hit.type]}
                    </span>
                  </button>
                );
              })}

              {!loading && query.trim().length >= 2 && hits.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-ink-subtle">
                  Nada encontrado para “{query}”.
                </p>
              ) : null}
            </div>

            <p className="border-t border-line pt-3 text-[11px] text-ink-faint">
              Navegue com ↑ ↓ · Abra com Enter · Feche com Esc
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
