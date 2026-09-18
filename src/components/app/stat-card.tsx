import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const TONES = {
  brand: 'text-brand bg-brand/12',
  success: 'text-success bg-success/12',
  warning: 'text-warning bg-warning/12',
  danger: 'text-danger bg-danger/12',
  accent: 'text-accent bg-accent/12',
  info: 'text-info bg-info/12',
} as const;

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  href?: string;
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', href }: StatCardProps) {
  const content = (
    <>
      <div className={cn('flex size-9 items-center justify-center rounded-xl', TONES[tone])}>
        <Icon className="size-[18px]" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-2xl leading-none font-semibold text-ink tabular-nums">{value}</p>
        <p className="mt-1.5 truncate text-sm text-ink-muted">{label}</p>
        {hint ? <p className="mt-0.5 truncate text-xs text-ink-faint">{hint}</p> : null}
      </div>
    </>
  );

  const className = cn(
    'flex items-center gap-3.5 rounded-card border border-line bg-surface-raised p-4',
    href ? 'transition-colors hover:border-brand/40 hover:bg-surface-overlay' : '',
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
