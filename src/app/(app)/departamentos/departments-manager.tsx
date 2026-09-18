'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Network, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/misc';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { pluralize } from '@/lib/utils/format';

interface DepartmentDto {
  id: string;
  name: string;
  description: string | null;
  color: string;
  parentId: string | null;
  leadName: string | null;
  leadId: string | null;
  leadAvatar: string | null;
  memberCount: number;
  groupCount: number;
}

const COLORS = ['#2E7DFF', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4'];

export function DepartmentsManager({
  initialDepartments,
  members,
  canManage,
}: {
  initialDepartments: DepartmentDto[];
  members: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [color, setColor] = useState(COLORS[0]!);
  const router = useRouter();

  async function create(formData: FormData) {
    setPending(true);
    try {
      const response = await fetch('/api/departamentos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(formData.get('name') ?? ''),
          description: String(formData.get('description') ?? '') || undefined,
          color,
          parentId: String(formData.get('parentId') ?? '') || null,
          leadId: String(formData.get('leadId') ?? '') || null,
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? 'Não foi possível criar.');

      toast.success('Departamento criado.');
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string, name: string) {
    const previous = departments;
    setDepartments((current) => current.filter((department) => department.id !== id));

    try {
      const response = await fetch(`/api/departamentos/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Não foi possível excluir.');
      }
      toast.success(`"${name}" excluído. As pessoas continuam na empresa, sem departamento.`);
      router.refresh();
    } catch (error) {
      setDepartments(previous);
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    }
  }

  return (
    <>
      <PageHeader
        title="Departamentos"
        description="Organize a empresa em áreas e defina quem lidera cada uma."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-4" aria-hidden /> Novo departamento
            </Button>
          ) : null
        }
      />

      <PageBody>
        {departments.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Network className="size-5" />}
              title="Nenhum departamento"
              description="Crie departamentos para organizar as pessoas por área."
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((department) => (
              <Card key={department.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className="mt-1 size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: department.color }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{department.name}</p>
                      {department.description ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-subtle">{department.description}</p>
                      ) : null}
                    </div>
                  </div>

                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => remove(department.id, department.name)}
                      aria-label={`Excluir ${department.name}`}
                      className="rounded p-1 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>

                <p className="mt-3 text-xs text-ink-faint">
                  {pluralize(department.memberCount, 'pessoa', 'pessoas')}
                  {department.groupCount > 0 ? ` · ${pluralize(department.groupCount, 'equipe', 'equipes')}` : ''}
                </p>

                {department.leadName ? (
                  <p className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5 text-xs text-ink-subtle">
                    <Avatar name={department.leadName} src={department.leadAvatar} id={department.leadId ?? undefined} size="xs" />
                    {department.leadName}
                  </p>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </PageBody>

      {canManage ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent title="Novo departamento" size="sm">
            <form action={create} className="space-y-4">
              <Input name="name" label="Nome" placeholder="ex.: Jurídico" required autoFocus />
              <Textarea name="description" label="Descrição (opcional)" className="min-h-16" />

              <Select name="leadId" label="Responsável (opcional)" defaultValue="">
                <option value="">Sem responsável</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </Select>

              <Select name="parentId" label="Subordinado a (opcional)" defaultValue="">
                <option value="">Nenhum</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </Select>

              <fieldset>
                <legend className="mb-2 text-xs font-medium text-ink-muted">Cor</legend>
                <div className="flex gap-2">
                  {COLORS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setColor(option)}
                      aria-label={`Cor ${option}`}
                      aria-pressed={color === option}
                      className={`size-7 rounded-lg transition-transform ${color === option ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface-raised' : ''}`}
                      style={{ backgroundColor: option }}
                    />
                  ))}
                </div>
              </fieldset>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" loading={pending}>Criar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
