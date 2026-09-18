import { noContent, route } from '@/lib/http/api';
import { deleteAnnouncement, markAnnouncementRead } from '@/server/services/announcements.service';

export const POST = route({}, async ({ auth, params }) => {
  await markAnnouncementRead(auth, params.id!);
  return noContent();
});

export const DELETE = route({}, async ({ auth, params }) => {
  await deleteAnnouncement(auth, params.id!);
  return noContent();
});
