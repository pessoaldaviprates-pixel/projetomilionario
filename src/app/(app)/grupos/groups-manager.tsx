'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Plus, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AvatarStack } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/misc';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { pluralize } from '@/lib/utils/format';

interface GroupDto {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isPrivate: boolean;
  departmentName: string | null;
  memberCount: number;
  members: { id: string; name: string; avatarUrl: string | null }[];
}

export function GroupsManager({
  initialGroups,
  departments,
  members,
  canManage,
}: {
  initialGroups: GroupDto[];
  departments: { id: string; name: string }[];
  members: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [groups] = useState(initialGroups);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function create(formData: FormData) {
    setPending(true);
    try {
      const response = await fetch('/api/grupos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(formData.get('name') ?? ''),
          description: String(formData.get('description') ?? '') || undefined,
          departmentId: String(formData.get('departmentId') ?? '') || null,
          isPrivate: formData.get('isPrivate') === 'on',
          memberIds: formData.getAll('memberIds').map(String),
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível criar o grupo.');

      toast.success('Grupo criado.');
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Grupos e equipes"
        description="Times que cruzam departamentos, com membros e cor próprios."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-4" aria-hidden /> Novo grupo
            </Button>
          ) : null
        }
      />

      <PageBody>
        {groups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<UsersRound className="size-5" />}
              title="Nenhum grupo criado"
              description="Grupos reúnem pessoas de áreas diferentes em torno de um objetivo comum."
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <Card key={group.id} className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} aria-hidden />
                    <p className="truncate text-sm font-medium text-ink">{group.name}</p>
                  </div>
                  {group.isPrivate ? (
                    <Badge>
                      <Lock className="size-2.5" aria-hidden /> Privado
                    </Badge>
                  ) : null}
                </div>

                {group.description ? (
                  <p className="mb-3 line-clamp-2 text-xs text-ink-subtle">{group.description}</p>
                ) : null}

                {group.departmentName ? (
                  <p className="mb-3 text-xs text-ink-faint">{group.departmentName}</p>
                ) : null}

                <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                  <AvatarStack people={group.members} max={4} size="xs" />
                  <span className="text-xs text-ink-faint">
                    {pluralize(group.memberCount, 'membro', 'membros')}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageBody>

      {canManage ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent title="Novo grupo" size="sm">
            <form action={create} className="space-y-4">
              <Input name="name" label="Nome do grupo" placeholder="ex.: Comitê de produto" required autoFocus />
              <Textarea name="description" label="Descrição (opcional)" className="min-h-16" />

              {departments.length > 0 ? (
                <Select name="departmentId" label="Departamento (opcional)" defaultValue="">
                  <option value="">Nenhum</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </Select>
              ) : null}

              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-muted">
                <input type="checkbox" name="isPrivate" className="size-4 rounded border-line-strong bg-surface accent-brand" />
                Grupo privado (visível apenas para membros)
              </label>

              <fieldset>
                <legend className="mb-2 text-xs font-medium text-ink-muted">Membros</legend>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-2 scrollbar-thin">
                  {members.map((member) => (
                    <label key={member.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-overlay">
                      <input type="checkbox" name="memberIds" value={member.id} className="size-4 rounded border-line-strong bg-surface accent-brand" />
                      {member.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" loading={pending}>Criar grupo</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
