This project is based on [Nitro v3](https://nitro.build), [h3](https://h3.dev/), and [Rolldown](https://rolldown.rs/).

Refer to `node_modules/nitro/dist/docs/README.md` when working on server (your knowledge about Nitro v3 is likely outdated!).

## Project Structure

`server/` contains server-side code with supported subdirs (create as needed): `api/` (/api prefixed handlers), `routes/` (non-prefixed route handlers), `middleware/`, `plugins/`, `utils/`, `assets/`, and `tasks/`. `public/` holds static assets (copied, not bundled). Config files: `nitro.config.ts` (serverDir, routeRules, preset, etc.), `tsconfig.json`.

## Conventions

- Relative imports with explicit `.ts` extensions (`../utils/auth.ts`). **Not
  the `~/*` alias in `server/`**: tsconfig knows it but the Nitro build does
  not resolve it — it is left as an external import, which crashes under Node
  and, under Bun, loads the source file outside the bundle with a stub
  `useRuntimeConfig` that ignores every `NITRO_*` variable.
- `bun run test` (Bun's runner, `test/`), `bun run typecheck`.

## What this server is

The server behind Vey Studio — see `README.md`: Vey Pro's purchase by SePay
bank transfer, its licence keys and the devices they are activated on (an
Ed25519-signed activation per device), the studio's anonymous usage counts,
and the site. There is no sign-in (README § Sign-in, removed). No chat goes
through it; the free AI that forwarded to Anthropic on credits is deleted
(README § Credits, removed).
