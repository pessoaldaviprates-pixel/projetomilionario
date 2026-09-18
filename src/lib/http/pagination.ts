/**
 * Paginação por cursor.
 *
 * Offset (`skip`) degrada linearmente em tabelas grandes e "pula" registros
 * quando há inserções concorrentes — inaceitável em chat e feeds. Usamos
 * cursor sobre um índice existente.
 */
import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type CursorPagination = z.infer<typeof cursorPaginationSchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Busca `limit + 1` registros para descobrir se existe próxima página sem
 * executar um COUNT — que exigiria varrer a tabela inteira.
 */
export function buildPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    hasMore,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
  };
}

/** Argumentos de cursor prontos para o Prisma. */
export function cursorArgs(cursor?: string): { cursor?: { id: string }; skip?: number } {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}
