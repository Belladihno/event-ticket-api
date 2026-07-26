import { type Application } from 'express';
import authRouter from './modules/auth/auth.router';
import usersRouter from './modules/users/users.router';

export function setupRoutes(app: Application): void {
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
}
