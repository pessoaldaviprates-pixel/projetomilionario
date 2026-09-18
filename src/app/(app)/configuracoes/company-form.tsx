'use client';

import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { updateCompanyAction } from '@/server/actions/company.actions';
import type { ActionState } from '@/server/actions/auth.actions';

const INITIAL: ActionState = { ok: false };

const SEGMENTS = [
  'Tecnologia', 'Serviços', 'Comércio', 'Indústria', 'Saúde', 'Educação',
  'Financeiro', 'Construção', 'Logística', 'Marketing', 'Jurídico', 'Outro',
];

export function CompanyForm({ defaults }: { defaults: { name: string } }) {
  const [state, action, pending] = useActionState(updateCompanyAction, INITIAL);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <Input name="name" label="Nome da empresa" defaultValue={defaults.name} error={state.fields?.name} required />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="segment" label="Segmento" defaultValue="">
          <option value="">Não informado</option>
          {SEGMENTS.map((segment) => (
            <option key={segment} value={segment}>{segment}</option>
          ))}
        </Select>

        <Input name="website" type="url" label="Site" placeholder="https://" error={state.fields?.website} />
      </div>

      <Textarea name="goal" label="Objetivo com a Nexora" className="min-h-16" maxLength={200} />

      <Button type="submit" size="sm" loading={pending}>Salvar alterações</Button>
    </form>
  );
}
