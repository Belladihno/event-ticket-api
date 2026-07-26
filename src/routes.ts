import { type Application } from 'express';
import authRouter from './modules/auth/auth.router';
import usersRouter from './modules/users/users.router';
import venuesRouter from './modules/venues/venues.router';
import eventsRouter from './modules/events/events.router';

export function setupRoutes(app: Application): void {
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/venues', venuesRouter);
  app.use('/api/events', eventsRouter);
}
