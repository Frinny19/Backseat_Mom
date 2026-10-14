# Backseat Mom

An iPhone and Android app for parents and caregivers to log a baby's day together: feeds, pumping, sleep, diapers, medication and milestones. The ribbon at the top of Today shows when each thing last happened and what is running right now.

Built with Expo (React Native) and TypeScript, Supabase, and (from Phase 1) PowerSync for offline-first sync.

## Run it

```bash
npm install
npx expo start
```

Without Supabase settings the app opens straight to Today with sample data. To sign in for real, copy `.env.example` to `.env.local` and fill in your project's URL and publishable key.

## Layout

| Path | What it holds |
| --- | --- |
| `src/app/` | Screens (Expo Router). `(tabs)` is the main app, `(auth)` and `onboarding` come before it. |
| `src/components/` | Design system components: Icon, Button, Ribbon, QuickLog, ActivityCard, StatTile, TabBar. |
| `src/theme/` | `tokens.ts` is generated from `design/tokens.json`; `index.ts` adds fonts and the theme hook. |
| `src/domain/` | Categories, per-category Zod schemas, ribbon and timeline logic. |
| `src/state/` | Session (auth, family, babies) and settings stores. |
| `supabase/` | Migrations, row level security tests (pgTAP) and the local seed. |

## Design tokens

`design/tokens.json` is exported from the Backseat Mom design system artifact. After replacing it, run `npm run tokens`; CI fails if `src/theme/tokens.ts` is stale.

## Database

```bash
npm run db:start   # local Supabase in Docker, with seed data
npm run db:test    # RLS tests in supabase/tests
```

Local seed accounts: `demo@backseatmom.app` and `partner@backseatmom.app`, password `backseat-demo`.

Sign-in uses a 6-digit email code. In the Supabase dashboard, edit the Magic Link email template to include `{{ .Token }}`.

## Checks

```bash
npm run check   # tokens, typecheck, lint, unit tests
```
