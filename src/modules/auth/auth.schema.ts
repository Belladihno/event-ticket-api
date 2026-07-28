import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.email(),
    password: z.string().min(8).max(128),
    role: z.enum(['customer', 'organizer']).optional(),
  }),
});

export type RegisterDto = z.infer<typeof registerSchema>['body'];

export const loginSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string(),
  }),
});

export type LoginDto = z.infer<typeof loginSchema>['body'];

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string(),
  }),
});

export type RefreshDto = z.infer<typeof refreshSchema>['body'];

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string(),
  }),
});

export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>['body'];
