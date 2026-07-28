import { z } from 'zod';

export const createVenueSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(300),
    city: z.string().min(1).max(100),
    capacity: z.number().int().positive(),
  }),
});

export type CreateVenueDto = z.infer<typeof createVenueSchema>['body'];

export const updateVenueSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    address: z.string().min(1).max(300).optional(),
    city: z.string().min(1).max(100).optional(),
    capacity: z.number().int().positive().optional(),
  }),
});

export type UpdateVenueDto = z.infer<typeof updateVenueSchema>['body'];
