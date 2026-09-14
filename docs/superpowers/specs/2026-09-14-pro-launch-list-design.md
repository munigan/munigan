# PRO launch-list design

This records the design approved in the payments-design conversation, including the final signed-out Discord button. It is the specification for the implementation plan, not authorization to launch payments.

## Approved surface

[Paper: 39 munigan.app · PRO — Coming soon](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/15-0)

| Paper artboard | Required behavior |
| --- | --- |
| 01 · Header / Go PRO opens launch dialog | `Go PRO` immediately before the desktop language selector opens the shared modal. |
| 02 · Sidebar / Free limit → PRO coming soon | Preserve player identity and three boxes. A selection above the free combination limit exposes `Add credits`, which opens the same modal. |
| 03 · PRO dialog / Discord launch list | Show planned benefits, the current Discord account, discount offer, explicit consent copy, and `Join the PRO list`. |
| 04 · PRO dialog / Joined with Discord | Confirm durable membership and account-linked launch discount; close through `Back to Gear Lab` or the close control. |
| 05 · PRO dialog / Sign in with Discord | Use `Continue with Discord` with the existing 20px Discord icon after the text, replacing the arrow. Return from OAuth to the modal for explicit joining. |

Earlier prepaid-pack and billing artboards are future design references. They are not part of this release.

## Product constraints

- Payments remain disabled. Do not add Stripe, checkout, credit balances, credit purchases, subscription entitlements, or paid execution.
- The current free limits remain 120 combinations and 500 iterations per set under the default server policy. Preserve the existing server policy, workload validation, admission quotas, and readiness checks.
- Joining the launch list never changes simulation permissions or automatically starts a run.
- PRO benefits are upcoming: Gear Lab without limits, Log Review, and DPS-gain comparisons across raid items such as Icecrown Citadel.
- Signup uses the authenticated Discord account, not email.
- Anonymous users authenticate first and then explicitly confirm joining. OAuth completion alone is not marketing consent.
- The offer is an extra launch discount with no specified percentage, price, launch date, coupon, or recurring-payment commitment.
- Show all new interface copy in en-US and pt-BR.
- Preserve current gear selections, enhancements, item version, pending import draft, and existing auth/report return flows.
- Only the player identity is outside the sidebar’s three content boxes. The run action, notices, and free alternative belong inside the third box.
- The iteration control is a slider only: no number input and no minus/plus buttons. Center every label on its marker, including both endpoints.
- `About the set limit` is a dashed-underlined tooltip trigger without a disclosure arrow.

## Sidebar states

1. **Free, ready:** settings box; workload box; free-run action box. Run remains possible only when the existing allowance and readiness checks permit it. No fictitious balance or credit quote.
2. **Combination limit exceeded:** show the real combination count, free limit, and an over-limit explanation. Third box uses the approved coming-soon invitation, `Add credits`, `Payments aren’t available yet.`, and `Reduce selection`.
3. **Higher-iteration attempt:** preserve the existing server-selected value of 500. Explain that higher iterations are coming with PRO and expose the modal without turning the attempted value into a runnable request. Do not open an OAuth flow directly from slider movement.
4. **Unknown policy, invalid selection, readiness failure, pending admission, or operational error:** preserve existing disabled/error behavior. A readiness or network error is not an upsell condition.

Counts can be exact or conservative upper bounds (`Allowance.countKind`). Exact counts may show an exact excess such as “24 combinations above the free limit.” Upper bounds must be labeled “Up to … combinations” and must not claim a precise number of real excess combinations.

`Reduce selection` moves focus and scroll to the existing equipment selection area; it does not deselect items, reset enhancements, or guess which gear to keep.

## Dialog and account states

- Public feature summary is available without authentication.
- Anonymous: sign in with Discord, preserve draft and locale, then return to the dialog.
- Loading session: show a loading status in the signup area; do not flash a sign-in button or previous account identity.
- Authentication unavailable: keep the benefits readable and show a retry action.
- Authenticated, membership loading: show the resolved account but disable joining until the status request completes.
- Not joined: show the account and consent copy; joining is an explicit POST for the account currently shown.
- Joining: disable duplicate submissions, keep the close control available, and announce progress.
- Joined, including a repeat visit: render the confirmation from persisted server state.
- Request failure: retain the dialog and account, show a retryable error, and do not claim signup succeeded. A failed POST may have committed; retry must be idempotent.
- Account changed, signed out, or deleted: clear account-specific membership state and ignore stale requests from the previous account. Joining never silently targets the newly signed-in account.

## Persistence and contact

Store one launch-list membership per Better Auth user, bound to the server-resolved Discord provider account. Record first join time, locale, entry source, consent version, and offer version. The offer version establishes discount eligibility without inventing its monetary value. Duplicate joins return the original membership.

Remove membership when account deletion is requested, under the same account lifecycle lock; also use a cascading foreign key for final account cleanup. Do not retain email, OAuth tokens, raw IP addresses, gear, or log data in the list.

This release captures membership and consent. It does not send messages, install a Discord bot, or launch a campaign. Before the future notification campaign, implement and validate a Discord delivery mechanism with opt-out and delivery-failure handling. The existing OAuth `identify` scope only grants identity access; notification delivery must not reuse a user token as a bot credential. [Discord OAuth scopes](https://docs.discord.com/developers/topics/oauth2), [Discord user resource](https://docs.discord.com/developers/resources/user#create-dm).

## Visual measurements

Read Paper JSX and computed styles when implementing; use screenshots for verification. Inspected on 2026-09-14:

- Modal: 680px maximum width, 8px radius, 1px control border; 520px maximum width for confirmation. Constrain to viewport width minus 32px and height minus 32px, with internal scrolling.
- Main modal heading: Barlow Condensed 700, 48px/50px desktop; use 36px/40px on narrow screens.
- Body: Inter 14px/22px; lead 16px/24px; feature labels 16px/24px semibold.
- Header area: 24px top, 32px horizontal, 28px bottom; feature area 32px horizontal; signup area 28px top, 32px horizontal/bottom, 16px gaps. Reduce horizontal padding to 20px below 640px.
- Signup footer uses the existing `--color-gear-row` surface. Map Paper `--color-munigan-*` to the app’s corresponding semantic tokens, rather than creating another theme.
- Sidebar boxes: 20px padding, 8px radius, 16px gaps, 360px desktop width.
- Main actions: 48px high, 4px radius. Header Go PRO and close controls: minimum 44px hit area. Discord icon: existing `DiscordIcon`, 20px, following text with an 8px gap.
- The first and last slider labels share the exact same centers as their stops. Reserve half a label’s width on both ends rather than left/right-aligning the endpoint labels.

## Scope boundary

Implement the existing app’s header, sidebar, reusable PRO dialog, auth continuation, membership API, persistence, translations, and verification. Do not implement Log Review, raid-item simulation, unlimited workloads, billing, coupon issuance, Discord delivery, or the rest of the older payment screens in this change. Log Review’s separate implementation remains independent.

## Approved Discord integration amendment

The user approved implementation using the configured Discord server after this plan was written. This section supersedes the earlier copy promising direct messages.

- Preserve the explicit app signup POST and account-linked extra launch discount; Discord server membership is a separate optional step, never proof of signup.
- Joined confirmation includes an external `Enable Discord notifications` / `Ativar avisos no Discord` link to `https://discord.gg/79SMq4A7vg`, explaining that it grants the PRO Launch role for channel mentions, and how to request role removal in support. Do not auto-open the link or call the membership POST from link clicks.
- General community/support link uses `https://discord.gg/vtK8Zvs6EG`, without automatic role assignment. Add a discreet Discord support link to existing shared footer/navigation where appropriate.
- Centralize both public URLs in `src/domain/pro-launch/discord.ts`. No secret webhook URLs, bot tokens, outgoing webhook calls, DMs, role-sync API or payment execution in this release.
- Replace offerBody, anonymousBody, consent and nextSteps copy to make clear app signup reserves the offer and optional Discord server enrollment enables channel announcements. No claim of guaranteed delivery or existing role assignment.
- Two publishing webhooks exist in Discord but are intentionally not consumed by this web UI implementation. See `docs/engineering/discord-community-setup.md`.
