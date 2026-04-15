# Nihal Ice Factory

Nx monorepo for the Nihal Ice Factory web app.

## Project Structure

- `packages/ui`: React + Vite frontend
- `packages/services`: NestJS API
- `libs/shared-models`: shared DTOs and models
- `libs/shared-services`: shared client/service helpers
- `libs/backend-utils`: backend utilities and filters

## Prerequisites

- Node.js 20 or newer
- npm
- A MySQL database for the API
- A Gmail account or SMTP-compatible mailbox for password reset emails

## Install

```bash
npm install
```

If dependency resolution fails in your environment, use the same fallback used by the current Render deployment:

```bash
npm install --force
```

## Run Locally

Start the frontend:

```bash
npx nx serve ui
```

Start the backend API:

```bash
npx nx serve services
```

Frontend runs on `http://localhost:4200` and the API listens on `http://localhost:3000` by default.

## Build

Build the frontend:

```bash
npx nx build ui
```

Build the backend:

```bash
npx nx build services
```

Useful validation commands:

```bash
npx nx lint ui
npx nx lint services
npx nx typecheck ui
npx nx typecheck services
```

## Environment Variables

### Backend required envs

Create a `.env` file at the repository root for local development.

```env
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=
JWT_SECRET=
ENCRYPTION_KEY=
EMAIL_USER=
EMAIL_PASS=
```

Notes:

- `DB_*` values are required by the NestJS database module.
- `JWT_SECRET` is required for JWT signing and validation.
- `ENCRYPTION_KEY` is required by the user service login flow.
- `EMAIL_USER` and `EMAIL_PASS` are required for password reset email delivery.
- `PORT` is usually injected by the hosting platform and defaults to `3000` locally if not set.
- `NODE_ENV=development` makes the API load `.env` from the repository root.

### Frontend envs

No frontend environment variables are required in the current codebase.
The API base URL is defined in `libs/shared-services/src/lib/config.ts`.

## Deploying to Vercel

Vercel is a good fit for the frontend only. The backend API is a separate Node application and should stay on a Node host such as Render.

### Vercel setup for `packages/ui`

1. Import the repository into Vercel.
2. Set the root directory to the repository root.
3. Use this build command:

```bash
npx nx build ui
```

4. Set the output directory to:

```text
dist/packages/ui
```

5. Leave frontend env vars empty unless you later move the API URL into an env var.

### SPA routing on Vercel

If you use client-side routes, add a `vercel.json` file with a rewrite so refreshes on nested routes still work:

```json
{
	"rewrites": [
		{ "source": "/(.*)", "destination": "/index.html" }
	]
}
```

### Backend deployment

The repository already includes a Render deployment manifest at `packages/services/.render.yaml`. If you deploy the API elsewhere, make sure the same backend env vars are set there.

## Quick Start

```bash
npm install
npx nx serve services
npx nx serve ui
```