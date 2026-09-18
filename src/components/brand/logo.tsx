import { cn } from '@/lib/utils/cn';

/**
 * Marca Nexora.
 *
 * O símbolo é o "N" com o corte diagonal do 1 — desenhado em SVG puro para
 * ficar nítido em qualquer densidade e herdar a cor do contexto.
 */
export function NexoraMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={cn('size-8', className)} aria-hidden>
      <defs>
        <linearGradient id="nexora-mark" x1="4" y1="44" x2="44" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1D63E0" />
          <stop offset="0.55" stopColor="#2E7DFF" />
          <stop offset="1" stopColor="#4FC3FF" />
        </linearGradient>
      </defs>
      <path
        d="M7 41V13.8c0-1.4 1.7-2.1 2.7-1.1l24.6 24.6c1 1 2.7.3 2.7-1.1V7"
        stroke="url(#nexora-mark)"
        strokeWidth="7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M30 13.5 37 7v10.5" fill="url(#nexora-mark)" />
    </svg>
  );
}

export function NexoraLogo({
  className,
  showTagline = false,
  size = 'md',
}: {
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: { mark: 'size-6', text: 'text-base', tagline: 'text-[9px]' },
    md: { mark: 'size-8', text: 'text-xl', tagline: 'text-[10px]' },
    lg: { mark: 'size-12', text: 'text-3xl', tagline: 'text-xs' },
  };

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <NexoraMark className={sizes[size].mark} />
      <span className="flex flex-col leading-none">
        <span className={cn('font-bold tracking-tight text-ink', sizes[size].text)}>Nexora</span>
        {showTagline ? (
          <span className={cn('mt-1 font-medium tracking-[0.18em] text-ink-faint uppercase', sizes[size].tagline)}>
            Pessoas + Processos + Resultados
          </span>
        ) : null}
      </span>
    </span>
  );
}
