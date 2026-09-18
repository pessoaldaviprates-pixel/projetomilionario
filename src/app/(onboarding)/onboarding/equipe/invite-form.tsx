'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/input';
import { inviteMembersAction, type InviteActionState } from '@/server/actions/company.actions';

const INITIAL: InviteActionState = { ok: false };

const STATUS_LABELS: Record<string, string> = {
  invited: 'Convite enviado',
  already_member: 'Já faz parte da equipe',
  already_invited: 'Convite reenviado',
};

export function InviteTeamForm({ roles }: { roles: { id: string; name: string; isDefault: boolean }[] }) {
  const [state, action, pending] = useActionState(inviteMembersAction, INITIAL);
  const defaultRole = roles.find((role) => role.isDefault) ?? roles[roles.length - 1];

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4" noValidate>
        {state.message ? (
          <div
            role="status"
            className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
              state.ok
                ? 'border-success/25 bg-success/10 text-success'
                : 'border-danger/25 bg-danger/10 text-danger'
            }`}
          >
            {state.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>{state.message}</span>
          </div>
        ) : null}

        <Textarea
          name="emails"
          label="E-mails para convidar"
          placeholder={'ana@empresa.com\nlucas@empresa.com\ncarla@empresa.com'}
          hint="Um por linha, ou separados por vírgula."
          className="min-h-32 font-mono text-[13px]"
          required
        />

        <Select name="roleId" label="Cargo inicial" defaultValue={defaultRole?.id ?? ''}>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </Select>

        <Button type="submit" variant="secondary" loading={pending} className="w-full">
          Enviar convites
        </Button>
      </form>

      {state.results?.some((result) => result.inviteUrl) ? (
        <div className="space-y-2 rounded-xl border border-line bg-surface-raised p-4">
          <p className="text-xs font-medium text-ink-muted">
            Links de convite (visíveis apenas em desenvolvimento)
          </p>
          {state.results
            .filter((result) => result.inviteUrl)
            .map((result) => (
              <div key={result.email} className="flex items-center gap-2 text-xs">
                <span className="w-40 shrink-0 truncate text-ink-subtle">{result.email}</span>
                <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-ink-faint">
                  {result.inviteUrl}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Copiar link de ${result.email}`}
                  onClick={() => {
                    navigator.clipboard.writeText(result.inviteUrl!);
                    toast.success('Link copiado.');
                  }}
                >
                  <Copy className="size-3.5" aria-hidden />
                </Button>
              </div>
            ))}
        </div>
      ) : null}

      {state.results && state.results.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {state.results.map((result) => (
            <li key={result.email} className="flex items-center justify-between gap-3">
              <span className="truncate text-ink-muted">{result.email}</span>
              <span className="shrink-0 text-xs text-ink-faint">
                {STATUS_LABELS[result.status] ?? result.status}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
        <Link href="/onboarding/configuracao" className="text-sm text-ink-subtle hover:text-ink">
          Pular por enquanto
        </Link>
        <Button asChild>
          <Link href="/onboarding/configuracao">
            Continuar <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}
