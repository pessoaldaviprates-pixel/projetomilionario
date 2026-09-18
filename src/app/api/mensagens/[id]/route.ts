import { noContent, ok, route } from '@/lib/http/api';
import { updateMessageSchema } from '@/lib/validation/schemas';
import { deleteMessage, updateMessage } from '@/server/services/chat.service';

export const PATCH = route({ body: updateMessageSchema }, async ({ auth, body, params }) => {
  return ok(await updateMessage(auth, params.id!, body.body));
});

export const DELETE = route({}, async ({ auth, params }) => {
  await deleteMessage(auth, params.id!);
  return noContent();
});
