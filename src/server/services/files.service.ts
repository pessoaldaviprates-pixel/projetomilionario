/**
 * Arquivos.
 *
 * O binário nunca é servido direto do disco: toda leitura passa por
 * `getFileForDownload`, que revalida tenant e permissão. A chave de storage
 * não é exposta ao cliente em nenhum momento.
 */
import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { assertPermission, assertPermissionOrOwner, scoped, scopedId } from '@/lib/db/tenant';
import { auditFromContext } from '@/lib/audit';
import { NotFoundError } from '@/lib/http/errors';
import { categorizeFile, sanitizeFileName, storage, storeFile } from '@/lib/storage';
import { notify } from './notifications.service';
import type { AuthContext } from '@/lib/auth/context';
import type { FileCategory } from '@/generated/prisma/enums';

export interface FileFilters {
  category?: FileCategory;
  projectId?: string;
  taskId?: string;
  folderId?: string | null;
  search?: string;
  onlyMine?: boolean;
}

export async function listFiles(ctx: AuthContext, filters: FileFilters = {}) {
  assertPermission(ctx, 'files.view');

  const search = filters.search?.trim();

  return prisma.fileObject.findMany({
    where: {
      ...scoped(ctx),
      deletedAt: null,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.taskId ? { taskId: filters.taskId } : {}),
      ...(filters.folderId !== undefined ? { folderId: filters.folderId } : {}),
      ...(filters.onlyMine ? { ownerId: ctx.membershipId } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      // Arquivos privados de outra pessoa não aparecem para ninguém mais.
      OR: [{ visibility: { not: 'PRIVATE' } }, { ownerId: ctx.membershipId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, name: true, mimeType: true, sizeBytes: true, category: true,
      visibility: true, createdAt: true, version: true,
      owner: { select: { id: true, user: { select: { name: true, avatarUrl: true } } } },
      project: { select: { id: true, name: true, color: true } },
      folder: { select: { id: true, name: true } },
    },
  });
}

export interface UploadInput {
  fileName: string;
  mimeType: string;
  data: Buffer;
  projectId?: string | null;
  taskId?: string | null;
  meetingId?: string | null;
  folderId?: string | null;
  visibility?: 'PRIVATE' | 'COMPANY' | 'PROJECT' | 'CHANNEL';
}

export async function uploadFile(ctx: AuthContext, input: UploadInput) {
  assertPermission(ctx, 'files.upload');

  const name = sanitizeFileName(input.fileName);
  const stored = await storeFile(ctx.companyId, name, input.mimeType, input.data);

  const file = await prisma.fileObject.create({
    data: {
      companyId: ctx.companyId,
      ownerId: ctx.membershipId,
      name,
      storageKey: stored.storageKey,
      mimeType: input.mimeType,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      category: categorizeFile(input.mimeType),
      visibility: input.visibility ?? 'COMPANY',
      projectId: input.projectId ?? null,
      taskId: input.taskId ?? null,
      meetingId: input.meetingId ?? null,
      folderId: input.folderId ?? null,
    },
    select: { id: true, name: true, sizeBytes: true, mimeType: true, category: true, createdAt: true },
  });

  await auditFromContext(ctx, {
    action: 'file.uploaded',
    entityType: 'file',
    entityId: file.id,
    metadata: { name: file.name, sizeBytes: file.sizeBytes },
  });

  if (input.projectId) {
    const members = await prisma.projectMember.findMany({
      where: { projectId: input.projectId },
      select: { membershipId: true },
    });
    await notify({
      companyId: ctx.companyId,
      recipientIds: members.map((m) => m.membershipId),
      actorId: ctx.membershipId,
      kind: 'FILE_SHARED',
      title: 'Novo arquivo no projeto',
      body: file.name,
      href: `/projetos/${input.projectId}`,
      entityType: 'file',
      entityId: file.id,
    });
  }

  return file;
}

/** Carrega o binário após revalidar tenant, visibilidade e permissão. */
export async function getFileForDownload(ctx: AuthContext, fileId: string) {
  assertPermission(ctx, 'files.view');

  const file = await prisma.fileObject.findFirst({
    where: scopedId(ctx, fileId),
    select: {
      id: true, name: true, mimeType: true, sizeBytes: true, storageKey: true,
      visibility: true, ownerId: true, deletedAt: true,
    },
  });

  if (!file || file.deletedAt) throw new NotFoundError('Arquivo não encontrado.');
  if (file.visibility === 'PRIVATE' && file.ownerId !== ctx.membershipId) {
    throw new NotFoundError('Arquivo não encontrado.');
  }

  const data = await storage.get(file.storageKey);

  await auditFromContext(ctx, {
    action: 'file.downloaded',
    entityType: 'file',
    entityId: file.id,
    metadata: { name: file.name },
  });

  return { name: file.name, mimeType: file.mimeType, data };
}

export async function deleteFile(ctx: AuthContext, fileId: string): Promise<void> {
  const file = await prisma.fileObject.findFirst({
    where: scopedId(ctx, fileId),
    select: { id: true, ownerId: true, name: true },
  });
  if (!file) throw new NotFoundError('Arquivo não encontrado.');

  assertPermissionOrOwner(ctx, 'files.delete', file.ownerId);

  // Exclusão lógica: o binário só é removido do storage por rotina de expurgo,
  // preservando a possibilidade de recuperação e a trilha de auditoria.
  await prisma.fileObject.update({ where: { id: fileId }, data: { deletedAt: new Date() } });

  await auditFromContext(ctx, {
    action: 'file.deleted',
    entityType: 'file',
    entityId: fileId,
    severity: 'WARNING',
    metadata: { name: file.name },
  });
}

export async function getStorageUsage(ctx: AuthContext) {
  const [total, byCategory] = await Promise.all([
    prisma.fileObject.aggregate({ where: { ...scoped(ctx), deletedAt: null }, _sum: { sizeBytes: true }, _count: { _all: true } }),
    prisma.fileObject.groupBy({
      by: ['category'],
      where: { ...scoped(ctx), deletedAt: null },
      _sum: { sizeBytes: true },
      _count: { _all: true },
    }),
  ]);

  return {
    totalBytes: total._sum.sizeBytes ?? 0,
    totalFiles: total._count._all,
    byCategory: byCategory.map((row) => ({
      category: row.category,
      bytes: row._sum.sizeBytes ?? 0,
      count: row._count._all,
    })),
  };
}

export async function createFolder(ctx: AuthContext, name: string, parentId?: string | null) {
  assertPermission(ctx, 'files.upload');

  if (parentId) {
    const parent = await prisma.folder.findFirst({ where: scopedId(ctx, parentId), select: { id: true } });
    if (!parent) throw new NotFoundError('Pasta não encontrada.');
  }

  return prisma.folder.create({
    data: { companyId: ctx.companyId, name: sanitizeFileName(name), parentId: parentId ?? null },
  });
}

export async function listFolders(ctx: AuthContext) {
  assertPermission(ctx, 'files.view');

  return prisma.folder.findMany({
    where: scoped(ctx),
    orderBy: { name: 'asc' },
    select: { id: true, name: true, parentId: true, _count: { select: { files: true, children: true } } },
  });
}
