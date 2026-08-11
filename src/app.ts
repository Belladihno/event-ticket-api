import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { setupRoutes } from './routes';
import { errorHandler } from './common/middlewares/error.middleware';
import { config } from './config/app.config';
import webhookRouter from './modules/payments/webhooks.controller';

const app = express();

// Webhook route MUST be registered BEFORE the global json() parser.
// It uses express.raw() internally so the raw body is available for signature verification.
app.use('/api/webhooks', webhookRouter);

app.use(express.json());
app.use(cors({ origin: config.corsOrigin }));
app.use(helmet());
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

setupRoutes(app);
app.use(errorHandler);

export default app;
