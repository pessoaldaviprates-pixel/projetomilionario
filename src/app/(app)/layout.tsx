import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { requireAuth } from '@/lib/auth/context';
import { countUnread } from '@/server/services/notifications.service';
import { countUnreadMessages } from '@/server/services/chat.service';

/**
 * Layout autenticado.
 *
 * O guard fica aqui, no servidor: qualquer rota sob `(app)` já chega com
 * sessão válida, empresa ativa e permissões resolvidas. Nenhuma página filha
 * precisa repetir a checagem para EXISTIR — mas cada uma revalida a permissão
 * específica da sua ação, porque esconder a UI não é autorização.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();

  // Empresa recém-criada vai para o onboarding antes de usar o produto.
  if (!ctx.company.onboardedAt) redirect('/onboarding/configuracao');

  const [notifications, messages] = await Promise.all([
    countUnread(ctx),
    countUnreadMessages(ctx),
  ]);

  return (
    <AppShell
      permissions={Array.from(ctx.permissions)}
      isOwner={ctx.isOwner}
      user={{ name: ctx.user.name, email: ctx.user.email, avatarUrl: ctx.user.avatarUrl }}
      company={{ name: ctx.company.name }}
      roleName={ctx.role.name}
      badges={{ notifications, messages }}
    >
      {children}
    </AppShell>
  );
}
