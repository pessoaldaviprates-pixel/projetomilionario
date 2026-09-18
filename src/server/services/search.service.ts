/**
 * Busca global.
 *
 * Toda consulta é escopada ao tenant e à permissão do usuário: o resultado de
 * uma busca nunca revela a existência de algo que a pessoa não poderia abrir.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { scoped } from '@/lib/db/tenant';
import type { AuthContext } from '@/lib/auth/context';

export type SearchType = 'people' | 'tasks' | 'projects' | 'meetings' | 'files' | 'messages' | 'announcements';

export interface SearchHit {
  type: SearchType;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  meta?: string;
}

export async function globalSearch(
  ctx: AuthContext,
  query: string,
  options: { types?: SearchType[]; limit?: number } = {},
): Promise<SearchHit[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const limit = options.limit ?? 20;
  const perType = Math.max(3, Math.ceil(limit / 3));
  const wanted = (type: SearchType) => !options.types?.length || options.types.includes(type);
  const contains = { contains: term, mode: 'insensitive' as const };

  const tasks: Promise<SearchHit[]>[] = [];

  if (wanted('people') && ctx.can('users.view')) {
    tasks.push(
      prisma.membership
        .findMany({
          where: {
            ...scoped(ctx),
            status: 'ACTIVE',
            OR: [{ user: { name: contains } }, { user: { email: contains } }, { jobTitle: contains }],
          },
          take: perType,
          select: {
            id: true, jobTitle: true,
            user: { select: { name: true, email: true } },
            role: { select: { name: true } },
          },
        })
        .then((rows) =>
          rows.map((row) => ({
            type: 'people' as const,
            id: row.id,
            title: row.user.name,
            subtitle: row.jobTitle ?? row.role.name,
            href: `/funcionarios/${row.id}`,
            meta: row.user.email,
          })),
        ),
    );
  }

  if (wanted('tasks') && ctx.can('tasks.view')) {
    tasks.push(
      prisma.task
        .findMany({
          where: { ...scoped(ctx), deletedAt: null, OR: [{ title: contains }, { description: contains }] },
          orderBy: { updatedAt: 'desc' },
          take: perType,
          select: {
            id: true, title: true, status: true,
            project: { select: { name: true } },
            assignee: { select: { user: { select: { name: true } } } },
          },
        })
        .then((rows) =>
          rows.map((row) => ({
            type: 'tasks' as const,
            id: row.id,
            title: row.title,
            subtitle: row.project?.name ?? 'Sem projeto',
            href: `/tarefas/${row.id}`,
            meta: row.assignee?.user.name ?? 'Sem responsável',
          })),
        ),
    );
  }

  if (wanted('projects') && ctx.can('projects.view')) {
    tasks.push(
      prisma.project
        .findMany({
          where: { ...scoped(ctx), archivedAt: null, OR: [{ name: contains }, { description: contains }, { key: contains }] },
          take: perType,
          select: { id: true, name: true, key: true, progress: true, status: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            type: 'projects' as const,
            id: row.id,
            title: row.name,
            subtitle: `${row.key} · ${row.progress}% concluído`,
            href: `/projetos/${row.id}`,
          })),
        ),
    );
  }

  if (wanted('meetings') && ctx.can('meetings.view')) {
    tasks.push(
      prisma.meeting
        .findMany({
          where: { ...scoped(ctx), OR: [{ title: contains }, { description: contains }, { agenda: contains }] },
          orderBy: { startsAt: 'desc' },
          take: perType,
          select: { id: true, title: true, startsAt: true, status: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            type: 'meetings' as const,
            id: row.id,
            title: row.title,
            subtitle: row.startsAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
            href: `/reunioes/${row.id}`,
          })),
        ),
    );
  }

  if (wanted('files') && ctx.can('files.view')) {
    tasks.push(
      prisma.fileObject
        .findMany({
          where: {
            ...scoped(ctx),
            deletedAt: null,
            name: contains,
            OR: [{ visibility: { not: 'PRIVATE' } }, { ownerId: ctx.membershipId }],
          },
          orderBy: { createdAt: 'desc' },
          take: perType,
          select: { id: true, name: true, category: true, owner: { select: { user: { select: { name: true } } } } },
        })
        .then((rows) =>
          rows.map((row) => ({
            type: 'files' as const,
            id: row.id,
            title: row.name,
            subtitle: row.owner.user.name,
            href: `/arquivos?destaque=${row.id}`,
          })),
        ),
    );
  }

  if (wanted('messages') && ctx.can('channels.view')) {
    tasks.push(
      prisma.message
        .findMany({
          where: {
            ...scoped(ctx),
            deletedAt: null,
            body: contains,
            // Só mensagens de canais aos quais o usuário tem acesso.
            channel: {
              OR: [{ kind: 'PUBLIC' }, { members: { some: { membershipId: ctx.membershipId } } }],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: perType,
          select: {
            id: true, body: true, createdAt: true,
            channel: { select: { id: true, name: true, kind: true } },
            author: { select: { user: { select: { name: true } } } },
          },
        })
        .then((rows) =>
          rows.map((row) => ({
            type: 'messages' as const,
            id: row.id,
            title: row.body.slice(0, 90),
            subtitle: `${row.author.user.name} · ${row.channel.kind === 'PUBLIC' ? `#${row.channel.name}` : 'conversa'}`,
            href: `/mensagens/${row.channel.id}`,
          })),
        ),
    );
  }

  if (wanted('announcements') && ctx.can('announcements.view')) {
    tasks.push(
      prisma.announcement
        .findMany({
          where: { ...scoped(ctx), publishedAt: { not: null }, OR: [{ title: contains }, { body: contains }] },
          orderBy: { publishedAt: 'desc' },
          take: perType,
          select: { id: true, title: true, severity: true, publishedAt: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            type: 'announcements' as const,
            id: row.id,
            title: row.title,
            subtitle: 'Aviso da empresa',
            href: '/avisos',
          })),
        ),
    );
  }

  const results = await Promise.all(tasks);
  return results.flat().slice(0, limit);
}
