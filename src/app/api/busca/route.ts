import { route, ok } from '@/lib/http/api';
import { searchSchema } from '@/lib/validation/schemas';
import { globalSearch, type SearchType } from '@/server/services/search.service';

export const GET = route({ query: searchSchema }, async ({ auth, query }) => {
  const types = query.types?.split(',').filter(Boolean) as SearchType[] | undefined;
  const hits = await globalSearch(auth, query.q, { types, limit: query.limit });
  return ok(hits);
});
