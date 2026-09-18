'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';

const COLORS = ['#2E7DFF', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316'];

export function ProjectCreateButton({
  members,
  currentMembershipId,
  openInitially,
}: {
  members: { id: string; name: string; avatarUrl: string | null }[];
  currentMembershipId: string;
  openInitially?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(openInitially));
  const [pending, setPending] = useState(false);
  const [color, setColor] = useState(COLORS[0]!);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  async function submit(formData: FormData) {
    setPending(true);
    setErrors({});

    const dueAt = String(formData.get('dueAt') ?? '');
    const memberIds = formData.getAll('memberIds').map(String);

    try {
      const response = await fetch('/api/projetos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(formData.get('name') ?? ''),
          description: String(formData.get('description') ?? '') || undefined,
          color,
          leadId: String(formData.get('leadId') ?? '') || null,
          dueAt: dueAt ? new Date(`${dueAt}T18:00:00`).toISOString() : null,
          memberIds,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        setErrors((json.error?.details as Record<string, string>) ?? {});
        throw new Error(json.error?.message ?? 'Não foi possível criar o projeto.');
      }

      toast.success('Projeto criado. Um canal de conversa foi criado junto.');
      setOpen(false);
      router.push(`/projetos/${json.data.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> Novo projeto
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Novo projeto" description="Um canal de conversa é criado automaticamente para o projeto.">
          <form action={submit} className="space-y-4">
            <Input name="name" label="Nome do projeto" placeholder="ex.: Lançamento do novo site" error={errors.name} autoFocus required />

            <Textarea name="description" label="Descrição (opcional)" placeholder="Objetivo, escopo, contexto…" className="min-h-20" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select name="leadId" label="Responsável" defaultValue={currentMembershipId}>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </Select>
              <Input name="dueAt" type="date" label="Prazo (opcional)" />
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-ink-muted">Cor do projeto</legend>
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

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-ink-muted">Equipe do projeto</legend>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-2 scrollbar-thin">
                {members.map((member) => (
                  <label key={member.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-overlay">
                    <input
                      type="checkbox"
                      name="memberIds"
                      value={member.id}
                      defaultChecked={member.id === currentMembershipId}
                      className="size-4 rounded border-line-strong bg-surface accent-brand"
                    />
                    {member.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={pending}>Criar projeto</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
