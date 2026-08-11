import 'reflect-metadata';
import app from './app';
import { AppDataSource } from './config/database.config';
import { ReservationsService } from './modules/reservations/reservations.service';

const PORT = process.env.PORT ?? 7000;

const reservationsService = new ReservationsService();

setInterval(async () => {
  try {
    await reservationsService.expireOverdue();
  } catch (err) {
    console.error('[ReservationWorker] Failed to expire overdue reservations:', err);
  }
}, 60_000);

async function start() {
  await AppDataSource.initialize();
  console.log('[Database] Connected');

  app.listen(PORT, () => {
    console.log(`[${process.env.APP_NAME ?? 'EventTicketingAPI'}] Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[Fatal] Failed to start server:', err);
  process.exit(1);
});
