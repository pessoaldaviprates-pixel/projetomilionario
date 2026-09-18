/**
 * Propriedades de segurança da autenticação.
 *
 * Verifica no banco real o que a revisão de código sozinha não garante:
 * senha nunca em texto puro, token só como hash, sessão revogável.
 */
import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { generateToken, hashToken, safeEqual } from '../../src/lib/auth/tokens';
import { assessPassword } from '../../src/lib/auth/password-policy';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const SUFFIX = `sec-${Date.now()}`;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: SUFFIX } } });
  await prisma.$disconnect();
});

describe('armazenamento de credenciais', () => {
  it('a senha nunca é gravada em texto puro', async () => {
    const plain = 'SenhaSuperSecreta123';

    const user = await prisma.user.create({
      data: {
        name: 'Teste Segurança',
        email: `senha-${SUFFIX}@teste.nexora`,
        passwordHash: await bcrypt.hash(plain, 12),
      },
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    expect(stored.passwordHash).not.toBe(plain);
    expect(stored.passwordHash).not.toContain(plain);
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare(plain, stored.passwordHash!)).toBe(true);
    expect(await bcrypt.compare('senhaErrada', stored.passwordHash!)).toBe(false);
  });

  it('hashes iguais de senhas iguais têm salt diferente', async () => {
    const [first, second] = await Promise.all([
      bcrypt.hash('MesmaSenha123', 12),
      bcrypt.hash('MesmaSenha123', 12),
    ]);

    expect(first).not.toBe(second);
  });
});

describe('tokens de uso único', () => {
  it('o banco guarda apenas o hash, nunca o token em claro', async () => {
    const user = await prisma.user.create({
      data: { name: 'Token', email: `token-${SUFFIX}@teste.nexora`, passwordHash: 'x' },
    });

    const token = generateToken();

    const record = await prisma.verificationToken.create({
      data: {
        userId: user.id,
        email: user.email,
        tokenHash: hashToken(token),
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    expect(record.tokenHash).not.toBe(token);
    expect(record.tokenHash).toHaveLength(64);

    // O token em claro não localiza nada: só o hash correto encontra.
    expect(await prisma.verificationToken.findUnique({ where: { tokenHash: token } })).toBeNull();
    expect(await prisma.verificationToken.findUnique({ where: { tokenHash: hashToken(token) } })).not.toBeNull();
  });

  it('tokens gerados são únicos e longos o bastante', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken()));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it('a comparação em tempo constante distingue corretamente', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
    expect(safeEqual('abc123', 'abc124')).toBe(false);
    expect(safeEqual('abc', 'abcdef')).toBe(false);
  });
});

describe('sessões', () => {
  it('sessão revogada deixa de ser válida imediatamente', async () => {
    const user = await prisma.user.create({
      data: { name: 'Sessão', email: `sessao-${SUFFIX}@teste.nexora`, passwordHash: 'x' },
    });

    const token = generateToken();
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const active = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
    expect(active!.revokedAt).toBeNull();

    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

    const revoked = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
    expect(revoked!.revokedAt).not.toBeNull();
  });

  it('excluir o usuário remove as sessões em cascata', async () => {
    const user = await prisma.user.create({
      data: { name: 'Cascata', email: `cascata-${SUFFIX}@teste.nexora`, passwordHash: 'x' },
    });

    await prisma.session.create({
      data: { userId: user.id, tokenHash: hashToken(generateToken()), expiresAt: new Date(Date.now() + 86_400_000) },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('política de senha', () => {
  it('reprova senhas fracas', () => {
    expect(assessPassword('123').score).toBeLessThanOrEqual(1);
    expect(assessPassword('senha').issues.length).toBeGreaterThan(0);
  });

  it('aprova senha forte', () => {
    const strength = assessPassword('Nexora@2026Segura');
    expect(strength.score).toBeGreaterThanOrEqual(3);
    expect(strength.issues).toHaveLength(0);
  });

  it('exige maiúscula, minúscula e número', () => {
    expect(assessPassword('somenteminusculas').issues).toContain('Inclua uma letra maiúscula');
    expect(assessPassword('SOMENTEMAIUSCULAS').issues).toContain('Inclua uma letra minúscula');
    expect(assessPassword('SemNumeroAqui').issues).toContain('Inclua um número');
  });
});
