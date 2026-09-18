import { NexoraLogo } from '@/components/brand/logo';
import { requireUser } from '@/lib/auth/context';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="grid-backdrop absolute inset-0 opacity-25" aria-hidden />
      <div
        className="absolute top-[-15%] left-1/2 size-[600px] -translate-x-1/2 rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #2E7DFF 0%, transparent 70%)' }}
        aria-hidden
      />

      <header className="relative flex h-16 items-center px-5 sm:px-8">
        <NexoraLogo size="sm" />
      </header>

      <main id="conteudo" className="relative mx-auto max-w-2xl px-5 pt-6 pb-16 sm:px-8">
        {children}
      </main>
    </div>
  );
}
