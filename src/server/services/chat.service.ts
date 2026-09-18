/**
 * Comunicação: canais, mensagens, threads e reações.
 *
 * Duas regras de acesso governam todo o módulo:
 *  1. canal PUBLIC é visível para qualquer membro ativo do tenant;
 *  2. canal PRIVATE/DIRECT exige ser membro do canal — checado no servidor,
 *     em toda leitura e escrita, nunca só na listagem.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, scoped, scopedId } from '@/lib/db/tenant';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import { publish } from '@/lib/realtime/bus';
import { buildPage, cursorArgs } from '@/lib/http/pagination';
import { uniqueSlug } from '@/lib/utils/slug';
import { notify } from './notifications.service';
import type { AuthContext } from '@/lib/auth/context';
import type { ChannelKind } from '@/generated/prisma/enums';

/** Verifica se o usuário pode ler/escrever no canal. Lança se não puder. */
export async function assertChannelAccess(ctx: AuthContext, channelId: string) {
  const channel = await prisma.channel.findFirst({
    where: scopedId(ctx, channelId),
    select: {
      id: true, kind: true, name: true, slug: true, topic: true, isArchived: true, projectId: true,
      members: { where: { membershipId: ctx.membershipId }, select: { id: true, isAdmin: true, lastReadAt: true } },
    },
  });

  if (!channel) throw new NotFoundError('Canal não encontrado.');

  const isMember = channel.members.length > 0;
  if (!isMember && channel.kind !== 'PUBLIC') {
    // 404 em vez de 403: não confirmamos a existência de canais privados.
    throw new NotFoundError('Canal não encontrado.');
  }

  return { channel, isMember, isAdmin: channel.members[0]?.isAdmin ?? false };
}

export async function listChannels(ctx: AuthContext) {
  assertPermission(ctx, 'channels.view');

  const channels = await prisma.channel.findMany({
    where: {
      ...scoped(ctx),
      isArchived: false,
      // Públicos para todos; privados e diretas apenas para quem participa.
      OR: [{ kind: 'PUBLIC' }, { members: { some: { membershipId: ctx.membershipId } } }],
    },
    orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
    select: {
      id: true, name: true, slug: true, topic: true, kind: true, lastMessageAt: true, projectId: true,
      members: {
        where: { membershipId: ctx.membershipId },
        select: { lastReadAt: true, isMuted: true, isPinned: true },
      },
      _count: { select: { members: true } },
    },
  });

  // Não lidas por canal, em uma query agregada por canal (não N+1 por mensagem).
  // Os canais já vieram filtrados por `scoped(ctx)`, então contar por
  // `channel.id` permanece dentro do tenant.
  const unreadCounts = await Promise.all(
    channels.map(async (channel) => {
      const lastReadAt = channel.members[0]?.lastReadAt;
      const count = await prisma.message.count({
        where: {
          channelId: channel.id,
          deletedAt: null,
          authorId: { not: ctx.membershipId },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      });
      return [channel.id, count] as const;
    }),
  );
  const unreadByChannel = new Map(unreadCounts);

  // Conversas diretas mostram o nome de quem está do outro lado.
  const directIds = channels.filter((c) => c.kind === 'DIRECT' || c.kind === 'GROUP_DM').map((c) => c.id);
  const directMembers = directIds.length
    ? await prisma.channelMember.findMany({
        where: { channelId: { in: directIds }, membershipId: { not: ctx.membershipId } },
        select: {
          channelId: true,
          membership: { select: { id: true, presence: true, user: { select: { name: true, avatarUrl: true } } } },
        },
      })
    : [];

  const peersByChannel = new Map<string, typeof directMembers>();
  for (const member of directMembers) {
    const list = peersByChannel.get(member.channelId) ?? [];
    list.push(member);
    peersByChannel.set(member.channelId, list);
  }

  return channels.map((channel) => {
    const peers = peersByChannel.get(channel.id) ?? [];
    const displayName =
      channel.kind === 'DIRECT'
        ? (peers[0]?.membership.user.name ?? 'Conversa')
        : channel.kind === 'GROUP_DM'
          ? peers.map((p) => p.membership.user.name.split(' ')[0]).join(', ') || 'Grupo'
          : channel.name;

    return {
      id: channel.id,
      name: channel.name,
      displayName,
      slug: channel.slug,
      topic: channel.topic,
      kind: channel.kind,
      lastMessageAt: channel.lastMessageAt,
      projectId: channel.projectId,
      memberCount: channel._count.members,
      unread: unreadByChannel.get(channel.id) ?? 0,
      isMuted: channel.members[0]?.isMuted ?? false,
      isPinned: channel.members[0]?.isPinned ?? false,
      peers: peers.map((p) => ({
        id: p.membership.id,
        name: p.membership.user.name,
        avatarUrl: p.membership.user.avatarUrl,
        presence: p.membership.presence,
      })),
    };
  });
}

export interface CreateChannelInput {
  name: string;
  topic?: string;
  description?: string;
  kind?: 'PUBLIC' | 'PRIVATE';
  memberIds?: string[];
  projectId?: string | null;
}

export async function createChannel(ctx: AuthContext, input: CreateChannelInput) {
  assertPermission(ctx, 'channels.create');

  const slug = await uniqueSlug(input.name, async (candidate) => {
    const existing = await prisma.channel.findUnique({
      where: { companyId_slug: { companyId: ctx.companyId, slug: candidate } },
      select: { id: true },
    });
    return existing !== null;
  }, 'canal');

  const channel = await prisma.channel.create({
    data: {
      companyId: ctx.companyId,
      name: slug,
      slug,
      topic: input.topic || null,
      description: input.description || null,
      kind: (input.kind ?? 'PUBLIC') as ChannelKind,
      projectId: input.projectId ?? null,
    },
  });

  const memberIds = new Set([ctx.membershipId, ...(input.memberIds ?? [])]);

  // Canal público: todo mundo entra, senão ninguém vê o conteúdo novo.
  if (channel.kind === 'PUBLIC') {
    const everyone = await prisma.membership.findMany({
      where: { companyId: ctx.companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    for (const member of everyone) memberIds.add(member.id);
  }

  await prisma.channelMember.createMany({
    data: Array.from(memberIds).map((membershipId) => ({
      channelId: channel.id,
      membershipId,
      isAdmin: membershipId === ctx.membershipId,
    })),
    skipDuplicates: true,
  });

  return channel;
}

/** Abre (ou reaproveita) a conversa direta com uma ou mais pessoas. */
export async function openDirectChannel(ctx: AuthContext, membershipIds: string[]) {
  const participants = Array.from(new Set([ctx.membershipId, ...membershipIds]));

  const valid = await prisma.membership.count({
    where: { id: { in: participants }, companyId: ctx.companyId, status: 'ACTIVE' },
  });
  if (valid !== participants.length) throw new NotFoundError('Participante não encontrado.');

  const kind: ChannelKind = participants.length === 2 ? 'DIRECT' : 'GROUP_DM';

  // Procura uma conversa existente EXATAMENTE com esse conjunto de pessoas.
  const candidates = await prisma.channel.findMany({
    where: {
      companyId: ctx.companyId,
      kind,
      members: { every: { membershipId: { in: participants } } },
    },
    select: { id: true, _count: { select: { members: true } } },
  });

  const existing = candidates.find((c) => c._count.members === participants.length);
  if (existing) return { id: existing.id, created: false };

  const slug = `dm-${participants.slice().sort().join('-').slice(0, 50)}-${Date.now().toString(36)}`;

  const channel = await prisma.channel.create({
    data: {
      companyId: ctx.companyId,
      name: 'Conversa direta',
      slug,
      kind,
      members: {
        create: participants.map((membershipId) => ({ membershipId })),
      },
    },
  });

  return { id: channel.id, created: true };
}

export async function listMessages(
  ctx: AuthContext,
  channelId: string,
  options: { cursor?: string; limit?: number; parentId?: string | null } = {},
) {
  await assertChannelAccess(ctx, channelId);
  const limit = options.limit ?? 40;

  const rows = await prisma.message.findMany({
    where: {
      companyId: ctx.companyId,
      channelId,
      deletedAt: null,
      // Thread: quando parentId é informado buscamos as respostas daquela raiz.
      parentId: options.parentId === undefined ? null : options.parentId,
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...cursorArgs(options.cursor),
    select: {
      id: true, body: true, kind: true, createdAt: true, isEdited: true, isPinned: true,
      editedAt: true, parentId: true, replyCount: true, mentions: true, mentionsEveryone: true,
      linkedTaskId: true,
      author: {
        select: { id: true, user: { select: { name: true, avatarUrl: true } }, role: { select: { name: true, color: true } } },
      },
      reactions: { select: { emoji: true, membershipId: true } },
      attachments: { select: { id: true, name: true, mimeType: true, sizeBytes: true, category: true } },
      linkedTask: { select: { id: true, title: true, status: true } },
    },
  });

  const page = buildPage(rows, limit);

  // Agrupa reações por emoji e marca se o usuário atual reagiu.
  const items = page.items.map((message) => {
    const grouped = new Map<string, { emoji: string; count: number; reacted: boolean }>();
    for (const reaction of message.reactions) {
      const entry = grouped.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, reacted: false };
      entry.count++;
      if (reaction.membershipId === ctx.membershipId) entry.reacted = true;
      grouped.set(reaction.emoji, entry);
    }
    return { ...message, reactions: Array.from(grouped.values()) };
  });

  // A UI renderiza do mais antigo para o mais recente.
  return { ...page, items: items.reverse() };
}

export interface SendMessageInput {
  channelId: string;
  body: string;
  parentId?: string | null;
  mentions?: string[];
  mentionsEveryone?: boolean;
  fileIds?: string[];
}

export async function sendMessage(ctx: AuthContext, input: SendMessageInput) {
  assertPermission(ctx, 'messages.send');
  const { channel, isMember } = await assertChannelAccess(ctx, input.channelId);

  if (channel.isArchived) throw new ValidationError('Este canal está arquivado.');

  // Entrar automaticamente ao escrever em canal público evita um passo inútil.
  if (!isMember && channel.kind === 'PUBLIC') {
    await prisma.channelMember.create({ data: { channelId: channel.id, membershipId: ctx.membershipId } });
  }

  if (input.parentId) {
    const parent = await prisma.message.findFirst({
      where: { id: input.parentId, channelId: input.channelId, companyId: ctx.companyId },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new NotFoundError('Mensagem original não encontrada.');
    if (parent.parentId) throw new ValidationError('Responda à mensagem principal da thread.');
  }

  // Só aceitamos menções a pessoas ativas do próprio tenant.
  const mentions = input.mentions?.length
    ? (
        await prisma.membership.findMany({
          where: { id: { in: input.mentions }, companyId: ctx.companyId, status: 'ACTIVE' },
          select: { id: true },
        })
      ).map((m) => m.id)
    : [];

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        companyId: ctx.companyId,
        channelId: input.channelId,
        authorId: ctx.membershipId,
        body: input.body,
        parentId: input.parentId ?? null,
        mentions,
        mentionsEveryone: input.mentionsEveryone ?? false,
      },
      select: {
        id: true, body: true, createdAt: true, parentId: true, mentions: true, kind: true,
        author: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
      },
    });

    if (input.fileIds?.length) {
      await tx.fileObject.updateMany({
        where: { id: { in: input.fileIds }, companyId: ctx.companyId, ownerId: ctx.membershipId },
        data: { messageId: created.id },
      });
    }

    if (input.parentId) {
      await tx.message.update({ where: { id: input.parentId }, data: { replyCount: { increment: 1 } } });
    }

    await tx.channel.update({ where: { id: input.channelId }, data: { lastMessageAt: created.createdAt } });
    await tx.channelMember.updateMany({
      where: { channelId: input.channelId, membershipId: ctx.membershipId },
      data: { lastReadAt: created.createdAt, lastReadMessageId: created.id },
    });

    return created;
  });

  publish('message.created', ctx.companyId, {
    id: message.id,
    channelId: input.channelId,
    parentId: message.parentId,
    body: message.body,
    author: { id: message.author.id, name: message.author.user.name, avatarUrl: message.author.user.avatarUrl },
    createdAt: message.createdAt,
  }, input.channelId);

  await notifyMentions(ctx, channel, message.id, input.body, mentions, input.mentionsEveryone ?? false);

  return message;
}

async function notifyMentions(
  ctx: AuthContext,
  channel: { id: string; name: string; kind: ChannelKind },
  messageId: string,
  body: string,
  mentions: string[],
  everyone: boolean,
): Promise<void> {
  const recipients = new Set(mentions);

  if (everyone) {
    // @everyone só faz sentido para quem realmente está no canal.
    const members = await prisma.channelMember.findMany({
      where: { channelId: channel.id, isMuted: false },
      select: { membershipId: true },
    });
    for (const member of members) recipients.add(member.membershipId);
  }

  if (channel.kind === 'DIRECT' || channel.kind === 'GROUP_DM') {
    const members = await prisma.channelMember.findMany({
      where: { channelId: channel.id, isMuted: false },
      select: { membershipId: true },
    });
    for (const member of members) recipients.add(member.membershipId);
  }

  if (recipients.size === 0) return;

  const isDirect = channel.kind === 'DIRECT' || channel.kind === 'GROUP_DM';

  await notify({
    companyId: ctx.companyId,
    recipientIds: Array.from(recipients),
    actorId: ctx.membershipId,
    kind: isDirect && mentions.length === 0 ? 'MESSAGE' : 'MENTION',
    title: isDirect ? `Nova mensagem de ${ctx.user.name}` : `${ctx.user.name} mencionou você em #${channel.name}`,
    body: body.slice(0, 160),
    href: `/mensagens/${channel.id}`,
    entityType: 'message',
    entityId: messageId,
  });
}

export async function updateMessage(ctx: AuthContext, messageId: string, body: string) {
  const message = await prisma.message.findFirst({
    where: scopedId(ctx, messageId),
    select: { id: true, authorId: true, channelId: true, deletedAt: true },
  });
  if (!message || message.deletedAt) throw new NotFoundError('Mensagem não encontrada.');

  // Editar mensagem é direito exclusivo do autor. Nem moderador reescreve fala alheia.
  if (message.authorId !== ctx.membershipId) {
    throw new ForbiddenError('Você só pode editar suas próprias mensagens.');
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { body, isEdited: true, editedAt: new Date() },
    select: { id: true, body: true, editedAt: true, channelId: true },
  });

  publish('message.updated', ctx.companyId, updated, message.channelId);
  return updated;
}

export async function deleteMessage(ctx: AuthContext, messageId: string): Promise<void> {
  const message = await prisma.message.findFirst({
    where: scopedId(ctx, messageId),
    select: { id: true, authorId: true, channelId: true, parentId: true },
  });
  if (!message) throw new NotFoundError('Mensagem não encontrada.');

  // Autor apaga a própria; apagar a de outro exige moderação.
  if (message.authorId !== ctx.membershipId) assertPermission(ctx, 'messages.moderate');

  await prisma.$transaction(async (tx) => {
    await tx.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: '', richContent: undefined },
    });
    if (message.parentId) {
      await tx.message.update({ where: { id: message.parentId }, data: { replyCount: { decrement: 1 } } });
    }
  });

  publish('message.deleted', ctx.companyId, { id: messageId, channelId: message.channelId }, message.channelId);
}

export async function toggleReaction(ctx: AuthContext, messageId: string, emoji: string) {
  const message = await prisma.message.findFirst({
    where: scopedId(ctx, messageId),
    select: { id: true, channelId: true },
  });
  if (!message) throw new NotFoundError('Mensagem não encontrada.');
  await assertChannelAccess(ctx, message.channelId);

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_membershipId_emoji: { messageId, membershipId: ctx.membershipId, emoji } },
    select: { id: true },
  });

  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({ data: { messageId, membershipId: ctx.membershipId, emoji } });
  }

  publish('message.reaction', ctx.companyId, { messageId, emoji, added: !existing }, message.channelId);
  return { added: !existing };
}

export async function togglePin(ctx: AuthContext, messageId: string) {
  assertPermission(ctx, 'channels.manage');

  const message = await prisma.message.findFirst({ where: scopedId(ctx, messageId), select: { id: true, isPinned: true, channelId: true } });
  if (!message) throw new NotFoundError('Mensagem não encontrada.');

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { isPinned: !message.isPinned },
    select: { id: true, isPinned: true },
  });

  publish('message.updated', ctx.companyId, updated, message.channelId);
  return updated;
}

export async function markChannelRead(ctx: AuthContext, channelId: string): Promise<void> {
  await assertChannelAccess(ctx, channelId);

  await prisma.channelMember.updateMany({
    where: { channelId, membershipId: ctx.membershipId },
    data: { lastReadAt: new Date() },
  });
}

export async function getChannelMembers(ctx: AuthContext, channelId: string) {
  await assertChannelAccess(ctx, channelId);

  return prisma.channelMember.findMany({
    where: { channelId },
    orderBy: { membership: { user: { name: 'asc' } } },
    select: {
      isAdmin: true,
      membership: {
        select: {
          id: true, presence: true,
          user: { select: { name: true, avatarUrl: true, email: true } },
          role: { select: { name: true, color: true } },
        },
      },
    },
  });
}

/** Total de mensagens não lidas — alimenta o badge global da sidebar. */
export async function countUnreadMessages(ctx: AuthContext): Promise<number> {
  const memberships = await prisma.channelMember.findMany({
    where: { membershipId: ctx.membershipId, isMuted: false, channel: { companyId: ctx.companyId, isArchived: false } },
    select: { channelId: true, lastReadAt: true },
  });

  if (memberships.length === 0) return 0;

  const counts = await Promise.all(
    memberships.map((member) =>
      prisma.message.count({
        where: {
          channelId: member.channelId,
          deletedAt: null,
          authorId: { not: ctx.membershipId },
          ...(member.lastReadAt ? { createdAt: { gt: member.lastReadAt } } : {}),
        },
      }),
    ),
  );

  return counts.reduce((total, count) => total + count, 0);
}
