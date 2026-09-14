# Munigan

[Munigan](https://munigan.app) is a toolkit for World of Warcraft: Wrath of the Lich King players, with gear optimization, DPS simulations, and a raid trainer. Gear simulations use the [Poli93 simulator](https://github.com/Poli93/wotlk) and support Original WotLK 3.3.5a and Wrath Classic item data.

Built with Next.js, React, TypeScript, PostgreSQL, and a native Go simulator.

## Getting started

Install Node.js 24, pnpm 10.33.0, Docker with Compose, Go 1.21+ (the build downloads the pinned Go 1.23.4 toolchain), Python 3, Git, and OpenSSL. The build uses Bash and Unix tools; use macOS or Linux.

```sh
git clone https://github.com/munigan/munigan.git
cd munigan
pnpm install --frozen-lockfile
docker compose up -d --wait
cp .env.example .env.local
```

In `.env.local`, set the database URL to match the PostgreSQL service in [`compose.yaml`](compose.yaml):

```dotenv
DATABASE_URL=postgresql://wotlk:local-development-only@127.0.0.1:55435/wow_top_gear
```

Generate a key with `openssl rand -hex 32` and paste it into `CAPABILITY_KEY` in `.env.local`. Then build the simulator and apply migrations:

```sh
pnpm sim:build
pnpm db:migrate
```

The first build downloads simulator sources and dependencies. Docker Compose runs PostgreSQL on `127.0.0.1:55435` and stores its data in a named volume. Stop it with `docker compose down`; restart it with `docker compose up -d --wait`. If you previously used `pnpm setup:local`, stop that PostgreSQL instance before starting Compose because both use the same port.

Start the app and simulation worker in separate terminals:

```sh
pnpm dev
```

```sh
pnpm worker
```

Open [http://127.0.0.1:3000/top-gear](http://127.0.0.1:3000/top-gear). No Trigger.dev account is needed for this local workflow. Optional service settings are documented in [`.env.example`](.env.example); keep secrets in `.env.local`.

## AI Setup

Paste this prompt into your coding agent to set up a local development environment with Trigger.dev. Have a Trigger.dev account/project ready; the agent may need you to complete browser login or add development credentials to `.env.local`. Discord and relay credentials enable the corresponding optional features.

```text
Set up and start Munigan on this machine. Do the setup, not just describe the steps.

1. Use the existing checkout, or clone https://github.com/munigan/munigan.git
   into a new munigan directory. Read AGENTS.md, README.md, package.json,
   compose.yaml, .env.example, trigger.config.ts, and the relevant operations
   guides in docs/engineering. Preserve existing work and configuration.

2. Check/install Node.js 24, pnpm 10.33.0, Docker with Compose, Git, Go 1.21+
   (the build selects Go 1.23.4), Python 3, Bash, and OpenSSL. Start Docker
   if needed. Run pnpm install --frozen-lockfile, then docker compose up -d
   --wait. Use the Compose PostgreSQL service; resolve any existing listener
   on port 55435 without deleting its data or stopping unrelated services.

3. Create .env.local from .env.example only if it does not exist; otherwise
   merge missing settings. Keep it private and preserve existing secrets.
   Set APP_ENV=local, APP_ORIGIN=http://127.0.0.1:3000, and
   DATABASE_URL=postgresql://wotlk:local-development-only@127.0.0.1:55435/wow_top_gear.
   Use this same direct URL for DATABASE_URL_UNPOOLED if that variable is set.
   Generate CAPABILITY_KEY with openssl rand -hex 32 only if missing. Keep
   the checked-in development policy defaults. Never print or commit secrets.

4. Run pnpm sim:build and pnpm db:migrate. Verify the native executable at
   dist/simulator/local/wowsimcli and database connectivity. Keep the
   repository's pinned simulator/data versions; no data regeneration is
   needed for a normal checkout.

5. Configure Trigger.dev Development. Run pnpm exec trigger login and let
   me complete browser authentication if needed. Use a project I can access
   or help me create my own in Trigger.dev; do not assume I have access to
   the project's checked-in default. Set TRIGGER_PROJECT_REF to my project
   reference and TRIGGER_SECRET_KEY to its Development secret key in
   .env.local. Have me add credentials privately if they are unavailable.
   Keep the existing Trigger config and task definitions. Development tasks
   execute on this machine and can use the local Docker database.

6. Configure optional features when their development credentials are
   available. For Discord login and saved reports, generate a stable
   BETTER_AUTH_SECRET if missing, set BETTER_AUTH_URL to APP_ORIGIN, configure
   DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET, and register the exact callback
   http://127.0.0.1:3000/api/auth/callback/discord in the Discord application.
   Then enable AUTH_ENROLLMENT_ENABLED and REPORT_SAVING_ENABLED. Without
   Discord credentials, leave those flags false and report login/saving as
   unavailable. For the Warmane cache and item tooltip services, configure
   WARMANE_RELAY_URL / WARMANE_RELAY_SECRET and ITEM_TOOLTIP_RELAY_URL /
   ITEM_TOOLTIP_RELAY_SECRET using development HTTPS services I can access;
   their implementations are in workers/warmane-armory and workers/item-tooltips.
   If these are not configured, explain the resulting feature limitations.
   Use development resources throughout; this is a local setup.

7. Start and keep these commands running in separate terminals or managed
   background sessions, with accessible logs:
     pnpm dev
     pnpm trigger:dev
     pnpm jobs:dispatch:watch
   Confirm the Trigger runner registers the top-gear task and the dispatcher
   connects successfully. Do not also run pnpm worker against this database:
   it is the alternative to Trigger, not an additional process. If Trigger
   access is blocked, finish independent setup and ask for the missing input;
   offer pnpm worker as an explicit temporary fallback, not a completed
   Trigger setup.

8. Open http://127.0.0.1:3000/gear-lab and verify it loads. Run a small
   simulation using a repository fixture or character data I provide, and
   confirm dispatch, a completed Trigger Development task, and its report
   in the app. Run pnpm typecheck. Report the app URL, running sessions,
   verification results, any blocked integrations, and restart/stop commands.
   Stop app/runner/dispatcher sessions with Ctrl+C and PostgreSQL with
   docker compose down, preserving its volume. Do not claim full setup
   success unless the Trigger-backed simulation completes.
```

## Project structure

- `src/` — app UI, server logic, and generated simulator types.
- `scripts/` — local setup, migrations, and background workers.
- `tools/simulator/` — pinned simulator build and patches.
- `data/` — game data and item profiles.
- `tests/` — integration tests, browser tests, and fixtures.
- `docs/engineering/` — architecture and operations notes.

## Contributing

Fork the repository, clone your fork, and create a branch for your change. Keep pull requests focused and include what changed, why, and how you tested it. Add screenshots for UI changes and tests for behavior changes.

Run these checks before opening a pull request:

```sh
pnpm typecheck
pnpm lint
pnpm test
```

For database or simulator changes, also run `pnpm test:integration` or `pnpm test:sim`. Rebuild native code with `pnpm sim:build`. Browser tests use `pnpm test:e2e` and require the local database and Playwright browsers (`pnpm exec playwright install`). The test harness starts its own app and simulation worker.

CI runs typechecking, lint, unit/UI tests, database and simulator tests, service checks, and a production build on pushes and pull requests. Run browser tests locally before submitting UI or authentication changes. You can also trigger **Browser tests (manual)** from the repository’s GitHub Actions page when needed; browser tests do not run automatically on each push.

Read [`AGENTS.md`](AGENTS.md) when using coding agents. Simulator compatibility and worker details live in the [compatibility notes](docs/engineering/top-gear-compatibility.md) and [operations guide](docs/engineering/top-gear-operations.md).

Simulator and generated source retain the [upstream license](public/licenses/Poli93-wotlk.txt). Warcraft assets belong to their respective rights holders.
