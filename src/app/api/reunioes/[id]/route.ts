import { noContent, ok, route } from '@/lib/http/api';
import { cancelMeeting, getMeeting } from '@/server/services/meetings.service';

export const GET = route({}, async ({ auth, params }) => ok(await getMeeting(auth, params.id!)));

export const DELETE = route({}, async ({ auth, params }) => {
  await cancelMeeting(auth, params.id!);
  return noContent();
});
