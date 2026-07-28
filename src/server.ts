import 'reflect-metadata';
import app from './app';
import { AppDataSource } from './config/database.config';

const PORT = process.env.PORT ?? 3000;

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
