'use client';

import { useActionState } from 'react';
import { AlertCircle, ArrowRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { createCompanyAction } from '@/server/actions/company.actions';
import type { ActionState } from '@/server/actions/auth.actions';

const INITIAL: ActionState = { ok: false };

const SEGMENTS = [
  'Tecnologia', 'Serviços', 'Comércio', 'Indústria', 'Saúde', 'Educação',
  'Financeiro', 'Construção', 'Logística', 'Marketing', 'Jurídico', 'Outro',
];

const SIZES = [
  { value: 'SOLO', label: 'Apenas eu' },
  { value: 'MICRO', label: '2 a 10 pessoas' },
  { value: 'SMALL', label: '11 a 50 pessoas' },
  { value: 'MEDIUM', label: '51 a 200 pessoas' },
  { value: 'LARGE', label: '201 a 1.000 pessoas' },
  { value: 'ENTERPRISE', label: 'Mais de 1.000 pessoas' },
];

export function CreateCompanyForm() {
  const [state, action, pending] = useActionState(createCompanyAction, INITIAL);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      ) : null}

      <Input
        name="name"
        label="Nome da empresa"
        placeholder="Ex.: Atlas Tecnologia"
        icon={<Building2 className="size-4" />}
        error={state.fields?.name}
        autoFocus
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="segment" label="Segmento" defaultValue="">
          <option value="">Selecione…</option>
          {SEGMENTS.map((segment) => (
            <option key={segment} value={segment}>{segment}</option>
          ))}
        </Select>

        <Select name="sizeBand" label="Número de funcionários" defaultValue="">
          <option value="">Selecione…</option>
          {SIZES.map((size) => (
            <option key={size.value} value={size.value}>{size.label}</option>
          ))}
        </Select>
      </div>

      <Input
        name="website"
        type="url"
        label="Site (opcional)"
        placeholder="https://suaempresa.com"
        error={state.fields?.website}
      />

      <Textarea
        name="goal"
        label="Qual o principal objetivo da sua empresa com a Nexora?"
        placeholder="Ex.: centralizar a comunicação e parar de perder tarefas no meio das conversas."
        hint="Isso nos ajuda a sugerir a configuração inicial. Você pode mudar depois."
        maxLength={200}
      />

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Criar empresa <ArrowRight className="size-4" aria-hidden />
      </Button>

      <p className="text-center text-xs text-ink-faint">
        Ao criar a empresa, você recebe o cargo de administrador com todas as permissões.
      </p>
    </form>
  );
}
