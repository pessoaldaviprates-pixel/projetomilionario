/**
 * Cliente Prisma singleton.
 *
 * Em desenvolvimento o Next recarrega módulos a cada edição; sem o singleton
 * global cada reload abriria um novo pool de conexões até esgotar o Postgres.
 */
import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/lib/env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.databaseUrl });
  return new PrismaClient({
    adapter,
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!env.isProduction) globalForPrisma.prisma = prisma;
