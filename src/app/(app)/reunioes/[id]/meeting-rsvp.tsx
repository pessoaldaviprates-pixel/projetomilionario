'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, HelpCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';

const OPTIONS = [
  { value: 'ACCEPTED' as const, label: 'Vou', icon: Check, active: 'border-success/40 bg-success/12 text-success' },
  { value: 'TENTATIVE' as const, label: 'Talvez', icon: HelpCircle, active: 'border-warning/40 bg-warning/12 text-warning' },
  { value: 'DECLINED' as const, label: 'Não vou', icon: X, active: 'border-danger/40 bg-danger/12 text-danger' },
];

export function MeetingRsvp({
  meetingId,
  current,
}: {
  meetingId: string;
  current: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
}) {
  const [value, setValue] = useState(current);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function respond(response: (typeof OPTIONS)[number]['value']) {
    const previous = value;
    setValue(response);
    setPending(true);

    try {
      const result = await fetch(`/api/reunioes/${meetingId}/resposta`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response }),
      });
      if (!result.ok) throw new Error('falha');
      router.refresh();
    } catch {
      setValue(previous);
      toast.error('Não foi possível registrar sua resposta.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-1 rounded-xl border border-line bg-surface p-1" role="group" aria-label="Sua resposta ao convite">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={pending}
          onClick={() => respond(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60',
            value === option.value ? option.active : 'text-ink-subtle hover:bg-surface-overlay hover:text-ink',
          )}
        >
          <option.icon className="size-3.5" aria-hidden />
          {option.label}
        </button>
      ))}
    </div>
  );
}
