import { requireAuth } from '@/lib/auth/context';
import { listChannels } from '@/server/services/chat.service';
import { listMemberOptions } from '@/server/services/members.service';
import { ChannelSidebar } from './channel-sidebar';

/**
 * Layout de mensagens em duas colunas.
 * A lista de canais fica no layout (e não na página) para não recarregar a
 * cada troca de conversa — só o painel da direita muda.
 */
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();

  const [channels, members] = await Promise.all([listChannels(ctx), listMemberOptions(ctx)]);

  return (
    <div className="flex h-full">
      <ChannelSidebar
        channels={channels}
        members={members.map((member) => ({
          id: member.id,
          name: member.user.name,
          avatarUrl: member.user.avatarUrl,
        }))}
        canCreate={ctx.can('channels.create')}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
