'use client';

import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-strong active:bg-brand-strong shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]',
  secondary: 'bg-surface-overlay text-ink hover:bg-surface-hover border border-line',
  ghost: 'text-ink-muted hover:bg-surface-overlay hover:text-ink',
  outline: 'border border-line-strong text-ink hover:bg-surface-overlay hover:border-brand/50',
  danger: 'bg-danger/90 text-white hover:bg-danger',
  link: 'text-brand hover:text-brand-glow underline-offset-4 hover:underline p-0 h-auto',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, asChild, children, disabled, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';

  return (
    <Component
      ref={ref}
      // `aria-busy` informa leitores de tela do estado de carregamento.
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-colors duration-150 select-none',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        variant !== 'link' && SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {size !== 'icon' && size !== 'icon-sm' ? children : null}
        </>
      ) : (
        children
      )}
    </Component>
  );
});
