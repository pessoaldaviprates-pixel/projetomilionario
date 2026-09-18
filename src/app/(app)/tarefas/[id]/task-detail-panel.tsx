'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListChecks, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox, Progress } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';

interface ChecklistItem {
  id: string;
  title: string;
  isDone: boolean;
}

export function TaskDetailPanel({
  taskId,
  checklist,
  canEdit,
}: {
  taskId: string;
  checklist: ChecklistItem[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState(checklist);
  const [newItem, setNewItem] = useState('');
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  const done = items.filter((item) => item.isDone).length;
  const progress = items.length === 0 ? 0 : Math.round((done / items.length) * 100);

  async function toggle(itemId: string, isDone: boolean) {
    const previous = items;
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, isDone } : item)));

    try {
      const response = await fetch(`/api/tarefas/${taskId}/checklist`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, isDone }),
      });
      if (!response.ok) throw new Error('falha');
    } catch {
      setItems(previous);
      toast.error('Não foi possível atualizar o item.');
    }
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const title = newItem.trim();
    if (!title) return;

    setAdding(true);
    try {
      const response = await fetch(`/api/tarefas/${taskId}/checklist`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error('falha');

      const json = await response.json();
      setItems((current) => [...current, { id: json.data.id, title, isDone: false }]);
      setNewItem('');
      router.refresh();
    } catch {
      toast.error('Não foi possível adicionar o item.');
    } finally {
      setAdding(false);
    }
  }

  if (items.length === 0 && !canEdit) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="size-4" aria-hidden /> Checklist
        </CardTitle>
        {items.length > 0 ? (
          <span className="text-xs text-ink-faint tabular-nums">
            {done}/{items.length}
          </span>
        ) : null}
      </CardHeader>

      <div className="px-5 pb-5">
        {items.length > 0 ? (
          <>
            <Progress value={progress} tone={progress === 100 ? 'success' : 'brand'} className="mb-4" />
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5">
                  <Checkbox
                    id={`check-${item.id}`}
                    checked={item.isDone}
                    disabled={!canEdit}
                    onCheckedChange={(checked) => toggle(item.id, checked === true)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`check-${item.id}`}
                    className={`cursor-pointer text-sm ${item.isDone ? 'text-ink-faint line-through' : 'text-ink-muted'}`}
                  >
                    {item.title}
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-ink-faint">Nenhum item no checklist.</p>
        )}

        {canEdit ? (
          <form onSubmit={add} className="mt-4 flex gap-2">
            <input
              value={newItem}
              onChange={(event) => setNewItem(event.target.value)}
              placeholder="Adicionar item…"
              aria-label="Novo item do checklist"
              maxLength={200}
              className="h-9 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand/60 focus:outline-none"
            />
            <Button type="submit" size="sm" variant="secondary" loading={adding} disabled={!newItem.trim()}>
              <Plus className="size-3.5" aria-hidden />
            </Button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}
