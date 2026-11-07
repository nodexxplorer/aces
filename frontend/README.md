# Admin Pack / ACES — Web

Multi-department university administration and student portal built with React 18,
TypeScript, Vite, React Query, Zustand and Tailwind CSS. The PWA can browse previously
cached responses offline; it does **not** queue changes for automatic replay.

## Local setup

Use Node.js 22 and npm. Start/configure the API using
[the backend guide](../backend/README.md).

```sh
npm ci
cp .env.example .env
# Set VITE_API_BASE_URL to the backend origin (without /api/v1).
npm run dev -- --host 0.0.0.0
```

The default Vite port is 5173. With no `VITE_API_BASE_URL`, API requests use the
web origin at `/api/v1`; that deployment must route API requests to the backend.
Vite does not proxy those requests automatically. Never ship a localhost API URL
to a remote browser.

## Checks

```sh
npm test
npm run lint
npm run format:check
npm run build
```

`npm run build` type-checks both referenced TypeScript projects and generates
`dist/`. Deploy that directory with SPA fallback routing (see `vercel.json`).
`npm run format` applies the project's formatting rules.

## Sessions and offline behavior

- Private response caches are scoped by department, user and active role.
- Login, local logout and identity/role changes cancel and clear React Query
  data and invalidate browser response caches, even if server logout fails.
- Responses from a previous session are rejected rather than cached or displayed.
- Public/guest requests are not stored in the private response cache.
- Failed writes remain errors. They are not queued or retried automatically:
  a network timeout may mean that the server already committed an operation.
  Check its status before retrying, especially for payments.
- Legacy pending writes are discarded rather than replayed unsafely.

See [administrator roles](../docs/admin-roles.md) for role names, responsibilities
and the HOD-controlled permission-grant process.
