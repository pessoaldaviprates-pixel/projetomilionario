'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, PasswordInput } from '@/components/ui/input';
import { assessPassword } from '@/lib/auth/password-policy';
import { cn } from '@/lib/utils/cn';
import { registerAction, type ActionState } from '@/server/actions/auth.actions';

const INITIAL: ActionState = { ok: false };

const STRENGTH_TONES = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success'];

export function RegisterForm({ inviteToken, plan }: { inviteToken?: string; plan?: string }) {
  const [state, action, pending] = useActionState(registerAction, INITIAL);
  const [password, setPassword] = useState('');
  const router = useRouter();

  const strength = assessPassword(password);

  useEffect(() => {
    if (!state.ok) return;
    // Cadastro cria a sessão; o próximo passo é montar a empresa.
    const timer = setTimeout(() => router.push(plan ? `/onboarding?plano=${plan}` : '/onboarding'), 900);
    return () => clearTimeout(timer);
  }, [state.ok, plan, router]);

  if (state.ok) {
    return (
      <div role="status" className="space-y-4 rounded-xl border border-success/25 bg-success/10 p-5 text-center">
        <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
        <div>
          <p className="text-sm font-medium text-ink">Conta criada!</p>
          <p className="mt-1 text-sm text-ink-subtle">
            Enviamos um e-mail de confirmação. Vamos configurar sua empresa.
          </p>
        </div>
        {state.devLink ? (
          <Link href={state.devLink} className="block text-xs text-brand hover:underline">
            Link de verificação (ambiente de desenvolvimento)
          </Link>
        ) : null}
        <Button asChild size="sm" className="w-full">
          <Link href={plan ? `/onboarding?plano=${plan}` : '/onboarding'}>
            Continuar <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}

      {state.message ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      ) : null}

      <Input
        name="name"
        label="Nome completo"
        placeholder="Como devemos chamar você"
        autoComplete="name"
        icon={<User className="size-4" />}
        error={state.fields?.name}
        required
      />

      <Input
        name="email"
        type="email"
        label="E-mail corporativo"
        placeholder="voce@suaempresa.com"
        autoComplete="email"
        error={state.fields?.email}
        required
      />

      <div className="space-y-2">
        <PasswordInput
          name="password"
          label="Senha"
          placeholder="Crie uma senha forte"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={state.fields?.password}
          required
        />

        {password ? (
          <div className="space-y-1.5" aria-live="polite">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    index < strength.score ? STRENGTH_TONES[strength.score] : 'bg-surface-overlay',
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-ink-faint">
              Segurança: <span className="text-ink-muted">{strength.label}</span>
              {strength.issues.length > 0 ? ` · ${strength.issues[0]}` : ''}
            </p>
          </div>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-xs leading-relaxed text-ink-muted">
        <input
          type="checkbox"
          name="acceptTerms"
          required
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong bg-surface accent-brand"
        />
        <span>
          Li e aceito os <span className="text-brand">Termos de Uso</span> e a{' '}
          <span className="text-brand">Política de Privacidade</span> da Nexora.
        </span>
      </label>
      {state.fields?.acceptTerms ? (
        <p role="alert" className="text-xs text-danger">{state.fields.acceptTerms}</p>
      ) : null}

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Criar conta
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
