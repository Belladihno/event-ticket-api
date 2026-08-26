import { z } from 'zod';
import { paginationQuery } from '../../common/schemas/list-query.schema';

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

export const listEventsQuerySchema = z.object({
  query: z.object({
    ...paginationQuery,
    q: z.string().min(1).max(200).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    city: z.string().min(1).max(100).optional(),
    venueId: z.string().uuid().optional(),
  }),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>['query'];
