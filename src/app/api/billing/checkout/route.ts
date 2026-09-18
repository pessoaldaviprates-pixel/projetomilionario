import { ok, route } from '@/lib/http/api';
import { checkoutSchema } from '@/lib/validation/schemas';
import { startCheckout } from '@/server/services/billing.service';

export const POST = route({ body: checkoutSchema }, async ({ auth, body }) => {
  return ok(
    await startCheckout(auth, {
      planSlug: body.planSlug,
      method: body.method,
      paymentToken: body.paymentToken,
      cardBrand: body.cardBrand,
      cardLast4: body.cardLast4,
    }),
  );
});
