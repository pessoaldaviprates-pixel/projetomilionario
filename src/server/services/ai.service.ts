/**
 * Assistente de IA e sugestões automáticas.
 *
 * Duas garantias inegociáveis:
 *
 *  1. A IA só enxerga o que o usuário enxerga. Todo dado usado como contexto é
 *     buscado com o `AuthContext` da pessoa e filtrado por tenant e permissão.
 *     Não existe caminho em que o assistente leia algo que o usuário não
 *     poderia abrir na interface.
 *
 *  2. A IA nunca escreve sozinha. Ela cria `AiAction` com status SUGGESTED;
 *     a escrita só acontece quando uma pessoa aceita explicitamente.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, scoped, scopedId } from '@/lib/db/tenant';
import { NotFoundError, ValidationError } from '@/lib/http/errors';
import { aiProvider } from '@/lib/ai/provider';
import type { ExtractedAction } from '@/lib/ai/extraction';
import { requireEntitlement } from '@/lib/billing/subscription';
import { auditFromContext } from '@/lib/audit';
import { formatDateTime, formatShortDate } from '@/lib/utils/format';
import { createTask } from './tasks.service';
import type { AuthContext } from '@/lib/auth/context';
import type { AiActionKind } from '@/generated/prisma/enums';

// ── Sugestões a partir de texto (chat, notas) ───────────────────────────────

export async function suggestFromText(
  ctx: AuthContext,
  text: string,
  source: { type: 'message' | 'meeting' | 'manual'; id?: string },
) {
  await requireEntitlement(ctx.companyId, 'ai.suggestions');
  assertPermission(ctx, 'ai.use');

  const people = await prisma.membership.findMany({
    where: { ...scoped(ctx), status: 'ACTIVE' },
    select: { id: true, user: { select: { name: true } } },
  });

  const actions = await aiProvider.suggestFromText(
    text,
    people.map((p) => ({ id: p.id, name: p.user.name })),
  );

  if (actions.length === 0) return [];

  const created = await Promise.all(
    actions.map((action) =>
      prisma.aiAction.create({
        data: {
          companyId: ctx.companyId,
          membershipId: ctx.membershipId,
          kind: toActionKind(action.kind),
          status: 'SUGGESTED',
          payload: serializeAction(action) as never,
          rationale: action.rationale,
          confidence: action.confidence,
          sourceType: source.type,
          sourceId: source.id ?? null,
        },
        select: { id: true, kind: true, payload: true, rationale: true, confidence: true, createdAt: true },
      }),
    ),
  );

  return created;
}

function toActionKind(kind: ExtractedAction['kind']): AiActionKind {
  switch (kind) {
    case 'CREATE_MEETING':
      return 'CREATE_MEETING';
    case 'CREATE_REMINDER':
      return 'CREATE_REMINDER';
    default:
      return 'CREATE_TASK';
  }
}

function serializeAction(action: ExtractedAction) {
  return {
    title: action.title,
    assigneeId: action.assigneeId,
    assigneeHint: action.assigneeHint,
    dueAt: action.dueAt ? action.dueAt.toISOString() : null,
    dueHint: action.dueHint,
    priority: action.priority,
  };
}

export async function listPendingActions(ctx: AuthContext, limit = 20) {
  return prisma.aiAction.findMany({
    where: { ...scoped(ctx), membershipId: ctx.membershipId, status: 'SUGGESTED' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true, kind: true, payload: true, rationale: true, confidence: true,
      sourceType: true, sourceId: true, createdAt: true,
    },
  });
}

export interface ActionOverrides {
  title?: string;
  assigneeId?: string | null;
  dueAt?: Date | null;
  projectId?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

/** Aceita uma sugestão: é aqui — e só aqui — que a IA vira escrita no banco. */
export async function acceptAction(ctx: AuthContext, actionId: string, overrides?: ActionOverrides) {
  const action = await prisma.aiAction.findFirst({
    where: { ...scopedId(ctx, actionId), membershipId: ctx.membershipId },
  });
  if (!action) throw new NotFoundError('Sugestão não encontrada.');
  if (action.status !== 'SUGGESTED') throw new ValidationError('Esta sugestão já foi tratada.');

  const payload = action.payload as {
    title: string;
    assigneeId: string | null;
    dueAt: string | null;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  };

  if (action.kind !== 'CREATE_TASK' && action.kind !== 'CREATE_REMINDER') {
    throw new ValidationError('Este tipo de sugestão ainda não pode ser aplicado automaticamente.');
  }

  const task = await createTask(ctx, {
    title: overrides?.title ?? payload.title,
    assigneeId: overrides?.assigneeId !== undefined ? overrides.assigneeId : (payload.assigneeId ?? ctx.membershipId),
    dueAt: overrides?.dueAt !== undefined ? overrides.dueAt : payload.dueAt ? new Date(payload.dueAt) : null,
    projectId: overrides?.projectId ?? null,
    priority: overrides?.priority ?? payload.priority,
    origin: 'AI',
    originRefId: action.sourceId,
  });

  await prisma.aiAction.update({
    where: { id: actionId },
    data: { status: 'ACCEPTED', decidedAt: new Date(), resultType: 'task', resultId: task.id },
  });

  // Fecha o ciclo: a mensagem que originou a sugestão passa a apontar para a tarefa.
  if (action.sourceType === 'message' && action.sourceId) {
    await prisma.message
      .updateMany({
        where: { id: action.sourceId, companyId: ctx.companyId },
        data: { linkedTaskId: task.id },
      })
      .catch(() => undefined);
  }

  await auditFromContext(ctx, {
    action: 'ai.action_accepted',
    entityType: 'ai_action',
    entityId: actionId,
    metadata: { taskId: task.id, kind: action.kind },
  });

  return task;
}

export async function dismissAction(ctx: AuthContext, actionId: string): Promise<void> {
  const action = await prisma.aiAction.findFirst({
    where: { ...scopedId(ctx, actionId), membershipId: ctx.membershipId },
    select: { id: true, status: true },
  });
  if (!action) throw new NotFoundError('Sugestão não encontrada.');

  await prisma.aiAction.update({
    where: { id: actionId },
    data: { status: 'DISMISSED', decidedAt: new Date() },
  });

  await auditFromContext(ctx, { action: 'ai.action_dismissed', entityType: 'ai_action', entityId: actionId });
}

// ── Assistente conversacional ───────────────────────────────────────────────

export async function ask(ctx: AuthContext, question: string, threadId?: string) {
  await requireEntitlement(ctx.companyId, 'ai.assistant');
  assertPermission(ctx, 'ai.use');

  const thread = threadId
    ? await prisma.aiThread.findFirst({
        where: { ...scopedId(ctx, threadId), membershipId: ctx.membershipId },
        select: { id: true },
      })
    : await prisma.aiThread.create({
        data: {
          companyId: ctx.companyId,
          membershipId: ctx.membershipId,
          title: question.slice(0, 60),
        },
        select: { id: true },
      });

  if (!thread) throw new NotFoundError('Conversa não encontrada.');

  const history = await prisma.aiMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { role: true, content: true },
  });

  await prisma.aiMessage.create({
    data: { threadId: thread.id, role: 'USER', content: question },
  });

  // Recuperação de contexto respeitando as permissões do usuário.
  const { context, sources } = await buildContext(ctx, question);

  const result = await aiProvider.answer({
    question,
    context,
    history: history.map((m) => ({ role: m.role === 'ASSISTANT' ? 'ASSISTANT' : 'USER', content: m.content })),
  });

  const answer = await prisma.aiMessage.create({
    data: {
      threadId: thread.id,
      role: 'ASSISTANT',
      content: result.content,
      metadata: { model: result.model, sources } as never,
    },
    select: { id: true, content: true, createdAt: true, metadata: true },
  });

  await prisma.aiThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });

  return { threadId: thread.id, message: answer, sources };
}

interface ContextResult {
  context: string;
  sources: { type: string; id: string; label: string }[];
}

/**
 * Monta o contexto da pergunta a partir dos dados do tenant.
 *
 * Cada bloco só é incluído se o usuário tiver a permissão de leitura
 * correspondente — a IA herda exatamente o alcance da pessoa.
 */
async function buildContext(ctx: AuthContext, question: string): Promise<ContextResult> {
  const normalized = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  const blocks: string[] = [];
  const sources: { type: string; id: string; label: string }[] = [];

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
  const weekAhead = new Date(startOfDay.getTime() + 7 * 86_400_000);

  const wantsTasks = /tarefa|pendente|atrasad|fazer|to-?do|prazo|entrega/.test(normalized);
  const wantsMeetings = /reuni|call|agenda|compromisso|encontro/.test(normalized);
  const wantsProjects = /projeto|andamento|progresso/.test(normalized);
  const wantsToday = /hoje|agora|dia/.test(normalized);
  const wantsOverdue = /atrasad|vencid|estourad/.test(normalized);
  const generic = !wantsTasks && !wantsMeetings && !wantsProjects;

  if ((wantsTasks || wantsToday || generic) && ctx.can('tasks.view')) {
    const tasks = await prisma.task.findMany({
      where: {
        ...scoped(ctx),
        deletedAt: null,
        assigneeId: ctx.membershipId,
        status: { in: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
        ...(wantsOverdue ? { dueAt: { lt: startOfDay } } : wantsToday ? { dueAt: { lt: endOfDay } } : {}),
      },
      orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }],
      take: 15,
      select: {
        id: true, title: true, status: true, priority: true, dueAt: true,
        project: { select: { name: true } },
      },
    });

    if (tasks.length > 0) {
      blocks.push(
        `MINHAS TAREFAS ABERTAS (${tasks.length}):\n` +
          tasks
            .map((task) => {
              const due = task.dueAt ? `prazo ${formatShortDate(task.dueAt)}` : 'sem prazo';
              const overdue = task.dueAt && task.dueAt < startOfDay ? ' [ATRASADA]' : '';
              const project = task.project ? ` · projeto ${task.project.name}` : '';
              return `- ${task.title} (${task.status}, prioridade ${task.priority}, ${due}${overdue}${project})`;
            })
            .join('\n'),
      );
      for (const task of tasks.slice(0, 5)) {
        sources.push({ type: 'task', id: task.id, label: task.title });
      }
    } else {
      blocks.push('MINHAS TAREFAS ABERTAS: nenhuma tarefa aberta atribuída a você.');
    }
  }

  if ((wantsMeetings || wantsToday || generic) && ctx.can('meetings.view')) {
    const meetings = await prisma.meeting.findMany({
      where: {
        ...scoped(ctx),
        status: { in: ['SCHEDULED', 'LIVE'] },
        startsAt: { gte: now, lte: weekAhead },
        OR: [{ organizerId: ctx.membershipId }, { participants: { some: { membershipId: ctx.membershipId } } }],
      },
      orderBy: { startsAt: 'asc' },
      take: 10,
      select: {
        id: true, title: true, startsAt: true, endsAt: true, location: true,
        organizer: { select: { user: { select: { name: true } } } },
        _count: { select: { participants: true } },
      },
    });

    if (meetings.length > 0) {
      blocks.push(
        `MINHAS PRÓXIMAS REUNIÕES (${meetings.length}):\n` +
          meetings
            .map(
              (meeting) =>
                `- ${meeting.title} em ${formatDateTime(meeting.startsAt)} · organizada por ${meeting.organizer.user.name} · ${meeting._count.participants} participantes`,
            )
            .join('\n'),
      );
      for (const meeting of meetings.slice(0, 5)) {
        sources.push({ type: 'meeting', id: meeting.id, label: meeting.title });
      }
    } else {
      blocks.push('MINHAS PRÓXIMAS REUNIÕES: nenhuma reunião agendada para os próximos 7 dias.');
    }
  }

  if ((wantsProjects || generic) && ctx.can('projects.view')) {
    const projects = await prisma.project.findMany({
      where: { ...scoped(ctx), archivedAt: null, status: { in: ['ACTIVE', 'PLANNING'] } },
      orderBy: { dueAt: { sort: 'asc', nulls: 'last' } },
      take: 10,
      select: {
        id: true, name: true, status: true, progress: true, dueAt: true,
        lead: { select: { user: { select: { name: true } } } },
        _count: { select: { tasks: true } },
      },
    });

    if (projects.length > 0) {
      blocks.push(
        `PROJETOS EM ANDAMENTO (${projects.length}):\n` +
          projects
            .map(
              (project) =>
                `- ${project.name}: ${project.progress}% concluído, ${project._count.tasks} tarefas${project.dueAt ? `, prazo ${formatShortDate(project.dueAt)}` : ''}${project.lead ? `, responsável ${project.lead.user.name}` : ''}`,
            )
            .join('\n'),
      );
      for (const project of projects.slice(0, 5)) {
        sources.push({ type: 'project', id: project.id, label: project.name });
      }
    }
  }

  // Decisões de reuniões recentes — responde "o que ficou decidido ontem?".
  if (/decis|ficou decidido|ata|resumo/.test(normalized) && ctx.can('meetings.view')) {
    const notes = await prisma.meetingNote.findMany({
      where: {
        kind: { in: ['SUMMARY', 'DECISIONS'] },
        meeting: {
          companyId: ctx.companyId,
          OR: [{ organizerId: ctx.membershipId }, { participants: { some: { membershipId: ctx.membershipId } } }],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { kind: true, content: true, meeting: { select: { id: true, title: true, startsAt: true } } },
    });

    if (notes.length > 0) {
      blocks.push(
        'REUNIÕES RECENTES (resumos e decisões):\n' +
          notes
            .map((note) => `- [${note.meeting.title} · ${formatShortDate(note.meeting.startsAt)}] ${note.kind}: ${note.content.slice(0, 600)}`)
            .join('\n'),
      );
      for (const note of notes.slice(0, 3)) {
        sources.push({ type: 'meeting', id: note.meeting.id, label: note.meeting.title });
      }
    }
  }

  blocks.push(
    `CONTEXTO DO USUÁRIO: ${ctx.user.name}, cargo ${ctx.role.name} na empresa ${ctx.company.name}. Data de hoje: ${formatDateTime(now)}.`,
  );

  return { context: blocks.join('\n\n'), sources };
}

export async function listThreads(ctx: AuthContext) {
  return prisma.aiThread.findMany({
    where: { ...scoped(ctx), membershipId: ctx.membershipId },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: { id: true, title: true, updatedAt: true, _count: { select: { messages: true } } },
  });
}

export async function getThread(ctx: AuthContext, threadId: string) {
  const thread = await prisma.aiThread.findFirst({
    where: { ...scopedId(ctx, threadId), membershipId: ctx.membershipId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!thread) throw new NotFoundError('Conversa não encontrada.');
  return thread;
}

export async function deleteThread(ctx: AuthContext, threadId: string): Promise<void> {
  await prisma.aiThread.deleteMany({
    where: { id: threadId, companyId: ctx.companyId, membershipId: ctx.membershipId },
  });
}
