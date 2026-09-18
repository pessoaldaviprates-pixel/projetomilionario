import { cn } from '@/lib/utils/cn';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-overlay text-ink-muted border-line',
  brand: 'bg-brand/12 text-brand-glow border-brand/25',
  success: 'bg-success/12 text-success border-success/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  danger: 'bg-danger/12 text-danger border-danger/25',
  info: 'bg-info/12 text-info border-info/25',
  accent: 'bg-accent/12 text-accent border-accent/25',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ className, tone = 'neutral', dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}
