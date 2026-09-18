'use client';

import { useActionState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { acceptInviteAction, type ActionState } from '@/server/actions/auth.actions';

const INITIAL: ActionState = { ok: false };

export function AcceptInviteForm({ token, companyName }: { token: string; companyName: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.message && !state.ok ? (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" loading={pending} className="w-full">
        Entrar na {companyName} <ArrowRight className="size-4" aria-hidden />
      </Button>

      <p className="text-xs text-ink-faint">
        Ao aceitar, você entra automaticamente nos canais públicos da empresa.
      </p>
    </form>
  );
}
