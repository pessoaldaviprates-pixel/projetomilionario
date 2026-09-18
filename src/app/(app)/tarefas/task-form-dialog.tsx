'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import type { TaskRowData } from '@/components/app/task-row';

export interface TaskFormOption {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TaskFormOption[];
  projects: { id: string; name: string; color: string }[];
  canAssign: boolean;
  currentMembershipId: string;
  defaultProjectId?: string;
  onCreated: (task: TaskRowData) => void;
}

const PRIORITIES = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

export function TaskFormDialog({
  open,
  onOpenChange,
  members,
  projects,
  canAssign,
  currentMembershipId,
  defaultProjectId,
  onCreated,
}: TaskFormDialogProps) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(formData: FormData) {
    setPending(true);
    setErrors({});

    const dueDate = String(formData.get('dueAt') ?? '');
    const dueTime = String(formData.get('dueTime') ?? '18:00');

    const payload = {
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      priority: String(formData.get('priority') ?? 'MEDIUM'),
      projectId: String(formData.get('projectId') ?? '') || null,
      assigneeId: String(formData.get('assigneeId') ?? '') || null,
      // O input date devolve data local; combinamos com a hora antes de enviar.
      dueAt: dueDate ? new Date(`${dueDate}T${dueTime}:00`).toISOString() : null,
      checklist: String(formData.get('checklist') ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    };

    try {
      const response = await fetch('/api/tarefas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (!response.ok) {
        setErrors((json.error?.details as Record<string, string>) ?? {});
        throw new Error(json.error?.message ?? 'Não foi possível criar a tarefa.');
      }

      const assignee = members.find((member) => member.id === payload.assigneeId);
      const project = projects.find((item) => item.id === payload.projectId);

      onCreated({
        id: json.data.id,
        title: json.data.title,
        status: json.data.status,
        priority: json.data.priority,
        dueAt: json.data.dueAt ? new Date(json.data.dueAt) : null,
        tags: json.data.tags ?? [],
        assignee: assignee ? { id: assignee.id, user: { name: assignee.name, avatarUrl: assignee.avatarUrl ?? null } } : null,
        project: project ? { id: project.id, name: project.name, color: project.color, key: '' } : null,
        checklistDone: 0,
        checklistTotal: payload.checklist.length,
      });

      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Nova tarefa" description="Defina o que precisa ser feito, por quem e até quando.">
        <form action={submit} className="space-y-4">
          <Input
            name="title"
            label="Título"
            placeholder="O que precisa ser feito?"
            error={errors.title}
            autoFocus
            required
          />

          <Textarea
            name="description"
            label="Descrição (opcional)"
            placeholder="Contexto, critérios de aceite, links…"
            className="min-h-20"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select name="priority" label="Prioridade" defaultValue="MEDIUM">
              {PRIORITIES.map((priority) => (
                <option key={priority.value} value={priority.value}>{priority.label}</option>
              ))}
            </Select>

            <Select
              name="assigneeId"
              label="Responsável"
              defaultValue={currentMembershipId}
              disabled={!canAssign}
              hint={canAssign ? undefined : 'Você só pode atribuir tarefas a si mesmo.'}
            >
              <option value="">Sem responsável</option>
              {(canAssign ? members : members.filter((member) => member.id === currentMembershipId)).map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </Select>
          </div>

          <div className={projects.length > 0 ? 'grid gap-4 sm:grid-cols-3' : 'grid gap-4 sm:grid-cols-2'}>
            {projects.length > 0 ? (
              <Select name="projectId" label="Projeto" defaultValue={defaultProjectId ?? ''}>
                <option value="">Sem projeto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </Select>
            ) : (
              // Dentro de um projeto não há o que escolher: o vínculo já está definido.
              <input type="hidden" name="projectId" value={defaultProjectId ?? ''} />
            )}

            <Input name="dueAt" type="date" label="Prazo" error={errors.dueAt} />
            <Input name="dueTime" type="time" label="Hora" defaultValue="18:00" />
          </div>

          <Textarea
            name="checklist"
            label="Checklist (opcional)"
            placeholder={'Um item por linha'}
            className="min-h-20"
          />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>Criar tarefa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
