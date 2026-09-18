import { noContent, ok, route } from '@/lib/http/api';
import { updateProjectSchema } from '@/lib/validation/schemas';
import { deleteProject, getProject, updateProject } from '@/server/services/projects.service';

export const GET = route({}, async ({ auth, params }) => ok(await getProject(auth, params.id!)));

export const PATCH = route({ body: updateProjectSchema }, async ({ auth, body, params }) => {
  return ok(await updateProject(auth, params.id!, body));
});

export const DELETE = route({}, async ({ auth, params }) => {
  await deleteProject(auth, params.id!);
  return noContent();
});
