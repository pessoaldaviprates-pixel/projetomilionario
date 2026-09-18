'use client';

import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function Progress({
  value,
  className,
  tone = 'brand',
  label,
}: {
  value: number;
  className?: string;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  label?: string;
}) {
  const tones = { brand: 'bg-brand', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' };
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <ProgressPrimitive.Root
      value={clamped}
      aria-label={label ?? `Progresso: ${clamped}%`}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay', className)}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full rounded-full transition-all duration-500', tones[tone])}
        style={{ width: `${clamped}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 rounded-lg border border-line bg-surface-overlay px-2.5 py-1.5 text-xs text-ink shadow-xl data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-line transition-colors',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=unchecked]:bg-surface-overlay',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-3.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[3px]" />
    </SwitchPrimitive.Root>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer size-4 shrink-0 cursor-pointer rounded border border-line-strong transition-colors',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand',
        'data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
        {props.checked === 'indeterminate' ? <Minus className="size-3" /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse-soft rounded-lg bg-surface-overlay', className)} aria-hidden />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-line bg-surface-overlay text-ink-subtle">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-ink-subtle">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn('h-px w-full bg-line', className)} />;
}
