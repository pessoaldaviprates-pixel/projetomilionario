'use client';

import { useActionState } from 'react';
import { AlertCircle, Mail, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { forgotPasswordAction, type ActionState } from '@/server/actions/auth.actions';

const INITIAL: ActionState = { ok: false };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, INITIAL);

  if (state.ok) {
    return (
      <div role="status" className="space-y-3 rounded-xl border border-brand/25 bg-brand/10 p-5 text-center">
        <MailCheck className="mx-auto size-8 text-brand" aria-hidden />
        <p className="text-sm text-ink-muted">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      ) : null}

      <Input
        name="email"
        type="email"
        label="E-mail da conta"
        placeholder="seu@email.com"
        autoComplete="email"
        icon={<Mail className="size-4" />}
        error={state.fields?.email}
        required
      />

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Enviar instruções
      </Button>
    </form>
  );
}
