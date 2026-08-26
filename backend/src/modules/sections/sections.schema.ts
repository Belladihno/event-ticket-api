import { z } from 'zod';

export const createSectionSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    price: z.number().positive(),
    totalSeats: z.number().int().positive(),
  }),
});

export type CreateSectionDto = z.infer<typeof createSectionSchema>['body'];

export const updateSectionSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    price: z.number().positive().optional(),
    totalSeats: z.number().int().positive().optional(),
  }),
});

export type UpdateSectionDto = z.infer<typeof updateSectionSchema>['body'];
