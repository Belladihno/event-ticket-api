import { z } from 'zod';

export const validateTicketSchema = z.object({
  body: z.object({
    qrPayload: z.string().min(1),
  }),
});

export type ValidateTicketDto = z.infer<typeof validateTicketSchema>['body'];
