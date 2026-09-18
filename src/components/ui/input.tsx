'use client';

import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const FIELD_BASE =
  'w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint ' +
  'transition-colors focus:border-brand/60 focus:outline-none focus:ring-2 focus:ring-brand/20 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger/70 aria-[invalid=true]:ring-danger/20';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

/**
 * Wrapper de campo com rótulo, dica e erro já ligados por aria-describedby.
 * Centralizar isso é o que garante acessibilidade consistente em todo o app.
 */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: FieldProps & { htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-ink-muted">
          {label}
          {required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, FieldProps {
  icon?: React.ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, containerClassName, label, hint, error, icon, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  const control = (
    <div className="relative">
      {icon ? (
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" aria-hidden>
          {icon}
        </span>
      ) : null}
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(FIELD_BASE, 'h-11', icon ? 'pl-10' : '', className)}
        {...props}
      />
    </div>
  );

  if (!label && !hint && !error) return <div className={containerClassName}>{control}</div>;

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId} className={containerClassName}>
      {control}
    </Field>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(
  { className, label, hint, error, id, required, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId}>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          className={cn(FIELD_BASE, 'h-11 pr-11', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-ink-faint transition-colors hover:text-ink-muted"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    </Field>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  function Textarea({ className, label, hint, error, id, required, ...props }, ref) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;

    const control = (
      <textarea
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(FIELD_BASE, 'min-h-24 resize-y py-2.5 leading-relaxed', className)}
        {...props}
      />
    );

    if (!label && !hint && !error) return control;

    return (
      <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId}>
        {control}
      </Field>
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(
  function Select({ className, label, hint, error, id, required, children, ...props }, ref) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;

    const control = (
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={cn(FIELD_BASE, 'h-11 cursor-pointer appearance-none bg-[length:16px] pr-9', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237A8AA3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundPosition: 'right 12px center',
          backgroundRepeat: 'no-repeat',
        }}
        {...props}
      >
        {children}
      </select>
    );

    if (!label && !hint && !error) return control;

    return (
      <Field label={label} hint={hint} error={error} required={required} htmlFor={fieldId}>
        {control}
      </Field>
    );
  },
);
