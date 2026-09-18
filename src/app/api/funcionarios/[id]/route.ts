import { noContent, ok, route } from '@/lib/http/api';
import { updateMemberSchema } from '@/lib/validation/schemas';
import { getMember, updateMember } from '@/server/services/members.service';

export const GET = route({}, async ({ auth, params }) => ok(await getMember(auth, params.id!)));

export const PATCH = route({ body: updateMemberSchema }, async ({ auth, body, params }) => {
  await updateMember(auth, params.id!, body);
  return noContent();
});
