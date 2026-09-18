/**
 * Armazenamento de arquivos.
 *
 * Decisões de segurança:
 *  - A chave de storage é gerada pelo servidor e sempre prefixada pelo tenant
 *    (`companies/<companyId>/…`). O nome enviado pelo usuário NUNCA vira caminho.
 *  - O download passa por rota autenticada que revalida tenant e permissão.
 *    Não existe URL pública adivinhável.
 *  - Tipo MIME é validado contra uma allowlist; extensões executáveis são
 *    rejeitadas mesmo que o MIME pareça inofensivo.
 */
import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import { ValidationError } from '@/lib/http/errors';
import type { FileCategory } from '@/generated/prisma/enums';

export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
  checksum: string;
}

export interface StorageDriver {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalStorageDriver implements StorageDriver {
  private root = path.resolve(process.cwd(), env.storage.localPath);

  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    // Defesa contra path traversal: o alvo precisa permanecer sob a raiz.
    if (!target.startsWith(this.root + path.sep)) {
      throw new ValidationError('Caminho de arquivo inválido.');
    }
    return target;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch(() => undefined);
  }
}

class S3StorageDriver implements StorageDriver {
  async put(): Promise<void> {
    throw new Error('Driver S3 ainda não configurado. Use STORAGE_DRIVER=local.');
  }
  async get(): Promise<Buffer> {
    throw new Error('Driver S3 ainda não configurado. Use STORAGE_DRIVER=local.');
  }
  async delete(): Promise<void> {
    throw new Error('Driver S3 ainda não configurado. Use STORAGE_DRIVER=local.');
  }
}

export const storage: StorageDriver =
  env.storage.driver === 's3' ? new S3StorageDriver() : new LocalStorageDriver();

/** MIME types aceitos. Qualquer coisa fora desta lista é recusada. */
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif',
  'application/pdf',
  'text/plain', 'text/csv', 'text/markdown',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-zip-compressed',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg',
]);

/**
 * Extensões bloqueadas independentemente do MIME declarado.
 * SVG e HTML entram aqui porque são vetores de XSS armazenado quando servidos
 * inline — se precisarmos deles no futuro, o caminho é sanitizar + servir com
 * Content-Disposition: attachment em domínio separado.
 */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.jar',
  '.sh', '.bash', '.ps1', '.vbs', '.js', '.mjs', '.php', '.py', '.rb',
  '.dll', '.so', '.dylib', '.app', '.deb', '.rpm',
  '.html', '.htm', '.xhtml', '.svg',
]);

export function assertUploadAllowed(fileName: string, mimeType: string, sizeBytes: number): void {
  const maxBytes = env.storage.maxFileMb * 1024 * 1024;
  if (sizeBytes <= 0) throw new ValidationError('Arquivo vazio.');
  if (sizeBytes > maxBytes) {
    throw new ValidationError(`Arquivo maior que o limite de ${env.storage.maxFileMb} MB.`);
  }

  const extension = path.extname(fileName).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw new ValidationError('Este tipo de arquivo não é permitido por motivos de segurança.');
  }
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new ValidationError(`Tipo de arquivo não suportado: ${mimeType}`);
  }
}

/** Remove qualquer componente de caminho e caracteres de controle do nome enviado. */
export function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName);
  // eslint-disable-next-line no-control-regex
  const withoutControl = base.replace(/[\x00-\x1f\x7f]/g, '');
  const cleaned = withoutControl
    .replace(/[^\w.\-\s()[\]áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/g, '_')
    .trim();
  return (cleaned || 'arquivo').slice(0, 180);
}

/** Chave determinística e isolada por tenant. */
export function buildStorageKey(companyId: string, fileName: string): string {
  const extension = path.extname(fileName).toLowerCase().slice(0, 12);
  const now = new Date();
  const yyyyMM = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `companies/${companyId}/${yyyyMM}/${randomUUID()}${extension}`;
}

export async function storeFile(
  companyId: string,
  fileName: string,
  mimeType: string,
  data: Buffer,
): Promise<StoredFile> {
  assertUploadAllowed(fileName, mimeType, data.byteLength);
  const storageKey = buildStorageKey(companyId, fileName);
  await storage.put(storageKey, data, mimeType);
  return {
    storageKey,
    sizeBytes: data.byteLength,
    checksum: createHash('sha256').update(data).digest('hex'),
  };
}

export function categorizeFile(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return 'SPREADSHEET';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PRESENTATION';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'ARCHIVE';
  if (mimeType.startsWith('text/') || mimeType.includes('word') || mimeType.includes('document')) return 'DOCUMENT';
  return 'OTHER';
}

export { formatBytes } from './format';
