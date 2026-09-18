import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ArrowRight, Calendar, CheckCircle2, MessageSquare, Sparkles, Users, Video } from 'lucide-react';
import { getAuthContext } from '@/lib/auth/context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { finishOnboardingAction } from '@/server/actions/company.actions';
import { OnboardingSteps } from '../steps';

export const metadata: Metadata = { title: 'Tudo pronto' };

const READY = [
  { icon: MessageSquare, title: 'Canais criados', text: '#geral, #anuncios e #aleatorio já estão disponíveis para o time.' },
  { icon: Users, title: 'Cargos configurados', text: '14 cargos padrão com permissões prontas — e totalmente editáveis.' },
  { icon: Calendar, title: 'Agenda ativa', text: 'Reuniões e prazos de tarefas aparecem automaticamente no calendário.' },
  { icon: Sparkles, title: 'Inteligência ligada', text: 'A Nexora identifica tarefas e prazos nas conversas e reuniões.' },
];

export default async function OnboardingReadyPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/onboarding');

  return (
    <div className="animate-slide-up">
      <OnboardingSteps current="configuracao" />

      <header className="mb-8">
        <div className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-success/12 text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance text-ink">
          A {ctx.company.name} está pronta!
        </h1>
        <p className="mt-2 text-ink-muted">
          Seu ambiente foi configurado. Veja o que já está funcionando.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {READY.map((item) => (
          <Card key={item.title} className="p-4">
            <item.icon className="mb-3 size-4 text-brand" aria-hidden />
            <p className="text-sm font-medium text-ink">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-subtle">{item.text}</p>
          </Card>
        ))}
      </div>

      <form action={finishOnboardingAction} className="mt-8">
        <Button type="submit" size="lg" className="w-full">
          Entrar na Nexora <ArrowRight className="size-4" aria-hidden />
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-ink-faint">
        Você pode ajustar cargos, permissões e configurações a qualquer momento.
      </p>
    </div>
  );
}
