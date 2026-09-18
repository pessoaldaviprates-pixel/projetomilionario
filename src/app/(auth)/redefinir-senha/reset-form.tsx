'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/input';
import { resetPasswordAction, type ActionState } from '@/server/actions/auth.actions';

const INITIAL: ActionState = { ok: false };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, INITIAL);

  if (state.ok) {
    return (
      <div role="status" className="space-y-4 rounded-xl border border-success/25 bg-success/10 p-5 text-center">
        <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
        <p className="text-sm text-ink-muted">{state.message}</p>
        <Button asChild size="sm" className="w-full">
          <Link href="/login">Ir para o login</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.message ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      ) : null}

      <PasswordInput
        name="password"
        label="Nova senha"
        placeholder="Mínimo de 8 caracteres"
        autoComplete="new-password"
        hint="Use letras maiúsculas, minúsculas e números."
        error={state.fields?.password}
        required
      />

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Redefinir senha
      </Button>
    </form>
  );
}
