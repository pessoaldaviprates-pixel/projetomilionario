import { z } from 'zod';
import { noContent, ok, route } from '@/lib/http/api';
import { cancelSubscription, changePlan, getSubscription } from '@/server/services/billing.service';

export const GET = route({}, async ({ auth }) => {
  const { subscription, entitlements, seatsUsed } = await getSubscription(auth);
  return ok({
    planSlug: entitlements.planSlug,
    planName: entitlements.planName,
    status: entitlements.status,
    seatsUsed,
    maxUsers: entitlements.maxUsers,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
  });
});

const changeSchema = z.object({ planSlug: z.string().min(1) });

export const PATCH = route({ body: changeSchema }, async ({ auth, body }) => {
  return ok(await changePlan(auth, body.planSlug));
});

export const DELETE = route({}, async ({ auth }) => {
  await cancelSubscription(auth, false);
  return noContent();
});
