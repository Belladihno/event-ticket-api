import { z } from 'zod';

export const createSeatsSchema = z.object({
  body: z.object({
    seatNumbers: z.array(z.string().min(1).max(10)).min(1).max(1000),
  }),
});

export type CreateSeatsDto = z.infer<typeof createSeatsSchema>['body'];

export const updateSeatSchema = z.object({
  body: z.object({
    seatNumber: z.string().min(1).max(10).optional(),
  }),
});

export type UpdateSeatDto = z.infer<typeof updateSeatSchema>['body'];
