'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Hash, Lock, MessageSquarePlus, Plus, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

export interface ChannelListItem {
  id: string;
  name: string;
  displayName: string;
  kind: 'PUBLIC' | 'PRIVATE' | 'DIRECT' | 'GROUP_DM';
  topic: string | null;
  unread: number;
  peers: { id: string; name: string; avatarUrl: string | null; presence: string }[];
}

export function ChannelSidebar({
  channels,
  members,
  canCreate,
}: {
  channels: ChannelListItem[];
  members: { id: string; name: string; avatarUrl: string | null }[];
  canCreate: boolean;
}) {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [directOpen, setDirectOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const { groups, directs } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = channels.filter((channel) =>
      term ? channel.displayName.toLowerCase().includes(term) : true,
    );

    return {
      groups: matches.filter((channel) => channel.kind === 'PUBLIC' || channel.kind === 'PRIVATE'),
      directs: matches.filter((channel) => channel.kind === 'DIRECT' || channel.kind === 'GROUP_DM'),
    };
  }, [channels, search]);

  async function createChannel(formData: FormData) {
    setPending(true);
    try {
      const response = await fetch('/api/canais', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(formData.get('name') ?? ''),
          topic: String(formData.get('topic') ?? '') || undefined,
          kind: String(formData.get('kind') ?? 'PUBLIC'),
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível criar o canal.');

      setCreateOpen(false);
      router.push(`/mensagens/${json.data.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  async function openDirect(membershipId: string) {
    setPending(true);
    try {
      const response = await fetch('/api/canais', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo: 'direta', membershipIds: [membershipId] }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível abrir a conversa.');

      setDirectOpen(false);
      router.push(`/mensagens/${json.data.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <aside
        className={cn(
          'flex w-full shrink-0 flex-col border-r border-line bg-surface md:w-72',
          // No mobile, a lista some quando uma conversa está aberta.
          params.id ? 'hidden md:flex' : 'flex',
        )}
        aria-label="Conversas"
      >
        <div className="space-y-3 border-b border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Mensagens</h2>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDirectOpen(true)}
                aria-label="Nova conversa direta"
                title="Nova conversa direta"
              >
                <MessageSquarePlus className="size-4" aria-hidden />
              </Button>
              {canCreate ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setCreateOpen(true)}
                  aria-label="Criar canal"
                  title="Criar canal"
                >
                  <Plus className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar conversa…"
              aria-label="Buscar conversa"
              className="h-8 w-full rounded-lg border border-line bg-base pr-3 pl-8 text-xs text-ink placeholder:text-ink-faint focus:border-brand/60 focus:outline-none"
            />
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-2 scrollbar-thin">
          <Group title="Canais" items={groups} activeId={params.id} />
          <Group title="Conversas diretas" items={directs} activeId={params.id} />

          {groups.length === 0 && directs.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-ink-faint">Nenhuma conversa encontrada.</p>
          ) : null}
        </nav>
      </aside>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent title="Criar canal" description="Canais organizam conversas por assunto, time ou projeto." size="sm">
          <form action={createChannel} className="space-y-4">
            <Input name="name" label="Nome do canal" placeholder="ex.: comercial" required autoFocus maxLength={60} />
            <Input name="topic" label="Assunto (opcional)" placeholder="Sobre o que é este canal" maxLength={160} />
            <Select name="kind" label="Visibilidade" defaultValue="PUBLIC">
              <option value="PUBLIC">Público — toda a empresa participa</option>
              <option value="PRIVATE">Privado — apenas convidados</option>
            </Select>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={pending}>Criar canal</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={directOpen} onOpenChange={setDirectOpen}>
        <DialogContent title="Nova conversa" description="Escolha com quem você quer falar." size="sm">
          <ul className="max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
            {members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openDirect(member.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-overlay disabled:opacity-50"
                >
                  <Avatar name={member.name} src={member.avatarUrl} id={member.id} size="sm" />
                  <span className="text-sm text-ink">{member.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Group({
  title,
  items,
  activeId,
}: {
  title: string;
  items: ChannelListItem[];
  activeId?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-1 px-3 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">{title}</p>
      <ul className="space-y-0.5">
        {items.map((channel) => {
          const isActive = channel.id === activeId;
          const isDirect = channel.kind === 'DIRECT' || channel.kind === 'GROUP_DM';
          const peer = channel.peers[0];

          return (
            <li key={channel.id}>
              <Link
                href={`/mensagens/${channel.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-brand/12 font-medium text-brand-glow'
                    : 'text-ink-muted hover:bg-surface-overlay hover:text-ink',
                )}
              >
                {isDirect && peer ? (
                  <Avatar
                    name={peer.name}
                    src={peer.avatarUrl}
                    id={peer.id}
                    size="xs"
                    presence={peer.presence as 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE'}
                  />
                ) : channel.kind === 'PRIVATE' ? (
                  <Lock className="size-4 shrink-0 text-ink-faint" aria-hidden />
                ) : channel.kind === 'GROUP_DM' ? (
                  <Users className="size-4 shrink-0 text-ink-faint" aria-hidden />
                ) : (
                  <Hash className="size-4 shrink-0 text-ink-faint" aria-hidden />
                )}

                <span className="min-w-0 flex-1 truncate">{channel.displayName}</span>

                {channel.unread > 0 ? (
                  <span className="min-w-4 rounded-full bg-danger px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                    {channel.unread > 99 ? '99+' : channel.unread}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
