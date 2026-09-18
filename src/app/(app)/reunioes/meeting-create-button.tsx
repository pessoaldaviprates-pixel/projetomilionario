'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';

export function MeetingCreateButton({
  members,
  projects,
  openInitially,
}: {
  members: { id: string; name: string; avatarUrl: string | null }[];
  projects: { id: string; name: string }[];
  openInitially?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(openInitially));
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);

  async function submit(formData: FormData) {
    setPending(true);
    setErrors({});

    const date = String(formData.get('date') ?? '');
    const start = String(formData.get('start') ?? '09:00');
    const end = String(formData.get('end') ?? '10:00');

    try {
      const startsAt = new Date(`${date}T${start}:00`);
      const endsAt = new Date(`${date}T${end}:00`);

      if (endsAt <= startsAt) {
        setErrors({ endsAt: 'O término deve ser depois do início.' });
        throw new Error('O horário de término precisa ser depois do início.');
      }

      const response = await fetch('/api/reunioes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: String(formData.get('title') ?? ''),
          description: String(formData.get('description') ?? '') || undefined,
          agenda: String(formData.get('agenda') ?? '') || undefined,
          location: String(formData.get('location') ?? '') || undefined,
          projectId: String(formData.get('projectId') ?? '') || null,
          participantIds: formData.getAll('participantIds').map(String),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        setErrors((json.error?.details as Record<string, string>) ?? {});
        throw new Error(json.error?.message ?? 'Não foi possível agendar a reunião.');
      }

      toast.success('Reunião agendada. Todos os participantes foram notificados.');
      setOpen(false);
      router.push(`/reunioes/${json.data.id}`);
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
        <Plus className="size-4" aria-hidden /> Nova reunião
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Agendar reunião" description="A reunião entra automaticamente na agenda de cada participante.">
          <form action={submit} className="space-y-4">
            <Input name="title" label="Título" placeholder="ex.: Alinhamento semanal" error={errors.title} autoFocus required />

            <div className="grid gap-4 sm:grid-cols-3">
              <Input name="date" type="date" label="Data" defaultValue={today} required />
              <Input name="start" type="time" label="Início" defaultValue="09:00" required />
              <Input name="end" type="time" label="Término" defaultValue="10:00" error={errors.endsAt} required />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="location" label="Local ou link (opcional)" placeholder="Sala 1 ou link da chamada" />
              <Select name="projectId" label="Projeto (opcional)" defaultValue="">
                <option value="">Sem projeto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </Select>
            </div>

            <Textarea name="agenda" label="Pauta (opcional)" placeholder="Tópicos a discutir…" className="min-h-20" />

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-ink-muted">Participantes</legend>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-2 scrollbar-thin">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-overlay"
                  >
                    <input
                      type="checkbox"
                      name="participantIds"
                      value={member.id}
                      className="size-4 rounded border-line-strong bg-surface accent-brand"
                    />
                    {member.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={pending}>Agendar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
