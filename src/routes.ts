import { type Application } from 'express';
import authRouter from './modules/auth/auth.router';

export function setupRoutes(app: Application): void {
  app.use('/api/auth', authRouter);
}
