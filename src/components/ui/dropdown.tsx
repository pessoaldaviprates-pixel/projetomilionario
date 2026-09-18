'use client';

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils/cn';

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-xl border border-line bg-surface-overlay p-1 shadow-2xl',
          'data-[state=open]:animate-scale-in',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof DropdownPrimitive.Item> & { danger?: boolean }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors',
        'focus:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        danger ? 'text-danger focus:bg-danger/10' : 'text-ink-muted focus:text-ink',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownLabel({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn('px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-ink-faint uppercase', className)}
      {...props}
    />
  );
}

export function DropdownSeparator({ className, ...props }: React.ComponentProps<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className={cn('my-1 h-px bg-line', className)} {...props} />;
}
