# Task 5 implementation report

## What I implemented

- Added one `ProLaunchProvider` dialog owner, `useProLaunch().open(source, trigger)`, and a reusable `ProLaunchButton`.
- Added authenticated membership reads and explicit signup writes with abort signals, same-origin credentials, no-store caching, strict DTO validation, and recognized account-error handling.
- Guarded membership results with a monotonically increasing generation and current account ID. Close, account changes, sign-out/deletion states, and unmount abort and discard old work.
- Prevented duplicate joins. Closing during an uncertain POST forces a persisted GET on reopen.
- Added the cancelable `munigan:pro-before-sign-in` preservation request. A canceled request does not begin OAuth.
- Added safe resume behavior: refresh anonymous auth once at the destination, wait for auth resolution, consume only a matching marker, skip `/auth/return`, preserve the source, and never auto-join.
- Used Base UI `finalFocus` for the initiating control with the mobile menu button as fallback after the drawer trigger unmounts.
- Mounted the provider inside `AuthProvider`; added desktop/drawer entry points and closed the drawer before opening PRO.
- Added localized footer Discord support via the centralized `DISCORD_COMMUNITY_INVITE`. No Discord writes, webhooks, role sync, payments, or automatic invite action were added.

## TDD evidence

### RED

Command:

```sh
pnpm exec vitest run --project ui src/features/pro-launch/ProLaunchProvider.test.tsx src/features/shell/DrawerNavigation.test.tsx --project unit src/features/pro-launch/client.test.ts
```

Observed before implementation: `Cannot find module './client'`, failure to resolve `./ProLaunchProvider`, and the drawer could not find `Go PRO`. These were expected because the requested client, controller, and entry point did not exist.

The first implementation run also exposed a validator defect: an invalid date leaked `Invalid time value`. The validator now checks `Date.parse` before canonical ISO comparison.

### GREEN

The same focused command finished with 3 files and 18 tests passing, 0 failing. Vitest prints the existing jsdom diagnostic `Not implemented: navigation to another Document` from drawer navigation coverage; it does not fail the suite.

Additional verification:

```sh
pnpm typecheck
pnpm exec eslint src/features/pro-launch/ProLaunchProvider.tsx src/features/pro-launch/ProLaunchButton.tsx src/features/pro-launch/client.ts src/features/pro-launch/ProLaunchProvider.test.tsx src/features/pro-launch/client.test.ts src/features/shell/AppDocument.tsx src/features/shell/WorkbenchNavigation.tsx src/features/shell/DrawerNavigation.tsx src/features/shell/DrawerNavigation.test.tsx src/features/shell/AppShell.tsx
git diff --check
```

All exited 0 with no TypeScript, ESLint, or whitespace errors.

The controller's read-only Playwright check confirmed desktop typography, no horizontal overflow with internal scrolling at 390px, and focus restoration to `.workbench-menu-button` after the exit transition.

## Test coverage

- Exact GET/POST options and join body; strict DTO, ISO date, offer version, and server error validation.
- One POST across repeated pending clicks; anonymous/unavailable auth makes no membership request.
- Preservation cancellation; stale account write rejection; uncertain-write close/reopen; status retry.
- `ACCOUNT_CHANGED` refresh plus explicit rejoin; one-time matching resume; drawer-to-dialog handoff.

## Files changed

- `src/features/pro-launch/ProLaunchProvider.tsx`
- `src/features/pro-launch/ProLaunchButton.tsx`
- `src/features/pro-launch/client.ts`
- `src/features/pro-launch/ProLaunchProvider.test.tsx`
- `src/features/pro-launch/client.test.ts`
- `src/features/shell/AppDocument.tsx`
- `src/features/shell/AppShell.tsx`
- `src/features/shell/WorkbenchNavigation.tsx`
- `src/features/shell/DrawerNavigation.tsx`
- `src/features/shell/DrawerNavigation.test.tsx`
- `src/features/shell/shell.css`

## Self-review

I re-read the brief, Discord amendment, and final-focus notes against the diff. The optional Discord link stays separate from signup, and Task 6 sidebar behavior remains untouched. The only output noise is the known jsdom navigation diagnostic above; I found no implementation concern.
