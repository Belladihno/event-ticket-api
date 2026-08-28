# Event Ticketing API

Production-grade REST API for selling event tickets. Organizers manage venues → events → publish → sections (priced tiers) → seats; customers verify via OTP, browse published events, reserve seats with pessimistic locking (10-min hold), checkout via **Bachs.io**, receive HMAC-signed PDF tickets via Supabase Storage, and validate at the door via QR.

Solves 5 core engineering problems:
1. **No double-booking** — `SELECT … FOR UPDATE` inside a TypeORM transaction.
2. **Auto-release** — 60s sweeper + lazy expiry on `GET /reservations/me`.
3. **Webhook safety** — `processed_webhook_events` idempotency on Bachs `evt_*` + `idempotency_key` on payments.
4. **Verifiable tickets** — `QR = {ticketId,userId,eventId, HMAC-SHA256}` with `QR_SIGNING_SECRET`.
5. **Fast reads without staleness** — Redis cache-aside with versioned invalidation + per-section seat-count TTL 60s.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + Express 5, TypeScript strict, `tsx`, `pnpm@11.9.0` |
| DB | MySQL 8 via TypeORM (`synchronize: false`, migrations) |
| Cache/Queue | Redis `ioredis` + BullMQ |
| Payments | Bachs.io SDK (`backend/src/providers/bachs.provider.ts`) |
| Storage | Supabase Storage (`StorageProvider` interface, `event-banners` public + `tickets` private) |
| Validation | Zod v4 |
| Auth | JWT access 15m (`Authorization: Bearer`) + httpOnly refresh cookie 7d (path `/api/auth`, `sameSite: strict`, Redis hash) + 6-digit OTP single-use 15m |
| PDF/QR | `pdfkit` + `qrcode` (HMAC) |
| Email | Nodemailer SMTP (mock logs `[email:mock]` when `SMTP_USER` unset) |
| Tooling | `tsc -p tsconfig.build.json`, `tsx watch`, `jest` + `ts-jest` + `supertest` |

---

## Architecture

```
Client → Express (helmet/cors/morgan/rate-limit/cookie-parser)
      → /api/webhooks (raw HMAC) → Zod → jwtGuard/rolesGuard → Controller → Service → TypeORM/Redis/BullMQ/Providers
Background: server.ts setInterval(60s) → expireOverdue(); BullMQ Worker(notifications, concurrency 5)
```

Monorepo: `pnpm-workspace.yaml` with `backend/` and `frontend/` (placeholder). `backend/src/` layered: `router → controller → service → repo/provider`.

---

## Workspace Layout

```
event-ticketing-api/
  backend/                 # API
    src/
      app.ts               # webhook pre-json, json, cors, helmet, morgan, rate-limit, /health
      server.ts            # DB init, BullMQ worker, 60s sweeper, listen 7000
      routes.ts            # mounts /api/auth, /users, /venues, /events, /reservations, /payments, /tickets, /favorites
      config/              # app.config, database.config (MySQL), redis.config, supabase
      common/              # base.entity, errors, guards, pipes, utils (hash/token/qr/uuid/code/rate-limit)
      providers/           # bachs, storage, email, session, otp
      modules/             # auth, users, venues, events, sections, seats, reservations, payments, tickets, favorites, notifications
      migrations/          # TypeORM
    tests/                 # jest (18 suites, 106 tests: 13 mocked + 5 e2e)
      e2e/                 # supertest + real MySQL/Redis via WSL2 (auth, reservations 409 concurrency, payments webhooks, tickets + refunds)
    tsconfig.json          # IDE base (node+jest, src+tests, noEmit)
    tsconfig.build.json    # prod build (rootDir src, dist)
    tsconfig.test.json     # jest (extends tsconfig.json)
  frontend/                # placeholder (Next.js)
  docker-compose.yml       # MySQL 8 + Redis 7
```

---

## Local Setup

```bash
pnpm install
cp backend/.env.example backend/.env   # also keep root .env for docker-compose
# fill: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, QR_SIGNING_SECRET,
#       BACHS_API_KEY, BACHS_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#       (SMTP_USER/PASS optional — mock logs in dev)
docker compose up -d
pnpm --filter backend migration:run
pnpm --filter backend dev      # http://localhost:7000, /health
# or from backend/: cd backend && pnpm dev
```

Env (`backend/.env.example:1`):
```
PORT=7000
DB_HOST=localhost DB_PORT=3306 DB_USERNAME=root DB_PASSWORD= DB_NAME=event_ticketing
REDIS_HOST=localhost REDIS_PORT=6379
JWT_ACCESS_SECRET= JWT_REFRESH_SECRET= QR_SIGNING_SECRET=
BACHS_API_KEY= BACHS_WEBHOOK_SECRET= BACHS_BASE_URL=https://sandbox-api.bachs.io
SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= SUPABASE_EVENT_BANNERS_BUCKET=event-banners SUPABASE_TICKETS_BUCKET=tickets
FRONTEND_URL=http://localhost:3000 CORS_ORIGIN=http://localhost:3000
SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER= SMTP_PASS= MAIL_FROM=noreply@yourdomain.com
```

---

## Scripts

| Command | Where |
|---|---|
| `pnpm --filter backend dev` | `tsx watch src/server.ts` |
| `pnpm --filter backend build` | `tsc -p tsconfig.build.json` → `backend/dist` |
| `pnpm --filter backend start` | `node dist/server.js` |
| `pnpm --filter backend migration:generate -- src/migrations/Name` | TypeORM |
| `pnpm --filter backend migration:run` |  |
| `pnpm --filter backend migration:revert` |  |
| `pnpm --filter backend test` | `jest` (18 suites, 106 tests, `--runInBand --forceExit` for e2e) |
| `pnpm --filter backend test:e2e` | `jest --runInBand --forceExit --testPathPattern=e2e` (real WSL2 MySQL/Redis) |
| `pnpm --filter backend test -- -t "auth"` | single suite |

---

## API Endpoints

Base `/api`. Envelope `200 { status: success, data }`, error `{ status: error, message, code?, errors? }`. Pagination `?page=1&limit=20` → `{ items, page, limit, total, totalPages }`.

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/auth/register` | - | - | Register (OTP emailed) |
| POST | `/api/auth/verify-email` | - | - | `{email,code}` |
| POST | `/api/auth/resend-verification` | - | - | Cooldown 60s |
| POST | `/api/auth/login` | - | - | Returns `accessToken` + httpOnly `refreshToken` cookie |
| POST | `/api/auth/refresh` | cookie | - | New accessToken |
| POST | `/api/auth/logout` | Bearer | - | Revokes refresh |
| POST | `/api/auth/forgot-password` | - | - | OTP reset |
| POST | `/api/auth/reset-password` | - | - | `{email,code,newPassword}` |
| GET | `/api/users/me` | Bearer | - | Profile |
| PATCH | `/api/users/me` | Bearer | - | Update `firstName/lastName` |
| GET | `/api/users/me/events` | Bearer | organizer | Own events (paginated) |
| GET | `/api/venues` | - | - | Cached 10m |
| POST | `/api/venues` | Bearer | organizer | Create |
| PATCH | `/api/venues/:id` | Bearer | organizer | Update |
| DELETE | `/api/venues/:id` | Bearer | organizer | Delete |
| GET | `/api/events` | - | - | Published, `q` FULLTEXT, `city`, `venueId`, `startDate/endDate`, versioned cache |
| GET | `/api/events/:id` | - | - | Detail + venue/organizer |
| POST | `/api/events` | Bearer | organizer | Create draft |
| POST | `/api/events/:id/banner` | Bearer | organizer | `multipart banner` → Supabase `event-banners` |
| PATCH | `/api/events/:id/publish` | Bearer | organizer | Draft→published (schedules reminder) |
| PATCH | `/api/events/:id/cancel` | Bearer | organizer | →cancelled |
| GET | `/api/events/:eventId/sections` | - | - | Cached 10m |
| GET | `/api/sections/:id` | - | - | Detail |
| POST | `/api/events/:eventId/sections` | Bearer | organizer | `{name,price,totalSeats}` |
| PATCH | `/api/sections/:id` | Bearer | organizer |  |
| DELETE | `/api/sections/:id` | Bearer | organizer |  |
| GET | `/api/sections/:sectionId/seats` | - | - | Seat map |
| GET | `/api/seats/:id` | - | - |  |
| POST | `/api/sections/:sectionId/seats` | Bearer | organizer | `seatNumbers[]` 1-1000 |
| GET | `/api/sections/:sectionId/seats/available` | - | - | `{available}` cached 60s, invalidated on reserve/expiry/book |
| PATCH | `/api/seats/:id` | Bearer | organizer | Rename |
| DELETE | `/api/seats/:id` | Bearer | organizer |  |
| POST | `/api/reservations` | Bearer | customer | `{seatIds: uuid[1..20]}` pessimistic lock, 10m TTL |
| GET | `/api/reservations/me` | Bearer | - | Lazy expiry, newest first |
| POST | `/api/reservations/:id/cancel` | Bearer | - | Pending→expired, idempotent seat release |
| POST | `/api/payments/checkout` | Bearer | - | `{sectionId,seatIds}` → Bachs `checkout_url`, creates holds |
| POST | `/api/webhooks/bachs` | HMAC | - | `X-Bachs-Signature`/`X-Bachs-Timestamp` 300s, 200 then async `collection.succeeded/failed`, `checkout.expired` |
| GET | `/api/tickets/me` | Bearer | - | My tickets |
| GET | `/api/tickets/me/events` | Bearer | - | Deduped events + `ticketCount` |
| GET | `/api/tickets/:id` | Bearer | - | Fresh signed URL 5m |
| POST | `/api/tickets/validate` | Bearer | organizer | `{qrPayload}` → verify HMAC, owner, `alreadyUsed` |
| GET | `/api/favorites` | Bearer | - | Cached 600s per user |
| POST | `/api/favorites/:eventId` | Bearer | - | 409 duplicate |
| DELETE | `/api/favorites/:eventId` | Bearer | - | 204 |
| GET | `/health` | - | - | `{ status: ok }` |

IDs are UUIDv7 strings, prices `DECIMAL(10,2)` → string `"50000.00"`, dates ISO-8601.

---

## Key Engineering Notes

* **Pessimistic locking** `backend/src/modules/reservations/reservations.service.ts:26` `manager.find(Seat, { lock: pessimistic_write })` + `In(seatIds)`; second racer waits then sees `status !== AVAILABLE` → `409`. Dedup `seatIds` via `Set`.
* **Expiry** `server.ts:11` `setInterval 60s → expireOverdue()` + `myReservations` lazy; `expireOverdue` `LessThan(now)` + `status===RESERVED` guard; `invalidateSeatAvailability` precise per section.
* **Idempotency** `backend/src/modules/payments/webhooks.service.ts:30` insert `processed_webhook_events(eventId unique)` before handling; `Payment.idempotencyKey = event.id`.
* **Webhook HMAC** `backend/src/modules/payments/webhooks.controller.ts:41` `HMAC-SHA256(timestamp.rawBody, secret)`, `timingSafeEqual`, `300s` tolerance, `express.raw` before `json`.
* **Cache-aside** `backend/src/modules/events/events.service.ts:15` `events:cache:version` incr on write, keys `events:list:v{n}:{base64(filters)}:{page}:{limit}` TTL 600; venues/sections 10m; `seats:available:{sectionId}` 60s + `redis.del` on all reserve/expiry/book paths.
* **Storage abstraction** `backend/src/providers/storage/storage.interface.ts` + `supabase-storage.provider.ts` (`upload/delete/getSignedUrl(bucket,path)`); banners public `event-banners/{eventId}/{uuid}`, tickets private `tickets/{ticketId}.pdf`.
* **QR signing** `backend/src/common/utils/qr.util.ts:11` `HMAC-SHA256(ticketId:userId:eventId, QR_SIGNING_SECRET)` → `verifyQrPayload`.
* **Notifications** BullMQ `notifications` queue (`backend/src/modules/notifications/notification.queue.ts`), worker `concurrency 5` (`notification.worker.ts`), `enqueueBookingConfirmation` after ticket generation, `scheduleEventReminder` delayed `start-24h`, `enqueuePaymentFailed`.
* **OTP/Rate-limit** `backend/src/providers/otp/redis-otp.store.ts` Lua `GET/INCR/EXPIRE`, `otpStore.save/claim` single-use 15m max 5, `auth:otp:cooldown:{scope}:{email}` `ttl` check, `common/utils/rate-limit.util.ts` fixed-window Lua `isRateLimited`.

---

## Testing

```bash
pnpm --filter backend test                 # 18 suites, 106 tests (13 mocked + 5 e2e)
pnpm --filter backend test:e2e             # e2e only (WSL2 MySQL/Redis at localhost:3306/6379, --runInBand --forceExit)
pnpm --filter backend test -- auth.service # single mocked suite
pnpm --filter backend test -- e2e/auth --runInBand --forceExit # single e2e file
```

Mocked unit/service: `hash/token/qr/code/uuid/rate-limit`, cache keys, expiry, auth (register 409/ER_DUP_ENTRY, login 401, verify/refresh), reservations pessimistic lock + `409` concurrency + `EXPIRED` idempotency, webhooks HMAC/timestamp/idempotency + `collection.succeeded/failed`, `checkout.expired`, `refund.created/paid` + seat invalidation, tickets `validate` reuse/wrong organizer/refunded.

E2E (real WSL2 MySQL/Redis via `backend/tests/e2e/helpers.ts` `initE2E`/`clearDatabase` `TRUNCATE` + `flushdb`, mocked `storageProvider`/`bachs`): `auth` (OTP via `redis.get auth:otp:verify:*`), `reservations` (true `SELECT … FOR UPDATE` `409` race), `payments` (checkout → HMAC webhook `200` + idempotency + `tickets` generation), `tickets` (checkout→webhook→ `GET /tickets/me` + `validate` `alreadyUsed` + `403` wrong organizer + `refund.paid` → `401 refunded` + seat `available`).

---

## Deployment

* Build: `pnpm --filter backend build` (`tsc -p tsconfig.build.json` → `backend/dist`)
* Run migrations before start: `pnpm --filter backend migration:run` (uses `backend/src/config/database.config.ts`, `synchronize: false`)
* Env: `JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, QR_SIGNING_SECRET` required at boot (`validateConfig()`); plus `BACHS_API_KEY/WEBHOOK_SECRET`, `SUPABASE_URL/SERVICE_ROLE_KEY`, `SMTP_*`. Use SSM/Secrets Manager, not committed `.env`.
* Infra: RDS MySQL 8, ElastiCache Redis 7, Supabase Storage (buckets `event-banners` public, `tickets` private, service role key), EC2 Ubuntu + `pnpm` + `pm2 start backend/dist/server.js --name event-api` + `pm2 startup` + Nginx reverse proxy 80/443 + Certbot.
* Workers scale: BullMQ `notifications` safe multi-instance; `scheduleEventReminder` on `publish` must be singleton or idempotent to avoid duplicate reminders.
* Refunds: `refund.created` (no-op) + `refund.paid` (`Reservation CONFIRMED→REFUNDED`, `Seat BOOKED→AVAILABLE`, `Payment SUCCESSFUL→REFUNDED`, `Ticket isRefunded`, `invalidateSeatAvailability`, `enqueueRefundIssued`) via `backend/src/migrations/1786548030000-AddRefundSupport.ts`.

---

## Contributing

Monorepo `pnpm-workspace.yaml` (`backend`, `frontend`). Use `pnpm --filter backend <script>`. Keep migrations for every schema change, never `synchronize: true`.
