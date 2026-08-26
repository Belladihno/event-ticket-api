import { z } from 'zod';

export const createCheckoutSchema = z.object({
  body: z.object({
    sectionId: z.string().uuid(),
    seatIds: z.array(z.string().uuid()).min(1).max(20),
  }),
});

export type CreateCheckoutDto = z.infer<typeof createCheckoutSchema>['body'];
