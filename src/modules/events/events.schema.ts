import { z } from 'zod';

export const createEventSchema = z.object({
  body: z.object({
    venueId: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
  }),
});

export type CreateEventDto = z.infer<typeof createEventSchema>['body'];
