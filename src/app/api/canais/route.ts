import { created, ok, route } from '@/lib/http/api';
import { createChannelSchema, directChannelSchema } from '@/lib/validation/schemas';
import { createChannel, listChannels, openDirectChannel } from '@/server/services/chat.service';
import { z } from 'zod';

export const GET = route({}, async ({ auth }) => ok(await listChannels(auth)));

const bodySchema = z.union([
  createChannelSchema.extend({ tipo: z.literal('canal').optional() }),
  directChannelSchema.extend({ tipo: z.literal('direta') }),
]);

export const POST = route({ body: bodySchema }, async ({ auth, body }) => {
  if ('membershipIds' in body) {
    return created(await openDirectChannel(auth, body.membershipIds));
  }
  return created(await createChannel(auth, body));
});
