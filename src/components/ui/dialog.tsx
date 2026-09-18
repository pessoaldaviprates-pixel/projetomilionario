'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  size = 'md',
}: {
  className?: string;
  children: React.ReactNode;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
          'rounded-2xl border border-line bg-surface-raised shadow-2xl',
          'max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-thin',
          'data-[state=open]:animate-scale-in',
          widths[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div className="space-y-1">
            <DialogPrimitive.Title className="text-base font-semibold text-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-ink-subtle">{description}</DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-overlay hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </div>
        <div className="p-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-5 flex items-center justify-end gap-3', className)} {...props} />;
}
