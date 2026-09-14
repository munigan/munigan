# WoW Droptimizer

A gear simulation app for level-80 World of Warcraft: Wrath of the Lich King characters. Import a character, compare gear combinations, and review DPS results using the [Poli93 simulator](https://github.com/Poli93/wotlk). Supports Original WotLK 3.3.5a and Wrath Classic item data.

Built with Next.js, React, TypeScript, PostgreSQL, and a native Go simulator.

## Getting started

Install Node.js 24, pnpm 10.33.0, PostgreSQL 16, Go 1.21+ (the build downloads the pinned Go 1.23.4 toolchain), Python 3, and Git. The local setup uses Bash and Unix tools; use macOS or Linux.

```sh
git clone https://github.com/munigan/wow-droptimizer.git
cd wow-droptimizer
pnpm install --frozen-lockfile
pnpm setup:local
```

On macOS, install PostgreSQL with `brew install postgresql@16`. If setup cannot find PostgreSQL, set `PG_BIN` to its `bin` directory.

Setup starts a local PostgreSQL cluster at `127.0.0.1:55435`, creates `.env.local` if missing, builds the simulator, and applies database migrations. The first run downloads simulator sources and build dependencies. Run `pnpm setup:local` again when you need to restart the database. This database configuration is for local development only.

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

For database or simulator changes, also run `pnpm test:integration` or `pnpm test:sim`. Rebuild native code with `pnpm sim:build`. Browser tests use `pnpm test:e2e` and require the local database, a running worker, and Playwright browsers (`pnpm exec playwright install`).

Read [`AGENTS.md`](AGENTS.md) when using coding agents. Simulator compatibility and worker details live in the [compatibility notes](docs/engineering/top-gear-compatibility.md) and [operations guide](docs/engineering/top-gear-operations.md).

Simulator and generated source retain the [upstream license](public/licenses/Poli93-wotlk.txt). Warcraft assets belong to their respective rights holders.
