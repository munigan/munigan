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
