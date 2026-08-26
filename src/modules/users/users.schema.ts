import { z } from 'zod';
import { paginationQuery } from '../../common/schemas/list-query.schema';

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
  }),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>['body'];

export const listMyEventsQuerySchema = z.object({
  query: z.object({
    ...paginationQuery,
  }),
});

export type ListMyEventsQuery = z.infer<typeof listMyEventsQuerySchema>['query'];
