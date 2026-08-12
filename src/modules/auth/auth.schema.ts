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
  body: z.object({}),
});

export type RefreshDto = z.infer<typeof refreshSchema>['body'];

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z.email(),
    code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
  }),
});

export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>['body'];

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.email(),
  }),
});

export type ResendVerificationDto = z.infer<typeof resendVerificationSchema>['body'];

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.email(),
  }),
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>['body'];

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.email(),
    code: z.string().regex(/^\d{6}$/, 'Reset code must be 6 digits'),
    newPassword: z.string().min(8).max(128),
  }),
});

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>['body'];
