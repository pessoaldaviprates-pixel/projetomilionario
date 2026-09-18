'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, PasswordInput } from '@/components/ui/input';
import { loginAction, type ActionState } from '@/server/actions/auth.actions';

const INITIAL: ActionState = { ok: false };

export function LoginForm({ inviteToken }: { inviteToken?: string }) {
  const [state, action, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={action} className="space-y-4" noValidate>
      {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}

      {state.message && !state.ok ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      ) : null}

      <Input
        name="email"
        type="email"
        label="E-mail ou usuário"
        placeholder="seu@email.com"
        autoComplete="email"
        icon={<Mail className="size-4" />}
        error={state.fields?.email}
        required
      />

      <PasswordInput
        name="password"
        label="Senha"
        placeholder="Digite sua senha"
        autoComplete="current-password"
        error={state.fields?.password}
        required
      />

      <div className="flex items-center justify-between pt-1">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="size-4 cursor-pointer rounded border-line-strong bg-surface accent-brand"
          />
          Lembrar de mim
        </label>
        <Link href="/esqueci-senha" className="text-xs font-medium text-brand hover:text-brand-glow hover:underline">
          Esqueceu sua senha?
        </Link>
      </div>

      <Button type="submit" size="lg" loading={pending} className="w-full">
        <Lock className="size-4" aria-hidden />
        Entrar
      </Button>

      <div className="flex items-center gap-3 pt-1">
        <span className="h-px flex-1 bg-line" aria-hidden />
        <span className="text-xs text-ink-faint">ou</span>
        <span className="h-px flex-1 bg-line" aria-hidden />
      </div>

      {/*
        Login social: o botão só é ativado quando um provedor OAuth estiver
        configurado. Preferimos deixá-lo visível e desabilitado, com explicação,
        a simular um fluxo que não existe.
      */}
      <Button type="button" variant="secondary" size="lg" className="w-full" disabled title="Configure um provedor OAuth para habilitar">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z" />
        </svg>
        Entrar com Google
      </Button>
    </form>
  );
}
