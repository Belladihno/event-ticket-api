import { z } from 'zod';

export const createReservationSchema = z.object({
  body: z.object({
    seatIds: z.array(z.string().uuid()).min(1).max(20),
  }),
});

export type CreateReservationDto = z.infer<typeof createReservationSchema>['body'];
