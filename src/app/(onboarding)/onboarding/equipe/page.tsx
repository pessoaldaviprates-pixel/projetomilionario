import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/context';
import { prisma } from '@/lib/db/prisma';
import { OnboardingSteps } from '../steps';
import { InviteTeamForm } from './invite-form';

export const metadata: Metadata = { title: 'Convidar equipe' };

export default async function OnboardingTeamPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/onboarding');

  const roles = await prisma.role.findMany({
    where: { companyId: ctx.companyId, isActive: true },
    orderBy: { rank: 'asc' },
    select: { id: true, name: true, isDefault: true },
  });

  return (
    <div className="animate-slide-up">
      <OnboardingSteps current="equipe" />

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-balance text-ink">
          Convide sua equipe
        </h1>
        <p className="mt-2 text-ink-muted">
          A Nexora fica boa quando as pessoas estão dentro. Convide agora ou pule — dá para
          convidar a qualquer momento em Funcionários.
        </p>
      </header>

      <InviteTeamForm roles={roles} />
    </div>
  );
}
