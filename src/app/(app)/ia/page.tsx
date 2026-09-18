import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/context';
import { listPendingActions, listThreads } from '@/server/services/ai.service';
import { hasEntitlement } from '@/lib/billing/subscription';
import { AssistantWorkspace } from './assistant-workspace';

export const metadata: Metadata = { title: 'Assistente' };

export default async function AssistantPage() {
  const ctx = await requireAuth();

  const [threads, suggestions, enabled] = await Promise.all([
    listThreads(ctx),
    listPendingActions(ctx, 6),
    hasEntitlement(ctx.companyId, 'ai.assistant'),
  ]);

  return (
    <AssistantWorkspace
      threads={threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        updatedAt: thread.updatedAt.toISOString(),
        messageCount: thread._count.messages,
      }))}
      suggestions={suggestions}
      enabled={enabled}
      userName={ctx.user.name.split(' ')[0] ?? ''}
      companyName={ctx.company.name}
    />
  );
}
