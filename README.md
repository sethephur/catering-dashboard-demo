# Catering Dashboard Demo

Demo catering operations dashboard built with React, Vite, Firebase Auth, Firestore, Firebase Storage, and Vercel serverless endpoints.

## Overview

This app is a sample workspace for reviewing inbound catering inquiries and managing the follow-up workflow around them. It includes:

- Inquiry inbox and detail views
- Client and event tracking
- Reports and help/support views
- Email template management
- Contract template generation with optional uploaded overrides
- Demo-mode authentication and sample workspace data

## Tech stack

- React
- Vite
- TypeScript
- Firebase Auth
- Firestore
- Firebase Storage
- Vercel Functions

## Local development

Install dependencies and start the frontend:

```bash
npm install
cp .env.example .env.local
npm run dev
```

If you want to run the `/api/admin/*` routes locally, use Vercel instead of the plain Vite dev server:

```bash
vercel dev
```

## Environment

Copy `.env.example` to `.env.local` and fill in your own demo project values.

Frontend env vars:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_MAPBOX_TOKEN`
- `VITE_DEMO_MODE`

Optional admin/backend env vars:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`
- `ADMIN_EMAILS`

Use a separate demo Firebase project for this app. Do not reuse production data, credentials, or service accounts.

## Demo content

- The repository includes synthetic demo records for inquiries, clients, events, and admin users.
- The bundled contract file at `public/templates/demo-contract-template.docx` is a generic placeholder.
- If you need real contract output, upload your own template overrides in Settings.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`
- `npm run lint`
- `npm run backfill:inquiry-created-at`
- `npm run cleanup:anonymous-auth-users`
