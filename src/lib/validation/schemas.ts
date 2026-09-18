/**
 * Schemas de validação (zod).
 *
 * Fonte única de verdade para a forma dos dados de entrada. Usados tanto nas
 * rotas de API quanto nas Server Actions — nenhum dado chega ao banco sem
 * passar por aqui.
 */
import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password';

// ── Primitivos ──────────────────────────────────────────────────────────────

export const idSchema = z.string().min(1, 'Identificador inválido.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Informe seu e-mail.')
  .email('E-mail inválido.')
  .max(254);

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(128, 'Senha muito longa.')
  .regex(/[a-z]/, 'Inclua ao menos uma letra minúscula.')
  .regex(/[A-Z]/, 'Inclua ao menos uma letra maiúscula.')
  .regex(/[0-9]/, 'Inclua ao menos um número.');

export const nameSchema = z.string().trim().min(2, 'Informe um nome válido.').max(120);

/** Texto livre com limite — evita payloads absurdos e DoS por memória. */
export const richTextSchema = z.string().trim().max(20_000);

const optionalDate = z
  .union([z.string().datetime({ offset: true }), z.string().length(0), z.null()])
  .optional()
  .transform((value) => (value ? new Date(value) : null));

// ── Autenticação ────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { message: 'É necessário aceitar os termos de uso.' }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.'),
  remember: z.boolean().optional().default(true),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token inválido.'),
  password: passwordSchema,
});

// ── Empresa e onboarding ────────────────────────────────────────────────────

export const companySizeSchema = z.enum(['SOLO', 'MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']);

export const createCompanySchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da empresa.').max(120),
  segment: z.string().trim().max(80).optional(),
  sizeBand: companySizeSchema.optional(),
  goal: z.string().trim().max(200).optional(),
  website: z.string().trim().url('URL inválida.').max(200).optional().or(z.literal('')),
  logoUrl: z.string().trim().max(500).optional().or(z.literal('')),
});

export const updateCompanySchema = createCompanySchema.partial();

export const inviteMembersSchema = z.object({
  invites: z
    .array(
      z.object({
        email: emailSchema,
        roleId: idSchema.optional(),
        departmentId: idSchema.optional(),
      }),
    )
    .min(1, 'Informe ao menos um e-mail.')
    .max(50, 'Envie no máximo 50 convites por vez.'),
});

// ── Cargos ──────────────────────────────────────────────────────────────────

export const roleSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cargo.').max(60),
  description: z.string().trim().max(240).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.').default('#2E7DFF'),
  permissions: z.array(z.string()).default([]),
  rank: z.number().int().min(0).max(999).default(100),
  isActive: z.boolean().default(true),
});

export const updateRoleSchema = roleSchema.partial();

export const assignRoleSchema = z.object({
  membershipId: idSchema,
  roleId: idSchema,
});

// ── Pessoas ─────────────────────────────────────────────────────────────────

export const updateMemberSchema = z.object({
  jobTitle: z.string().trim().max(80).nullish(),
  departmentId: idSchema.nullish(),
  managerId: idSchema.nullish(),
  roleId: idSchema.optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
});

// ── Estrutura ───────────────────────────────────────────────────────────────

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2E7DFF'),
  parentId: idSchema.nullish(),
  leadId: idSchema.nullish(),
});

export const groupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2E7DFF'),
  departmentId: idSchema.nullish(),
  isPrivate: z.boolean().default(false),
  memberIds: z.array(idSchema).default([]),
});

// ── Comunicação ─────────────────────────────────────────────────────────────

export const createChannelSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do canal.').max(60),
  topic: z.string().trim().max(160).optional(),
  description: z.string().trim().max(500).optional(),
  kind: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  memberIds: z.array(idSchema).default([]),
  projectId: idSchema.nullish(),
});

export const sendMessageSchema = z.object({
  channelId: idSchema,
  body: z.string().trim().min(1, 'Escreva uma mensagem.').max(8000),
  parentId: idSchema.nullish(),
  mentions: z.array(idSchema).max(100).default([]),
  mentionsEveryone: z.boolean().default(false),
  fileIds: z.array(idSchema).max(10).default([]),
});

export const updateMessageSchema = z.object({
  body: z.string().trim().min(1).max(8000),
});

export const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
});

export const directChannelSchema = z.object({
  membershipIds: z.array(idSchema).min(1).max(20),
});

// ── Projetos e tarefas ──────────────────────────────────────────────────────

export const projectSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do projeto.').max(120),
  key: z.string().trim().regex(/^[A-Za-z0-9]{2,8}$/, 'Use de 2 a 8 letras ou números.').optional(),
  description: z.string().trim().max(2000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2E7DFF'),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELED']).default('ACTIVE'),
  leadId: idSchema.nullish(),
  startsAt: optionalDate,
  dueAt: optionalDate,
  memberIds: z.array(idSchema).default([]),
});

export const updateProjectSchema = projectSchema.partial().omit({ key: true });

export const taskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELED']);
export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, 'Informe o título da tarefa.').max(200),
  description: richTextSchema.optional(),
  status: taskStatusSchema.default('TODO'),
  priority: taskPrioritySchema.default('MEDIUM'),
  projectId: idSchema.nullish(),
  assigneeId: idSchema.nullish(),
  parentId: idSchema.nullish(),
  startsAt: optionalDate,
  dueAt: optionalDate,
  estimateMinutes: z.number().int().min(0).max(100_000).nullish(),
  tags: z.array(z.string().trim().max(30)).max(12).default([]),
  checklist: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  origin: z.enum(['MANUAL', 'MESSAGE', 'MEETING', 'AI', 'AUTOMATION', 'IMPORT']).default('MANUAL'),
  originRefId: idSchema.nullish(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  position: z.number().int().min(0).optional(),
});

export const taskCommentSchema = z.object({
  body: z.string().trim().min(1, 'Escreva um comentário.').max(4000),
});

export const checklistItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  isDone: z.boolean().optional(),
});

// ── Reuniões ────────────────────────────────────────────────────────────────

export const meetingSchema = z
  .object({
    title: z.string().trim().min(2, 'Informe o título da reunião.').max(160),
    description: z.string().trim().max(2000).optional(),
    agenda: z.string().trim().max(4000).optional(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    location: z.string().trim().max(200).optional(),
    roomUrl: z.string().trim().url('URL inválida.').max(500).optional().or(z.literal('')),
    provider: z.enum(['NEXORA', 'GOOGLE_MEET', 'ZOOM', 'TEAMS', 'EXTERNAL']).default('NEXORA'),
    projectId: idSchema.nullish(),
    participantIds: z.array(idSchema).max(200).default([]),
    recurrenceRule: z.string().trim().max(200).nullish(),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'O término deve ser depois do início.',
    path: ['endsAt'],
  });

export const transcriptSchema = z.object({
  transcript: z.string().trim().min(20, 'Transcrição muito curta.').max(200_000),
});

// ── Agenda ──────────────────────────────────────────────────────────────────

export const calendarEventSchema = z
  .object({
    title: z.string().trim().min(1, 'Informe o título.').max(160),
    description: z.string().trim().max(2000).optional(),
    kind: z.enum(['EVENT', 'DEADLINE', 'REMINDER', 'FOCUS', 'OUT_OF_OFFICE']).default('EVENT'),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    allDay: z.boolean().default(false),
    location: z.string().trim().max(200).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    attendeeIds: z.array(idSchema).max(200).default([]),
  })
  .refine((data) => new Date(data.endsAt) >= new Date(data.startsAt), {
    message: 'O término deve ser depois do início.',
    path: ['endsAt'],
  });

export const timeBlockSchema = z
  .object({
    taskId: idSchema.nullish(),
    title: z.string().trim().min(1).max(160),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'O término deve ser depois do início.',
    path: ['endsAt'],
  });

// ── Avisos ──────────────────────────────────────────────────────────────────

export const announcementSchema = z.object({
  title: z.string().trim().min(2, 'Informe o título do aviso.').max(160),
  body: z.string().trim().min(2, 'Escreva o conteúdo do aviso.').max(10_000),
  severity: z.enum(['INFO', 'SUCCESS', 'WARNING', 'CRITICAL']).default('INFO'),
  audience: z.enum(['COMPANY', 'DEPARTMENT', 'GROUP', 'ROLE']).default('COMPANY'),
  departmentId: idSchema.nullish(),
  groupId: idSchema.nullish(),
  roleId: idSchema.nullish(),
  pinned: z.boolean().default(false),
  expiresAt: optionalDate,
});

// ── Billing ─────────────────────────────────────────────────────────────────

export const checkoutSchema = z.object({
  planSlug: z.string().trim().min(1),
  method: z.enum(['CARD', 'PIX', 'BOLETO']),
  /** Token opaco do gateway. Dados do cartão NUNCA chegam ao nosso servidor. */
  paymentToken: z.string().trim().max(500).optional(),
  cardBrand: z.string().trim().max(30).optional(),
  cardLast4: z.string().trim().regex(/^\d{4}$/).optional(),
  taxId: z.string().trim().max(20).optional(),
});

// ── IA ──────────────────────────────────────────────────────────────────────

export const aiAskSchema = z.object({
  question: z.string().trim().min(2, 'Escreva sua pergunta.').max(2000),
  threadId: idSchema.optional(),
});

export const aiSuggestSchema = z.object({
  text: z.string().trim().min(5).max(20_000),
  sourceType: z.enum(['message', 'meeting', 'manual']).default('manual'),
  sourceId: idSchema.optional(),
});

export const aiDecisionSchema = z.object({
  decision: z.enum(['ACCEPT', 'DISMISS']),
  /** Ajustes que o usuário fez antes de aceitar a sugestão. */
  overrides: z
    .object({
      title: z.string().trim().min(2).max(200).optional(),
      assigneeId: idSchema.nullish(),
      dueAt: z.string().datetime({ offset: true }).nullish(),
      projectId: idSchema.nullish(),
      priority: taskPrioritySchema.optional(),
    })
    .optional(),
});

// ── Busca ───────────────────────────────────────────────────────────────────

export const searchSchema = z.object({
  q: z.string().trim().min(2, 'Digite ao menos 2 caracteres.').max(120),
  types: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
