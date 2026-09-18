import { noContent, route } from '@/lib/http/api';
import { markChannelRead } from '@/server/services/chat.service';

export const POST = route({}, async ({ auth, params }) => {
  await markChannelRead(auth, params.id!);
  return noContent();
});
