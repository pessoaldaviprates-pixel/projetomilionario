import { z } from 'zod';
import { ok, route } from '@/lib/http/api';
import { inviteMembersSchema } from '@/lib/validation/schemas';
import { inviteMembers, listMembers } from '@/server/services/members.service';
import type { MembershipStatus } from '@/generated/prisma/enums';

const querySchema = z.object({
  q: z.string().optional(),
  departamento: z.string().optional(),
  cargo: z.string().optional(),
  status: z.string().optional(),
});

export const GET = route({ query: querySchema }, async ({ auth, query }) => {
  return ok(
    await listMembers(auth, {
      search: query.q,
      departmentId: query.departamento,
      roleId: query.cargo,
      status: query.status as MembershipStatus | undefined,
    }),
  );
});

export const POST = route({ body: inviteMembersSchema }, async ({ auth, body }) => {
  return ok(await inviteMembers(auth, body.invites));
});
