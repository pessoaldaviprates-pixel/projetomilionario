'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Info, Megaphone, Pin, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/misc';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { formatRelative } from '@/lib/utils/format';

interface AnnouncementDto {
  id: string;
  title: string;
  body: string;
  severity: string;
  audience: string;
  pinned: boolean;
  isRead: boolean;
  publishedAt: string | null;
  authorName: string;
  authorAvatar: string | null;
  authorRole: string | null;
  targetName: string | null;
}

const SEVERITY_META: Record<string, { label: string; tone: 'brand' | 'success' | 'warning' | 'danger' }> = {
  INFO: { label: 'Informativo', tone: 'brand' },
  SUCCESS: { label: 'Boa notícia', tone: 'success' },
  WARNING: { label: 'Atenção', tone: 'warning' },
  CRITICAL: { label: 'Crítico', tone: 'danger' },
};

const AUDIENCE_LABELS: Record<string, string> = {
  COMPANY: 'Toda a empresa',
  DEPARTMENT: 'Departamento',
  GROUP: 'Grupo',
  ROLE: 'Cargo',
};

export function AnnouncementsBoard({
  initialAnnouncements,
  departments,
  groups,
  roles,
  canPublish,
}: {
  initialAnnouncements: AnnouncementDto[];
  departments: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  canPublish: boolean;
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [audience, setAudience] = useState('COMPANY');
  const router = useRouter();

  async function publish(formData: FormData) {
    setPending(true);
    try {
      const response = await fetch('/api/avisos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: String(formData.get('title') ?? ''),
          body: String(formData.get('body') ?? ''),
          severity: String(formData.get('severity') ?? 'INFO'),
          audience,
          departmentId: audience === 'DEPARTMENT' ? String(formData.get('targetId') ?? '') : null,
          groupId: audience === 'GROUP' ? String(formData.get('targetId') ?? '') : null,
          roleId: audience === 'ROLE' ? String(formData.get('targetId') ?? '') : null,
          pinned: formData.get('pinned') === 'on',
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível publicar.');

      toast.success('Aviso publicado e notificações enviadas.');
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  async function markRead(id: string) {
    setAnnouncements((current) =>
      current.map((announcement) => (announcement.id === id ? { ...announcement, isRead: true } : announcement)),
    );
    await fetch(`/api/avisos/${id}`, { method: 'POST' }).catch(() => undefined);
  }

  async function remove(id: string) {
    const previous = announcements;
    setAnnouncements((current) => current.filter((announcement) => announcement.id !== id));

    try {
      const response = await fetch(`/api/avisos/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('falha');
      toast.success('Aviso removido.');
      router.refresh();
    } catch {
      setAnnouncements(previous);
      toast.error('Não foi possível remover o aviso.');
    }
  }

  const targets = audience === 'DEPARTMENT' ? departments : audience === 'GROUP' ? groups : audience === 'ROLE' ? roles : [];

  return (
    <>
      <PageHeader
        title="Avisos"
        description="Comunicados oficiais da empresa, com público-alvo definido."
        actions={
          canPublish ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-4" aria-hidden /> Publicar aviso
            </Button>
          ) : null
        }
      />

      <PageBody className="space-y-3">
        {announcements.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Megaphone className="size-5" />}
              title="Nenhum aviso publicado"
              description="Comunicados da liderança aparecem aqui e geram notificação para o público escolhido."
            />
          </Card>
        ) : (
          announcements.map((announcement) => {
            const severity = SEVERITY_META[announcement.severity] ?? SEVERITY_META.INFO!;

            return (
              <Card
                key={announcement.id}
                className={`p-5 ${!announcement.isRead ? 'border-brand/30 bg-brand/[0.02]' : ''}`}
                onMouseEnter={() => !announcement.isRead && markRead(announcement.id)}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone={severity.tone}>
                    {announcement.severity === 'CRITICAL' ? (
                      <AlertTriangle className="size-2.5" aria-hidden />
                    ) : (
                      <Info className="size-2.5" aria-hidden />
                    )}
                    {severity.label}
                  </Badge>

                  {announcement.pinned ? (
                    <Badge tone="warning">
                      <Pin className="size-2.5" aria-hidden /> Fixado
                    </Badge>
                  ) : null}

                  <Badge>
                    {AUDIENCE_LABELS[announcement.audience] ?? announcement.audience}
                    {announcement.targetName ? `: ${announcement.targetName}` : ''}
                  </Badge>

                  {!announcement.isRead ? <span className="size-1.5 rounded-full bg-brand" aria-label="Não lido" /> : null}

                  {canPublish ? (
                    <button
                      type="button"
                      onClick={() => remove(announcement.id)}
                      aria-label={`Remover aviso ${announcement.title}`}
                      className="ml-auto rounded p-1 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>

                <h2 className="text-base font-semibold text-ink">{announcement.title}</h2>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-ink-muted">{announcement.body}</p>

                <div className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-xs text-ink-faint">
                  <Avatar name={announcement.authorName} src={announcement.authorAvatar} size="xs" />
                  <span>{announcement.authorName}</span>
                  {announcement.authorRole ? <span>· {announcement.authorRole}</span> : null}
                  {announcement.publishedAt ? <span>· {formatRelative(announcement.publishedAt)}</span> : null}
                </div>
              </Card>
            );
          })
        )}
      </PageBody>

      {canPublish ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent title="Publicar aviso" description="Todos do público escolhido recebem uma notificação.">
            <form action={publish} className="space-y-4">
              <Input name="title" label="Título" placeholder="ex.: Fechamento do trimestre" required autoFocus />

              <Textarea
                name="body"
                label="Conteúdo"
                placeholder="Escreva o comunicado…"
                className="min-h-32"
                required
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Select name="severity" label="Tipo" defaultValue="INFO">
                  <option value="INFO">Informativo</option>
                  <option value="SUCCESS">Boa notícia</option>
                  <option value="WARNING">Atenção</option>
                  <option value="CRITICAL">Crítico</option>
                </Select>

                <Select
                  name="audience"
                  label="Público-alvo"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                >
                  <option value="COMPANY">Toda a empresa</option>
                  {departments.length > 0 ? <option value="DEPARTMENT">Departamento</option> : null}
                  {groups.length > 0 ? <option value="GROUP">Grupo</option> : null}
                  {roles.length > 0 ? <option value="ROLE">Cargo específico</option> : null}
                </Select>
              </div>

              {targets.length > 0 ? (
                <Select name="targetId" label="Selecione o destino" required>
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>{target.name}</option>
                  ))}
                </Select>
              ) : null}

              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-muted">
                <input type="checkbox" name="pinned" className="size-4 rounded border-line-strong bg-surface accent-brand" />
                Fixar no topo dos avisos
              </label>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" loading={pending}>Publicar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
