# PRO launch list: release and operations

The PRO launch list records explicit, account-linked interest in the future paid plan. It does not grant paid access, charge a payment method, issue a coupon, join a Discord server, assign a Discord role, or send a notification. The stored `offer_version` is the offer accepted by that account and must remain the input to any future discount calculation.

## Release order

1. Back up the production database according to the normal release procedure.
2. Apply the additive `0011_pro_launch_list.sql` migration before deploying routes or UI that use `pro_launch_memberships`.
3. Deploy the application with the existing Better Auth and Discord OAuth configuration: `APP_ORIGIN`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DATABASE_URL`, and the existing `AUTH_ENROLLMENT_ENABLED` policy. `true` permits new Discord accounts; `false` continues to permit returning accounts while rejecting new enrollment, as covered by the rollback browser test.
4. Verify anonymous display, mocked Discord return, explicit join, refresh persistence, and account deletion. Do not use a real Discord account for release automation.

The previous UI can run while the extra table exists, so rollback the application independently and leave the additive table in place. Removing the table during rollback creates avoidable risk and is unnecessary. If the migration itself cannot complete, stop before deploying the routes.

## Consent and identity semantics

Authentication uses Discord's `identify` scope to read the basic profile and bind the app account. Discord documents that scope as profile access; it is not permission to send a DM or publish a notification ([OAuth2 and Permissions](https://docs.discord.com/developers/platform/oauth2-and-permissions), [User Resource](https://docs.discord.com/developers/resources/user)). The authenticated server session supplies the user ID. The join request supplies an expected user ID only as an account-switch guard; it cannot choose the persisted identity.

The membership POST is the consent event. It stores one active membership per app account with the source, locale, consent version, and offer version. Repeating the POST is idempotent. A Discord server invitation is a separate, optional action: the PRO invitation grants the permission-free `PRO Launch` role for channel mentions, while the community invitation does not. Joining either server invitation is never proof of app signup.

Account deletion marks the account as deleting, rejects stale concurrent joins, and removes its membership as part of the account cleanup transaction. Operational counts must aggregate in place and must not export names, Discord identifiers, emails, tokens, or row-level membership data:

```sql
SELECT source, locale, count(*) AS members
FROM pro_launch_memberships
GROUP BY source, locale
ORDER BY source, locale;
```

## Verification matrix

| Boundary | Automated evidence |
| --- | --- |
| Explicit consent and durable membership | `playwright.pro-launch.config.ts`: zero rows before Join, one after Join, joined after reload |
| OAuth rejection | cancellation and invalid state leave zero memberships |
| Draft safety | fixture-backed Gear Lab draft survives OAuth; denied storage prevents navigation |
| Account controls | new phone-only account, session switch guard, retry idempotency, and deletion cleanup |
| Responsive and keyboard | English and Portuguese at 1440×900, 768×1024, 390×844, and 320×740; drawer handoff, modal fit, Escape, and focus restoration |
| Free limits | slider label/marker centers within 1px, a higher attempt retains 500, free request posts once, and over-limit Add credits posts no simulation |
| Regression gates | full unit/UI, scoped database integrations, typecheck, lint, build, OAuth, OAuth rollback, and auth controls |

## Campaign delivery boundary

This release collects the approved list only. It cannot deliver DMs, publish launch announcements, synchronize roles, or issue coupons. Discord incoming webhooks publish messages to channels ([Webhook Resource](https://docs.discord.com/developers/resources/webhook)); the two configured publishing webhooks described in [Discord community setup](./discord-community-setup.md) remain outside this web UI and their secret URLs must stay out of source control and test artifacts.

Before a PRO channel campaign, connect and test the configured channel webhook with an explicit publication purpose, idempotency, rate limits, controlled retries, and restrictive `allowed_mentions`. Publish through the PRO channel and mention only the intended `PRO Launch` role. Members opt in through the native role-granting invitation and can request role removal through support; document and exercise that opt-out operation before launch. Preserve each app membership's stored offer version when calculating its discount, independently of Discord role state. Discord role behavior is documented in [Roles and Permissions](https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions). Campaign delivery is a separate deliverable and is not a prerequisite for collecting the list.

No production migration, deployment, webhook call, Discord message, role synchronization, coupon issuance, or payment action is part of this release handoff.
