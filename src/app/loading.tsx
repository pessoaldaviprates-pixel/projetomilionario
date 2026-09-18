import { NexoraMark } from '@/components/brand/logo';

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <NexoraMark className="size-10 animate-pulse-soft" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
