import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const STEPS = [
  { key: 'empresa', label: 'Empresa' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'configuracao', label: 'Pronto' },
] as const;

export function OnboardingSteps({ current }: { current: (typeof STEPS)[number]['key'] }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <ol className="mb-8 flex items-center gap-2" aria-label="Progresso da configuração">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;

        return (
          <li key={step.key} className="flex flex-1 items-center gap-2">
            <span
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                done
                  ? 'border-brand bg-brand text-white'
                  : active
                    ? 'border-brand bg-brand/12 text-brand'
                    : 'border-line bg-surface text-ink-faint',
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
            </span>
            <span className={cn('hidden text-xs sm:block', active ? 'font-medium text-ink' : 'text-ink-faint')}>
              {step.label}
            </span>
            {index < STEPS.length - 1 ? (
              <span className={cn('h-px flex-1', done ? 'bg-brand' : 'bg-line')} aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
