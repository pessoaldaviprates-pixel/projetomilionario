import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth/context';
import { assertChannelAccess, getChannelMembers, listMessages } from '@/server/services/chat.service';
import { listMemberOptions } from '@/server/services/members.service';
import { NotFoundError } from '@/lib/http/errors';
import { ChannelView } from './channel-view';

export const metadata: Metadata = { title: 'Conversa' };

export default async function ChannelPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAuth();
  const { id } = await params;

  let channel;
  try {
    ({ channel } = await assertChannelAccess(ctx, id));
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [page, channelMembers, allMembers] = await Promise.all([
    listMessages(ctx, id, { limit: 40 }),
    getChannelMembers(ctx, id),
    listMemberOptions(ctx),
  ]);

  const peers = channelMembers
    .filter((member) => member.membership.id !== ctx.membershipId)
    .map((member) => ({
      id: member.membership.id,
      name: member.membership.user.name,
      avatarUrl: member.membership.user.avatarUrl,
      presence: member.membership.presence,
      roleName: member.membership.role.name,
    }));

  const isDirect = channel.kind === 'DIRECT' || channel.kind === 'GROUP_DM';
  const title = isDirect
    ? (peers.map((peer) => peer.name).join(', ') || 'Conversa')
    : `#${channel.name}`;

  return (
    <ChannelView
      channelId={id}
      title={title}
      topic={channel.topic}
      kind={channel.kind}
      memberCount={channelMembers.length}
      peers={peers}
      initialMessages={page.items}
      nextCursor={page.nextCursor}
      currentMembershipId={ctx.membershipId}
      mentionOptions={allMembers.map((member) => ({
        id: member.id,
        name: member.user.name,
        avatarUrl: member.user.avatarUrl,
      }))}
      canModerate={ctx.can('messages.moderate')}
      canUseAi={ctx.can('ai.use')}
    />
  );
}
