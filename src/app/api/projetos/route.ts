import { z } from 'zod';
import { created, ok, route } from '@/lib/http/api';
import { projectSchema } from '@/lib/validation/schemas';
import { createProject, listProjects } from '@/server/services/projects.service';
import type { ProjectStatus } from '@/generated/prisma/enums';

const querySchema = z.object({ status: z.string().optional(), q: z.string().optional() });

export const GET = route({ query: querySchema }, async ({ auth, query }) => {
  return ok(await listProjects(auth, { status: query.status as ProjectStatus | undefined, search: query.q }));
});

export const POST = route({ body: projectSchema }, async ({ auth, body }) => {
  return created(await createProject(auth, body));
});
