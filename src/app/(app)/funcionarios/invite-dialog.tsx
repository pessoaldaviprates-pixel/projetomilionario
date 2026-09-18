'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/input';
import { inviteMembersAction, type InviteActionState } from '@/server/actions/company.actions';

const INITIAL: InviteActionState = { ok: false };

export function InviteDialog({
  open,
  onOpenChange,
  roles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(inviteMembersAction, INITIAL);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok || !state.message) return;
    toast.success(state.message);
    router.refresh();
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Convidar pessoas" description="Cada pessoa recebe um link de convite por e-mail.">
        <form action={action} className="space-y-4">
          {state.message && !state.ok ? (
            <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
              {state.message}
            </p>
          ) : null}

          <Textarea
            name="emails"
            label="E-mails"
            placeholder={'ana@empresa.com\nlucas@empresa.com'}
            hint="Um por linha, ou separados por vírgula."
            className="min-h-28 font-mono text-[13px]"
            required
          />

          <Select name="roleId" label="Cargo inicial" defaultValue={roles[roles.length - 1]?.id ?? ''}>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </Select>

          {state.results?.some((result) => result.inviteUrl) ? (
            <div className="space-y-1.5 rounded-xl border border-line bg-surface p-3">
              <p className="text-xs font-medium text-ink-muted">Links (ambiente de desenvolvimento)</p>
              {state.results
                .filter((result) => result.inviteUrl)
                .map((result) => (
                  <p key={result.email} className="truncate text-[11px] text-ink-faint">
                    {result.email}: {result.inviteUrl}
                  </p>
                ))}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button type="submit" loading={pending}>Enviar convites</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
