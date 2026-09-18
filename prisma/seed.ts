/**
 * Seed do Nexora.
 *
 * Cria:
 *  1. o catálogo de planos (fonte de verdade passa a ser o banco);
 *  2. uma empresa de demonstração completa, para que a interface possa ser
 *     avaliada com dados realistas desde o primeiro acesso.
 *
 * Idempotente: rodar de novo atualiza em vez de duplicar.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { DEFAULT_ROLE_PRESETS } from '../src/lib/authz/permissions';
import { PLAN_SEEDS } from '../src/lib/billing/entitlements';
import { slugify } from '../src/lib/utils/slug';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_PASSWORD = 'Nexora@2026';
const DEMO_COMPANY_SLUG = 'nexora-demo';

/** Datas relativas a hoje, para a demo nunca parecer desatualizada. */
const now = new Date();
function daysFromNow(days: number, hour = 9, minute = 0): Date {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour, minute, 0, 0);
  return date;
}
function hoursAgo(hours: number): Date {
  return new Date(now.getTime() - hours * 3_600_000);
}

const PEOPLE = [
  { name: 'Prates Gabriel', email: 'gabriel@nexora.app', role: 'ceo', dept: 'Diretoria', title: 'CEO', owner: true },
  { name: 'Lucas Ferreira', email: 'lucas@nexora.app', role: 'cto', dept: 'Tecnologia', title: 'CTO' },
  { name: 'Matheus Lima', email: 'matheus@nexora.app', role: 'cfo', dept: 'Financeiro', title: 'CFO' },
  { name: 'Ana Costa', email: 'ana@nexora.app', role: 'coo', dept: 'Operações', title: 'COO' },
  { name: 'Carla Souza', email: 'carla@nexora.app', role: 'cmo', dept: 'Marketing', title: 'CMO' },
  { name: 'Rafael Alves', email: 'rafael@nexora.app', role: 'desenvolvedor', dept: 'Tecnologia', title: 'Desenvolvedor sênior' },
  { name: 'Juliana Martins', email: 'juliana@nexora.app', role: 'designer', dept: 'Tecnologia', title: 'Product Designer' },
  { name: 'Bruno Rocha', email: 'bruno@nexora.app', role: 'suporte', dept: 'Operações', title: 'Analista de suporte' },
] as const;

async function seedPlans(): Promise<void> {
  for (const plan of PLAN_SEEDS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: {
        slug: plan.slug,
        name: plan.name,
        tagline: plan.tagline,
        priceCents: plan.priceCents,
        currency: 'BRL',
        interval: 'MONTHLY',
        maxUsers: plan.maxUsers,
        storageGb: plan.storageGb,
        features: plan.features,
        entitlements: plan.entitlements,
        isPopular: plan.isPopular,
        position: plan.position,
      },
      update: {
        name: plan.name,
        tagline: plan.tagline,
        priceCents: plan.priceCents,
        maxUsers: plan.maxUsers,
        storageGb: plan.storageGb,
        features: plan.features,
        entitlements: plan.entitlements,
        isPopular: plan.isPopular,
        position: plan.position,
      },
    });
  }
  console.info(`✓ ${PLAN_SEEDS.length} planos sincronizados`);
}

async function seedDemoCompany(): Promise<void> {
  const existing = await prisma.company.findUnique({ where: { slug: DEMO_COMPANY_SLUG }, select: { id: true } });
  if (existing) {
    console.info('• Empresa de demonstração já existe — nada a fazer');
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ── Usuários ──────────────────────────────────────────────────────────────
  const users = new Map<string, string>();
  for (const person of PEOPLE) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      create: {
        name: person.name,
        email: person.email,
        passwordHash,
        emailVerifiedAt: new Date(),
        lastLoginAt: hoursAgo(2),
      },
      update: { passwordHash, emailVerifiedAt: new Date() },
      select: { id: true },
    });
    users.set(person.email, user.id);
  }

  const ownerId = users.get(PEOPLE[0].email)!;

  // ── Empresa ───────────────────────────────────────────────────────────────
  const company = await prisma.company.create({
    data: {
      name: 'Nexora Demonstração',
      slug: DEMO_COMPANY_SLUG,
      segment: 'Tecnologia',
      sizeBand: 'SMALL',
      goal: 'Centralizar comunicação e execução da equipe',
      ownerId,
      onboardedAt: new Date(),
    },
  });

  await prisma.role.createMany({
    data: DEFAULT_ROLE_PRESETS.map((preset) => ({
      companyId: company.id,
      name: preset.name,
      slug: preset.slug,
      description: preset.description,
      color: preset.color,
      rank: preset.rank,
      permissions: preset.permissions,
      isSystem: true,
      isDefault: preset.isDefault ?? false,
    })),
  });

  const departmentNames = ['Diretoria', 'Tecnologia', 'Marketing', 'Financeiro', 'Operações', 'Recursos Humanos'];
  const departmentColors = ['#2E7DFF', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4'];
  await prisma.department.createMany({
    data: departmentNames.map((name, index) => ({
      companyId: company.id,
      name,
      slug: slugify(name),
      color: departmentColors[index]!,
    })),
  });

  const roles = await prisma.role.findMany({ where: { companyId: company.id }, select: { id: true, slug: true } });
  const roleBySlug = new Map(roles.map((role) => [role.slug, role.id]));
  const departments = await prisma.department.findMany({ where: { companyId: company.id }, select: { id: true, name: true } });
  const deptByName = new Map(departments.map((dept) => [dept.name, dept.id]));

  // ── Vínculos ──────────────────────────────────────────────────────────────
  const memberships = new Map<string, string>();
  for (const person of PEOPLE) {
    const membership = await prisma.membership.create({
      data: {
        userId: users.get(person.email)!,
        companyId: company.id,
        roleId: roleBySlug.get(person.role)!,
        departmentId: deptByName.get(person.dept) ?? null,
        jobTitle: person.title,
        isOwner: 'owner' in person && person.owner === true,
        status: 'ACTIVE',
        presence: person.email === PEOPLE[0].email ? 'ONLINE' : 'OFFLINE',
        lastSeenAt: hoursAgo(1),
      },
      select: { id: true },
    });
    memberships.set(person.email, membership.id);
  }

  const gabriel = memberships.get('gabriel@nexora.app')!;
  const lucas = memberships.get('lucas@nexora.app')!;
  const matheus = memberships.get('matheus@nexora.app')!;
  const ana = memberships.get('ana@nexora.app')!;
  const carla = memberships.get('carla@nexora.app')!;
  const rafael = memberships.get('rafael@nexora.app')!;
  const juliana = memberships.get('juliana@nexora.app')!;
  const bruno = memberships.get('bruno@nexora.app')!;

  // Organograma: CEO no topo, diretores abaixo, times sob seus diretores.
  await prisma.membership.updateMany({ where: { id: { in: [lucas, matheus, ana, carla] } }, data: { managerId: gabriel } });
  await prisma.membership.updateMany({ where: { id: { in: [rafael, juliana] } }, data: { managerId: lucas } });
  await prisma.membership.updateMany({ where: { id: bruno }, data: { managerId: ana } });

  // Chefias de departamento.
  await prisma.department.updateMany({ where: { companyId: company.id, name: 'Tecnologia' }, data: { leadId: lucas } });
  await prisma.department.updateMany({ where: { companyId: company.id, name: 'Diretoria' }, data: { leadId: gabriel } });
  await prisma.department.updateMany({ where: { companyId: company.id, name: 'Marketing' }, data: { leadId: carla } });
  await prisma.department.updateMany({ where: { companyId: company.id, name: 'Financeiro' }, data: { leadId: matheus } });
  await prisma.department.updateMany({ where: { companyId: company.id, name: 'Operações' }, data: { leadId: ana } });

  const allMemberIds = Array.from(memberships.values());

  // ── Assinatura ────────────────────────────────────────────────────────────
  const proPlan = await prisma.plan.findUnique({ where: { slug: 'profissional' } });
  if (proPlan) {
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const subscription = await prisma.subscription.create({
      data: {
        companyId: company.id,
        planId: proPlan.id,
        status: 'ACTIVE',
        currentPeriodEnd: periodEnd,
        seats: PEOPLE.length,
        provider: 'manual',
      },
    });

    await prisma.payment.createMany({
      data: [0, 1, 2].map((monthsAgo) => ({
        companyId: company.id,
        subscriptionId: subscription.id,
        amountCents: proPlan.priceCents,
        currency: 'BRL',
        status: 'PAID' as const,
        method: 'CARD' as const,
        cardBrand: 'visa',
        cardLast4: '4242',
        paidAt: new Date(now.getFullYear(), now.getMonth() - monthsAgo, 5),
        providerPaymentId: `manual_demo_${monthsAgo}`,
      })),
    });
  }

  // ── Canais e mensagens ────────────────────────────────────────────────────
  const channelSeeds = [
    { name: 'geral', topic: 'Avisos e conversas de toda a empresa' },
    { name: 'anuncios', topic: 'Comunicados oficiais da liderança' },
    { name: 'tecnologia', topic: 'Time de produto e engenharia' },
    { name: 'marketing', topic: 'Campanhas e conteúdo' },
  ];

  const channels = new Map<string, string>();
  for (const seed of channelSeeds) {
    const channel = await prisma.channel.create({
      data: {
        companyId: company.id,
        name: seed.name,
        slug: seed.name,
        topic: seed.topic,
        kind: 'PUBLIC',
        lastMessageAt: hoursAgo(1),
      },
      select: { id: true },
    });
    channels.set(seed.name, channel.id);

    await prisma.channelMember.createMany({
      data: allMemberIds.map((membershipId) => ({
        channelId: channel.id,
        membershipId,
        isAdmin: membershipId === gabriel,
        lastReadAt: membershipId === gabriel ? hoursAgo(3) : hoursAgo(1),
      })),
    });
  }

  const conversation = [
    { channel: 'geral', author: gabriel, body: 'Bom dia, time! Semana decisiva: fechamos o trimestre na sexta.', hours: 8 },
    { channel: 'geral', author: ana, body: 'Bom dia! Já organizei a agenda de fechamento com o financeiro.', hours: 7.5 },
    { channel: 'tecnologia', author: lucas, body: 'Pessoal, precisamos terminar a apresentação do produto até sexta-feira.', hours: 6 },
    { channel: 'tecnologia', author: rafael, body: 'Eu fico com a parte técnica dos slides. Juliana pode revisar o visual?', hours: 5.5 },
    { channel: 'tecnologia', author: juliana, body: 'Posso sim. Vou ajustar o layout do dashboard até quinta.', hours: 5 },
    { channel: 'tecnologia', author: lucas, body: 'Precisamos corrigir o problema de lentidão relatado pelo cliente Atlas. É urgente.', hours: 3 },
    { channel: 'marketing', author: carla, body: 'Vamos lançar a campanha de setembro na próxima semana. Preciso dos materiais até terça.', hours: 4 },
    { channel: 'geral', author: matheus, body: 'Relatório mensal está pronto, subi na pasta Financeiro.', hours: 2 },
  ];

  const createdMessages: { id: string; channelId: string }[] = [];
  for (const entry of conversation) {
    const message = await prisma.message.create({
      data: {
        companyId: company.id,
        channelId: channels.get(entry.channel)!,
        authorId: entry.author,
        body: entry.body,
        createdAt: hoursAgo(entry.hours),
      },
      select: { id: true, channelId: true },
    });
    createdMessages.push(message);
  }

  await prisma.messageReaction.createMany({
    data: [
      { messageId: createdMessages[0]!.id, membershipId: ana, emoji: '🔥' },
      { messageId: createdMessages[0]!.id, membershipId: lucas, emoji: '🔥' },
      { messageId: createdMessages[4]!.id, membershipId: lucas, emoji: '👏' },
    ],
  });

  // ── Projetos ──────────────────────────────────────────────────────────────
  const projectSeeds = [
    { name: 'Lançamento Nexora 2.0', key: 'NEX', color: '#2E7DFF', lead: lucas, status: 'ACTIVE' as const, due: daysFromNow(21), members: [lucas, rafael, juliana, gabriel] },
    { name: 'Campanha Setembro', key: 'MKT', color: '#EC4899', lead: carla, status: 'ACTIVE' as const, due: daysFromNow(9), members: [carla, juliana] },
    { name: 'Fechamento Trimestral', key: 'FIN', color: '#10B981', lead: matheus, status: 'ACTIVE' as const, due: daysFromNow(4), members: [matheus, gabriel, ana] },
  ];

  const projects = new Map<string, string>();
  for (const seed of projectSeeds) {
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: seed.name,
        key: seed.key,
        color: seed.color,
        status: seed.status,
        leadId: seed.lead,
        startsAt: daysFromNow(-20),
        dueAt: seed.due,
        description: `Projeto ${seed.name} da Nexora Demonstração.`,
        members: { create: seed.members.map((id) => ({ membershipId: id, isLead: id === seed.lead })) },
      },
      select: { id: true },
    });
    projects.set(seed.key, project.id);
  }

  // ── Tarefas ───────────────────────────────────────────────────────────────
  const taskSeeds = [
    { title: 'Finalizar layout do dashboard', project: 'NEX', assignee: juliana, status: 'IN_PROGRESS' as const, priority: 'HIGH' as const, due: daysFromNow(1, 18), tags: ['design', 'ui'] },
    { title: 'Revisar pull requests pendentes', project: 'NEX', assignee: rafael, status: 'IN_PROGRESS' as const, priority: 'MEDIUM' as const, due: daysFromNow(0, 17), tags: ['código'] },
    { title: 'Corrigir lentidão reportada pelo cliente Atlas', project: 'NEX', assignee: rafael, status: 'TODO' as const, priority: 'URGENT' as const, due: daysFromNow(0, 18), tags: ['bug', 'cliente'], origin: 'MESSAGE' as const },
    { title: 'Preparar apresentação do produto', project: 'NEX', assignee: lucas, status: 'TODO' as const, priority: 'HIGH' as const, due: daysFromNow(4, 18), tags: ['apresentação'] },
    { title: 'Lançar versão 1.0 em produção', project: 'NEX', assignee: lucas, status: 'IN_REVIEW' as const, priority: 'HIGH' as const, due: daysFromNow(7, 18), tags: ['release'] },
    { title: 'Escrever roteiro dos vídeos da campanha', project: 'MKT', assignee: carla, status: 'IN_PROGRESS' as const, priority: 'MEDIUM' as const, due: daysFromNow(2, 18), tags: ['conteúdo'] },
    { title: 'Produzir peças para redes sociais', project: 'MKT', assignee: juliana, status: 'TODO' as const, priority: 'MEDIUM' as const, due: daysFromNow(5, 18), tags: ['design'] },
    { title: 'Consolidar relatório mensal', project: 'FIN', assignee: matheus, status: 'DONE' as const, priority: 'HIGH' as const, due: daysFromNow(-2, 18), tags: ['relatório'] },
    { title: 'Conciliação bancária de agosto', project: 'FIN', assignee: matheus, status: 'TODO' as const, priority: 'HIGH' as const, due: daysFromNow(-1, 18), tags: ['financeiro'] },
    { title: 'Atualizar base de conhecimento do suporte', project: null, assignee: bruno, status: 'TODO' as const, priority: 'LOW' as const, due: daysFromNow(10, 18), tags: ['suporte'] },
    { title: 'Revisar plano de contratação do 4º trimestre', project: null, assignee: ana, status: 'TODO' as const, priority: 'MEDIUM' as const, due: daysFromNow(12, 18), tags: ['pessoas'] },
    { title: 'Definir metas do próximo trimestre', project: null, assignee: gabriel, status: 'TODO' as const, priority: 'HIGH' as const, due: daysFromNow(3, 18), tags: ['estratégia'] },
  ];

  const createdTasks: { id: string; title: string }[] = [];
  for (const [index, seed] of taskSeeds.entries()) {
    const task = await prisma.task.create({
      data: {
        companyId: company.id,
        projectId: seed.project ? projects.get(seed.project)! : null,
        title: seed.title,
        description: `${seed.title}. Tarefa da empresa de demonstração.`,
        status: seed.status,
        priority: seed.priority,
        creatorId: gabriel,
        assigneeId: seed.assignee,
        dueAt: seed.due,
        completedAt: seed.status === 'DONE' ? daysFromNow(-2, 16) : null,
        tags: seed.tags,
        position: index,
        origin: seed.origin ?? 'MANUAL',
        createdAt: daysFromNow(-7 + index),
      },
      select: { id: true, title: true },
    });
    createdTasks.push(task);

    await prisma.taskWatcher.create({ data: { taskId: task.id, membershipId: seed.assignee } });
  }

  // Checklist e comentário numa tarefa, para a tela de detalhe ter conteúdo.
  const dashboardTask = createdTasks[0]!;
  await prisma.checklistItem.createMany({
    data: [
      { taskId: dashboardTask.id, title: 'Revisar espaçamentos dos cards', isDone: true, position: 0 },
      { taskId: dashboardTask.id, title: 'Ajustar contraste no tema escuro', isDone: true, position: 1 },
      { taskId: dashboardTask.id, title: 'Validar responsividade em tablet', isDone: false, position: 2 },
      { taskId: dashboardTask.id, title: 'Entregar para revisão do Lucas', isDone: false, position: 3 },
    ],
  });

  await prisma.taskComment.create({
    data: { taskId: dashboardTask.id, authorId: lucas, body: 'Ficou muito bom. Só ajusta o contraste dos números dos cards.' },
  });

  // Vincula a tarefa urgente à mensagem que a originou — o elo chat → tarefa.
  const bugTask = createdTasks[2]!;
  const bugMessage = createdMessages.find((m) => m.channelId === channels.get('tecnologia'));
  if (bugMessage) {
    await prisma.message.update({ where: { id: createdMessages[5]!.id }, data: { linkedTaskId: bugTask.id } });
    await prisma.task.update({ where: { id: bugTask.id }, data: { originRefId: createdMessages[5]!.id } });
  }

  // ── Reuniões ──────────────────────────────────────────────────────────────
  const meetingSeeds = [
    { title: 'Reunião de equipe', starts: daysFromNow(0, 8), ends: daysFromNow(0, 10), participants: [gabriel, lucas, ana, carla, matheus], project: null },
    { title: 'Alinhamento do projeto', starts: daysFromNow(0, 14), ends: daysFromNow(0, 15), participants: [lucas, rafael, juliana], project: 'NEX' },
    { title: 'Review semanal', starts: daysFromNow(2, 16), ends: daysFromNow(2, 17), participants: [gabriel, lucas, carla, matheus, ana], project: null },
    { title: 'Retrospectiva do sprint', starts: daysFromNow(-3, 15), ends: daysFromNow(-3, 16), participants: [lucas, rafael, juliana], project: 'NEX' },
  ];

  const createdMeetings: { id: string; title: string }[] = [];
  for (const seed of meetingSeeds) {
    const meeting = await prisma.meeting.create({
      data: {
        companyId: company.id,
        title: seed.title,
        description: `${seed.title} da Nexora.`,
        agenda: 'Status geral, bloqueios e próximos passos.',
        organizerId: gabriel,
        startsAt: seed.starts,
        endsAt: seed.ends,
        projectId: seed.project ? projects.get(seed.project)! : null,
        status: seed.starts < now ? 'ENDED' : 'SCHEDULED',
        provider: 'NEXORA',
        participants: {
          create: seed.participants.map((membershipId) => ({
            membershipId,
            response: membershipId === gabriel ? 'ACCEPTED' : 'PENDING',
          })),
        },
      },
      select: { id: true, title: true },
    });
    createdMeetings.push(meeting);

    await prisma.calendarEvent.createMany({
      data: seed.participants.map((membershipId) => ({
        companyId: company.id,
        ownerId: membershipId,
        title: seed.title,
        kind: 'MEETING' as const,
        startsAt: seed.starts,
        endsAt: seed.ends,
        meetingId: meeting.id,
        projectId: seed.project ? projects.get(seed.project)! : null,
      })),
    });
  }

  // Reunião passada já processada pela IA: transcrição → resumo → itens de ação.
  const retro = createdMeetings[3]!;
  const transcript = [
    'Lucas: Boa tarde a todos, vamos fazer a retrospectiva do sprint.',
    'Rafael: O sprint foi bom, entregamos oito das dez tarefas planejadas.',
    'Juliana: O design do dashboard ficou pronto, mas ainda precisa de ajuste de contraste.',
    'Lucas: Decidimos que o ajuste de contraste entra no próximo sprint.',
    'Rafael: Precisamos corrigir o problema de performance relatado pelo cliente Atlas até sexta-feira.',
    'Lucas: Combinado. Juliana fica responsável por revisar o layout do dashboard até quinta.',
    'Lucas: Ficou decidido também que vamos adotar revisão obrigatória de código a partir de agora.',
    'Rafael: Vou preparar a documentação do processo de review na próxima semana.',
  ].join('\n');

  await prisma.meetingNote.createMany({
    data: [
      { meetingId: retro.id, kind: 'TRANSCRIPT', content: transcript, generatedBy: 'seed' },
      {
        meetingId: retro.id,
        kind: 'SUMMARY',
        content:
          'O time entregou 8 das 10 tarefas do sprint. O dashboard está pronto, pendente de ajuste de contraste. Foi identificado um problema de performance no cliente Atlas com prazo para sexta-feira, e o time decidiu adotar revisão obrigatória de código.',
        generatedBy: 'seed',
      },
      {
        meetingId: retro.id,
        kind: 'DECISIONS',
        content: [
          'Ajuste de contraste do dashboard entra no próximo sprint.',
          'Revisão de código passa a ser obrigatória em todos os pull requests.',
        ].join('\n'),
        generatedBy: 'seed',
      },
    ],
  });

  await prisma.meetingActionItem.createMany({
    data: [
      { meetingId: retro.id, title: 'Corrigir o problema de performance do cliente Atlas', assigneeHint: 'Rafael Alves', dueHint: 'sexta-feira', dueAt: daysFromNow(2, 18), confidence: 0.91, status: 'SUGGESTED' },
      { meetingId: retro.id, title: 'Revisar o layout do dashboard', assigneeHint: 'Juliana Martins', dueHint: 'quinta', dueAt: daysFromNow(1, 18), confidence: 0.88, status: 'SUGGESTED' },
      { meetingId: retro.id, title: 'Preparar a documentação do processo de review', assigneeHint: 'Rafael Alves', dueHint: 'próxima semana', dueAt: daysFromNow(7, 18), confidence: 0.72, status: 'SUGGESTED' },
    ],
  });

  // ── Blocos de foco ────────────────────────────────────────────────────────
  await prisma.timeBlock.createMany({
    data: [
      { companyId: company.id, membershipId: gabriel, title: 'Foco: metas do trimestre', startsAt: daysFromNow(0, 10, 30), endsAt: daysFromNow(0, 12), taskId: createdTasks[11]!.id },
      { companyId: company.id, membershipId: gabriel, title: 'Revisar relatórios', startsAt: daysFromNow(0, 15), endsAt: daysFromNow(0, 16) },
    ],
  });

  // ── Avisos ────────────────────────────────────────────────────────────────
  await prisma.announcement.createMany({
    data: [
      {
        companyId: company.id,
        authorId: gabriel,
        title: 'Fechamento do trimestre nesta sexta',
        body: 'Time, precisamos de todos os relatórios consolidados até sexta às 18h. Contem com o financeiro para dúvidas.',
        severity: 'WARNING',
        audience: 'COMPANY',
        pinned: true,
        publishedAt: hoursAgo(20),
      },
      {
        companyId: company.id,
        authorId: ana,
        title: 'Nova política de home office',
        body: 'A partir do próximo mês, o modelo passa a ser híbrido com três dias presenciais. Detalhes no documento em Arquivos.',
        severity: 'INFO',
        audience: 'COMPANY',
        publishedAt: hoursAgo(72),
      },
    ],
  });

  // ── Notificações ──────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { companyId: company.id, membershipId: gabriel, kind: 'MENTION', title: 'Ana Costa mencionou você em #geral', body: 'Já organizei a agenda de fechamento…', href: '/mensagens' },
      { companyId: company.id, membershipId: gabriel, kind: 'TASK_ASSIGNED', title: 'Nova tarefa atribuída a você', body: 'Definir metas do próximo trimestre', href: `/tarefas/${createdTasks[11]!.id}` },
      { companyId: company.id, membershipId: gabriel, kind: 'MEETING_REMINDER', title: 'Reunião em 30 minutos', body: 'Reunião de equipe', href: `/reunioes/${createdMeetings[0]!.id}` },
      { companyId: company.id, membershipId: gabriel, kind: 'ANNOUNCEMENT', title: 'Fechamento do trimestre nesta sexta', href: '/avisos' },
      { companyId: company.id, membershipId: gabriel, kind: 'COMMENT', title: 'Lucas Ferreira comentou em uma tarefa', body: 'Ficou muito bom. Só ajusta o contraste…', href: `/tarefas/${dashboardTask.id}` },
    ],
  });

  // ── Auditoria (alimenta o feed de atividade recente) ──────────────────────
  await prisma.auditLog.createMany({
    data: [
      { companyId: company.id, actorId: gabriel, action: 'company.created', entityType: 'company', entityId: company.id, createdAt: daysFromNow(-30) },
      { companyId: company.id, actorId: lucas, action: 'project.created', entityType: 'project', entityId: projects.get('NEX')!, metadata: { name: 'Lançamento Nexora 2.0' }, createdAt: daysFromNow(-20) },
      { companyId: company.id, actorId: matheus, action: 'task.completed', entityType: 'task', entityId: createdTasks[7]!.id, metadata: { title: 'Consolidar relatório mensal' }, createdAt: daysFromNow(-2) },
      { companyId: company.id, actorId: carla, action: 'announcement.published', entityType: 'announcement', metadata: { audience: 'COMPANY' }, createdAt: hoursAgo(20) },
      { companyId: company.id, actorId: gabriel, action: 'member.invited', entityType: 'invitation', metadata: { email: 'novo@nexora.app' }, createdAt: hoursAgo(5) },
    ],
  });

  // Recalcula o progresso real de cada projeto a partir das tarefas criadas.
  for (const projectId of projects.values()) {
    const [total, done] = await Promise.all([
      prisma.task.count({ where: { projectId, deletedAt: null, status: { not: 'CANCELED' } } }),
      prisma.task.count({ where: { projectId, deletedAt: null, status: 'DONE' } }),
    ]);
    await prisma.project.update({
      where: { id: projectId },
      data: { progress: total === 0 ? 0 : Math.round((done / total) * 100) },
    });
  }

  console.info('✓ Empresa de demonstração criada');
  console.info(`  Acesso: ${PEOPLE[0].email} / ${DEMO_PASSWORD}`);
}

async function seedPlatformAdmin(): Promise<void> {
  const email = 'admin@nexora.app';
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email },
    create: { name: 'Administrador da Plataforma', email, passwordHash, emailVerifiedAt: new Date(), isPlatformAdmin: true },
    update: { isPlatformAdmin: true },
  });

  console.info(`✓ Administrador da plataforma: ${email} / ${DEMO_PASSWORD}`);
}

async function main(): Promise<void> {
  console.info('Semeando o banco do Nexora…\n');
  await seedPlans();
  await seedPlatformAdmin();
  await seedDemoCompany();
  console.info('\nConcluído.');
}

main()
  .catch((error) => {
    console.error('Falha no seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
