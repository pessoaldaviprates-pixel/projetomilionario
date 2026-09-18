import { z } from 'zod';
import { created, ok, route } from '@/lib/http/api';
import { createTaskSchema } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/http/rate-limit';
import { createTask, listTasks } from '@/server/services/tasks.service';
import type { TaskPriority, TaskStatus } from '@/generated/prisma/enums';

const listQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  search: z.string().optional(),
  minhas: z.string().optional(),
  concluidas: z.string().optional(),
});

export const GET = route({ query: listQuerySchema }, async ({ auth, query }) => {
  const tasks = await listTasks(auth, {
    status: query.status ? (query.status.split(',') as TaskStatus[]) : undefined,
    priority: query.priority ? (query.priority.split(',') as TaskPriority[]) : undefined,
    projectId: query.projectId,
    assigneeId: query.assigneeId,
    search: query.search,
    onlyMine: query.minhas === '1',
    includeDone: query.concluidas === '1',
  });
  return ok(tasks);
});

export const POST = route({ body: createTaskSchema }, async ({ auth, body }) => {
  await enforceRateLimit('mutation', auth.membershipId);
  const task = await createTask(auth, body);
  return created(task);
});
