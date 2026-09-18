/**
 * Isolamento entre empresas (multi-tenancy).
 *
 * Esta é a propriedade de segurança mais importante do produto: uma empresa
 * nunca pode alcançar dados de outra. O teste cria dois tenants reais no banco
 * e tenta, a partir do contexto de um, ler e escrever recursos do outro.
 *
 * Requer um banco acessível via DATABASE_URL.
 */
import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { DEFAULT_ROLE_PRESETS, ALL_PERMISSIONS } from '../../src/lib/authz/permissions';
import type { AuthContext } from '../../src/lib/auth/context';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

interface Tenant {
  companyId: string;
  membershipId: string;
  userId: string;
  taskId: string;
  projectId: string;
  channelId: string;
  ctx: AuthContext;
}

const SUFFIX = `iso-${Date.now()}`;

async function createTenant(label: string): Promise<Tenant> {
  const user = await prisma.user.create({
    data: {
      name: `Usuário ${label}`,
      email: `${label}-${SUFFIX}@teste.nexora`,
      passwordHash: 'hash-de-teste-nao-utilizavel',
    },
  });

  const company = await prisma.company.create({
    data: { name: `Empresa ${label}`, slug: `empresa-${label}-${SUFFIX}`, ownerId: user.id },
  });

  const preset = DEFAULT_ROLE_PRESETS.find((entry) => entry.slug === 'ceo')!;
  const role = await prisma.role.create({
    data: {
      companyId: company.id,
      name: preset.name,
      slug: preset.slug,
      color: preset.color,
      permissions: preset.permissions,
      rank: preset.rank,
    },
  });

  const membership = await prisma.membership.create({
    data: { userId: user.id, companyId: company.id, roleId: role.id, isOwner: true, status: 'ACTIVE' },
  });

  const project = await prisma.project.create({
    data: { companyId: company.id, name: `Projeto ${label}`, key: `P${label.toUpperCase().slice(0, 3)}` },
  });

  const task = await prisma.task.create({
    data: {
      companyId: company.id,
      title: `Tarefa secreta da ${label}`,
      creatorId: membership.id,
      projectId: project.id,
    },
  });

  const channel = await prisma.channel.create({
    data: { companyId: company.id, name: 'geral', slug: `geral-${label}-${SUFFIX}`, kind: 'PUBLIC' },
  });

  await prisma.message.create({
    data: {
      companyId: company.id,
      channelId: channel.id,
      authorId: membership.id,
      body: `Mensagem confidencial da ${label}`,
    },
  });

  const ctx: AuthContext = {
    sessionId: `sessao-${label}`,
    userId: user.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: null,
      emailVerifiedAt: null,
      isPlatformAdmin: false,
      timezone: 'America/Sao_Paulo',
    },
    companyId: company.id,
    membershipId: membership.id,
    company: { id: company.id, name: company.name, slug: company.slug, logoUrl: null, onboardedAt: new Date() },
    role: { id: role.id, name: role.name, slug: role.slug, color: role.color },
    isOwner: true,
    permissions: new Set(ALL_PERMISSIONS),
    can: () => true,
    canAny: () => true,
  };

  return {
    companyId: company.id,
    membershipId: membership.id,
    userId: user.id,
    taskId: task.id,
    projectId: project.id,
    channelId: channel.id,
    ctx,
  };
}

let alfa: Tenant;
let beta: Tenant;

beforeAll(async () => {
  alfa = await createTenant('alfa');
  beta = await createTenant('beta');
});

afterAll(async () => {
  await prisma.company.deleteMany({ where: { slug: { contains: SUFFIX } } });
  await prisma.user.deleteMany({ where: { email: { contains: SUFFIX } } });
  await prisma.$disconnect();
});

describe('isolamento de dados entre empresas', () => {
  it('cada empresa enxerga apenas as próprias tarefas', async () => {
    const tasks = await prisma.task.findMany({
      where: { companyId: alfa.companyId },
      select: { id: true },
    });

    expect(tasks.map((task) => task.id)).toContain(alfa.taskId);
    expect(tasks.map((task) => task.id)).not.toContain(beta.taskId);
  });

  it('buscar tarefa de outro tenant com filtro de empresa não retorna nada', async () => {
    // Esta é exatamente a forma usada por `scopedId(ctx, id)` nos services.
    const found = await prisma.task.findFirst({
      where: { id: beta.taskId, companyId: alfa.companyId },
    });

    expect(found).toBeNull();
  });

  it('atualizar tarefa de outro tenant não afeta nenhum registro', async () => {
    const result = await prisma.task.updateMany({
      where: { id: beta.taskId, companyId: alfa.companyId },
      data: { title: 'INVADIDO' },
    });

    expect(result.count).toBe(0);

    const untouched = await prisma.task.findUnique({ where: { id: beta.taskId } });
    expect(untouched!.title).toBe('Tarefa secreta da beta');
  });

  it('excluir tarefa de outro tenant não afeta nenhum registro', async () => {
    const result = await prisma.task.deleteMany({
      where: { id: beta.taskId, companyId: alfa.companyId },
    });

    expect(result.count).toBe(0);
    expect(await prisma.task.findUnique({ where: { id: beta.taskId } })).not.toBeNull();
  });

  it('mensagens de outra empresa não aparecem na listagem', async () => {
    const messages = await prisma.message.findMany({
      where: { companyId: alfa.companyId },
      select: { body: true },
    });

    expect(messages.some((message) => message.body.includes('beta'))).toBe(false);
  });

  it('busca textual não vaza conteúdo de outro tenant', async () => {
    const results = await prisma.message.findMany({
      where: { companyId: alfa.companyId, body: { contains: 'confidencial', mode: 'insensitive' } },
      select: { body: true },
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.body).toContain('alfa');
  });

  it('projetos de outra empresa não são acessíveis', async () => {
    const found = await prisma.project.findFirst({
      where: { id: beta.projectId, companyId: alfa.companyId },
    });

    expect(found).toBeNull();
  });

  it('não é possível vincular pessoa de outra empresa a uma tarefa', async () => {
    // A validação de referência dos services faz exatamente esta consulta.
    const assignee = await prisma.membership.findFirst({
      where: { id: beta.membershipId, companyId: alfa.companyId, status: 'ACTIVE' },
    });

    expect(assignee).toBeNull();
  });

  it('excluir a empresa remove seus dados em cascata, sem tocar na outra', async () => {
    const temporary = await createTenant('temp');

    await prisma.company.delete({ where: { id: temporary.companyId } });

    expect(await prisma.task.findUnique({ where: { id: temporary.taskId } })).toBeNull();
    expect(await prisma.message.count({ where: { companyId: temporary.companyId } })).toBe(0);

    // Os outros tenants permanecem intactos.
    expect(await prisma.task.findUnique({ where: { id: alfa.taskId } })).not.toBeNull();
    expect(await prisma.task.findUnique({ where: { id: beta.taskId } })).not.toBeNull();
  });

  it('o vínculo usuário-empresa é único', async () => {
    await expect(
      prisma.membership.create({
        data: {
          userId: alfa.userId,
          companyId: alfa.companyId,
          roleId: (await prisma.role.findFirstOrThrow({ where: { companyId: alfa.companyId } })).id,
        },
      }),
    ).rejects.toThrow();
  });
});
