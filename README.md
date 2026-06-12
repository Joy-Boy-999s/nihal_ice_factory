# Nihal Ice Factory

Nx monorepo for the Nihal Ice Factory ERP — a dual-sided app for running an ice factory:
staff manage plants, prices, slot-level inventory, sales, credit and fulfillment; customers
order ice online (or over WhatsApp) with online payment or pay-on-delivery.

## Features

**Staff (ADMIN / USER-operator)**
- Sales entry and history (plant-scoped per operator), Excel export, print invoices
- Slot-grid inventory: production batches, ready/expiry tracking, sell/reserve/damage per slot
- Customer **Orders** board with slot-level fulfillment (strict match against the order)
- **Credit / Khata**: per-customer billed / paid / outstanding, cash collection at handover
- **Production Plan**: upcoming advance bookings vs current stock, per-day shortfalls
- Real-time **notification bell** (SSE) for new orders / payments / cancellations
- Admin: dashboards, plant & price masters, user management, per-customer discount tiers, **audit log**

**Customers (CUSTOMER role)**
- Shop with live stock badges ("Only 3 left", "Out of stock — expected ~5 PM")
- Normal (same-day, stock-reserved) or **advance bookings** for a future date
- Pay online via **Razorpay** (UPI/cards/netbanking) or **pay on delivery**
- Per-customer tiered discounts applied automatically
- Order tracking (Preparing → Handed over), cancellation with automatic **refunds**, GST tax invoices
- **WhatsApp ordering**: registered customers can order by messaging the factory number;
  order updates mirror to WhatsApp

## Project Structure

- `packages/ui` — React + Vite frontend (Vercel)
- `packages/services` — NestJS API (Render): modules for User, Plant, IcePrice, Sales,
  Inventory, Customer, CustomerDiscount, Payment (Razorpay + webhook), Notification (SSE),
  Whatsapp (Meta Cloud API webhook), Audit
- `libs/shared-models` — shared DTOs and models
- `libs/shared-services` — typed API client helpers used by the frontend
- `libs/backend-utils` — logging interceptor, exception filter (request-id correlation, redaction)

## Prerequisites

- Node.js 20 or newer, npm
- A MySQL 8 database
- A Gmail account or SMTP-compatible mailbox (password reset emails)
- Razorpay account (test keys work) for online payments
- Optional: Meta WhatsApp Business Cloud API app for WhatsApp ordering

## Install

```bash
npm install
```

If dependency resolution fails in your environment, use the same fallback used by the current Render deployment:

```bash
npm install --force
```

## Run Locally

```bash
npx nx serve services   # API on http://localhost:3000
npx nx serve ui         # frontend on http://localhost:4200
```

Copy `packages/services/.env.example` to `packages/services/.env` and
`packages/ui/.env.example` to `packages/ui/.env` first, and fill in real values.

> Local-dev tip: keep only one or two app tabs open. Each tab holds a live SSE
> connection and browsers cap plain HTTP at 6 connections per origin — many open
> tabs can make API calls queue (production uses HTTP/2 and is unaffected;
> hidden tabs also auto-release their stream).

## Build, Test, Lint

```bash
npx nx build ui
npx nx build services
npx nx test @nihal-ice-factory/services   # vitest — payment webhook money-path suite
npx nx lint ui
npx nx lint services
npx nx typecheck ui
npx nx typecheck services
```

CI (`.github/workflows/ci.yml`) runs lint/test/build for affected projects on pushes to
`main` and `razorpay-demo`, and on all pull requests.

## Environment Variables

### Backend (`packages/services/.env` — see `.env.example`)

| Variable | Required | Purpose |
|---|---|---|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | yes | MySQL connection |
| `DB_SYNCHRONIZE` | no | `true` (default) auto-syncs schema; set `false` once the schema is stable |
| `DB_LOGGING` | no | `true` logs SQL queries |
| `JWT_SECRET` | yes | JWT signing/validation |
| `ENCRYPTION_KEY` | yes | user login flow |
| `EMAIL_USER` / `EMAIL_PASS` | yes | password-reset OTP emails |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | yes for payments | Razorpay API keys |
| `RAZORPAY_WEBHOOK_SECRET` | recommended | verifies `POST /payment/webhook` (configure the webhook in the Razorpay dashboard with events `payment.captured`, `payment.failed`, `order.paid`) |
| `ALLOWED_ORIGINS` | prod | comma-separated CORS allowlist; defaults to `http://localhost:4200,https://nihal-ice-factory.vercel.app` — **add any new frontend domain here** |
| `APP_WEB_URL` | no | frontend URL used in WhatsApp replies |
| `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_APP_SECRET` | for WhatsApp | Meta Cloud API; webhook URL is `https://<api>/whatsapp/webhook` subscribed to `messages`. Features stay dormant when unset |
| `LOG_LEVEL` | no | comma-separated Nest log levels (prod default `log,warn,error`) |
| `PORT` | no | injected by the host; defaults to 3000 |
| `NODE_ENV` | — | `development` loads `.env` from the repo; production uses host env vars and JSON logs |

### Frontend (`packages/ui/.env` — see `.env.example`)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | yes | API base URL (e.g. `http://localhost:3000` or your Render URL) |
| `VITE_COMPANY_GSTIN` | no | when set, invoices render as GST tax invoices (HSN + CGST/SGST breakup) |
| `VITE_COMPANY_ADDRESS` | no | seller address on invoices |
| `VITE_ICE_HSN_CODE` | no | HSN code for ice (default `2201`) |
| `VITE_GST_RATE` | no | inclusive GST rate percent (default `5`) |

## Deployment

The live stack is **Vercel (frontend) + Render (backend) + Aiven MySQL**.

### Vercel (frontend)

1. Import the repository; root directory = repository root.
2. Build command `npx nx build ui`, output directory `dist/packages/ui`.
3. Set `VITE_API_URL` (+ the optional `VITE_COMPANY_*` GST vars).
4. `vercel.json` already provides the SPA rewrite and security headers (CSP allows
   Razorpay checkout; update it if you add other third-party scripts).

### Render (backend)

Set every backend env var above in the Render dashboard. After the first deploy:

- add the Razorpay webhook (`https://<api>/payment/webhook`) and set `RAZORPAY_WEBHOOK_SECRET`
- if using WhatsApp, register `https://<api>/whatsapp/webhook` in the Meta app and set the `WHATSAPP_*` vars
- make sure the Vercel domain is included in `ALLOWED_ORIGINS`

### Self-hosted (Windows EC2 + Nginx + PM2)

See `deployment.md` (manual walkthrough), `setup-server.ps1` (one-time server setup) and
`deploy.ps1` (build + start). For Ubuntu EC2 see `aws-deploy-guide.md`. When self-hosting,
SSE requires `proxy_buffering off` in Nginx, and the server's public origin must be added
to `ALLOWED_ORIGINS`.

## Operational Notes

- Every request/response is logged with a duration and `requestId` (echoed in the
  `x-request-id` header); errors include redacted bodies. Frontend errors ship to
  `POST /client-logs` and appear in the backend log stream as `[ClientLog]`.
- Auth endpoints are rate-limited (login 10/min, OTP 3/min). Payments, cancellations and
  admin actions are written to the **audit log** (`/audit`, admin page in the UI).
- Swagger UI is served by the API at `/api` (configured in `packages/services/src/swagger`).

## Quick Start

```bash
npm install
cp packages/services/.env.example packages/services/.env   # then fill values
cp packages/ui/.env.example packages/ui/.env
npx nx serve services
npx nx serve ui
```
