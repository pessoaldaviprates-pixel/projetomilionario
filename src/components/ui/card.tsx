import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border border-line bg-surface-raised', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-4 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold text-ink', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-ink-subtle', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-3 border-t border-line p-5', className)} {...props} />;
}

/**
 * Link de ação no cabeçalho de um card ("Ver todas", "Agenda"…).
 *
 * Existe como componente para garantir o alvo de toque mínimo de 24px em
 * todas as ocorrências — um link de 16px de altura é difícil de acertar no
 * celular e reprova em WCAG 2.5.8.
 */
export function CardLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-6 shrink-0 items-center rounded px-1 text-xs font-medium text-brand',
        'transition-colors hover:text-brand-glow hover:underline',
        className,
      )}
    >
      {children}
    </Link>
  );
}
