import { created, ok, route } from '@/lib/http/api';
import { announcementSchema } from '@/lib/validation/schemas';
import { listAnnouncements, publishAnnouncement } from '@/server/services/announcements.service';

export const GET = route({}, async ({ auth }) => ok(await listAnnouncements(auth)));

export const POST = route({ body: announcementSchema }, async ({ auth, body }) => {
  return created(await publishAnnouncement(auth, body));
});
