# munigan.app Discord community

Created through Discord UI on 2026-09-14, owned by the signed-in Diego Fernandes account. This document contains public identifiers only; no credentials.

## Server and channels

Server ID: `1549101749791629372`.

| Channel | ID | Purpose |
| --- | --- | --- |
| [start-here](https://discord.com/channels/1549101749791629372/1549102117350932502) | `1549102117350932502` | Bilingual welcome, guidelines, app link and project artwork via the app link preview. |
| [releases](https://discord.com/channels/1549101749791629372/1549102226453168169) | `1549102226453168169` | Product announcements and changelog. |
| [support](https://discord.com/channels/1549101749791629372/1549102294321205368) | `1549102294321205368` | English/Portuguese questions, bug reports and suggestions, one issue per thread. |
| [pro-updates](https://discord.com/channels/1549101749791629372/1549102374147194910) | `1549102374147194910` | Planned PRO features and explicit role opt-in instructions. |
| [geral](https://discord.com/channels/1549101749791629372/1549101753348268036) | `1549101753348268036` | General community discussion. |

Channel URLs are navigation links for existing members. Verified permanent, unlimited-use invitations target `start-here`:

- General community, no automatic role: https://discord.gg/vtK8Zvs6EG
- Explicit PRO notification opt-in, assigns the permission-free `PRO Launch` role: https://discord.gg/79SMq4A7vg

Both invite previews were visible in Discord. The PRO invite settings were reopened and verified to retain `PRO Launch`, no expiry, unlimited uses and temporary membership disabled. Do not substitute the PRO invite for the ordinary community link without explaining that it grants the notification role.

## Saved setup

- Server name: `munigan.app`.
- Icon: existing `src/app/apple-icon.png`, the green Munigan mark.
- Bilingual server description; Gear Lab, WoW WotLK and Support profile attributes.
- Welcome post links to the app; Discord renders its branded `munigan-workbench` social artwork. Separate image upload was interrupted by the desktop file picker and is not claimed as complete.
- Welcome, releases, support and PRO introduction posts published in English and Portuguese.
- Default server notifications: mentions only.
- Disabled @everyone permissions: mass mentions, creating expressions and creating events. Existing basic chat permissions retained.
- `PRO Launch` role created with no extra permissions, not mentionable by everyone, and no members automatically enrolled.
- For `start-here`, `releases`, and `pro-updates`, @everyone overrides deny sending messages, sending in threads, creating public/private threads, and public responses from external apps. Owner can publish; members can read/react.
- Automatic server setup-tip messages disabled. Default general text and voice channels retained.

## Notification operation available now

The pinned bilingual post in `pro-updates` offers both native invitations and explains what the optional role does. Existing members can request `PRO Launch` in support and request removal there to opt out. The owner assigns/removes roles manually for those requests. The role-granting invite was configured and verified, but not exercised with a second account. For a relevant launch announcement, select the actual role mention in Discord's composer; plain text spelling alone does not ping a role. Discord/user notification preferences still affect delivery.

This is a **channel-mention opt-in**, not consent to a DM campaign. Native role-granting invitations and the two incoming webhooks below are configured. No bot, direct-message sender, or app membership sync has been installed. No user has been sent an unsolicited notification.

## Publishing webhooks

Created with the user's explicit confirmation on 2026-09-14 and verified by saved name and destination in Discord:

| Webhook | Destination |
| --- | --- |
| Munigan Releases | `#releases` |
| Munigan PRO | `#pro-updates` |

Secret URLs remain in Discord's channel settings → Integrations → Webhooks. They were not copied into chat, files, or deployment configuration. No webhook test message was sent, so creation/configuration is verified but delivery is not yet tested.

At integration time, store each URL in the deployment secret manager, restrict role mentions explicitly, and add duplicate protection before automated publication. Webhooks publish to channels; they cannot send DMs or manage membership/discount eligibility.

The role is not a payment entitlement or discount record. The app's planned persisted launch-list membership remains the source for offer eligibility after implementation. Merely joining this server does not enroll an account in that app list.

## Remaining setup and blockers

1. Computer access resumed after the user restored Discord. Screenshots remain blank, but accessibility/keyboard interaction worked for invitations and pinning; combo boxes required keyboard input to open their options.
2. Invitations are created and recorded above. Add the ordinary invite to the app's community link, and offer the role-granting invite only as explicit optional channel-notification enrollment.
3. Optional native Community activation: wizard was inspected but **not completed**. Discord presents a separate Community Server Guidelines agreement. Obtain action-time confirmation for that agreement. Choose the existing `start-here` rules channel and a new private moderator updates channel; keep verification/media safeguards and mentions-only defaults.
4. Native role invites keep this simple without requiring Community onboarding or a third-party bot. Manual removal through support is documented; self-service opt-out can be added with a future app-owned role flow.
5. The two channel-specific publishing webhooks are created. Connecting them to a release workflow and testing delivery remain future integration work. Retain their URLs in Discord until a secure deployment secret destination is configured. A future bot is only needed for app-owned role sync/DM delivery; do not grant Administrator.
6. Implement and verify consent-aware role sync and/or an explicitly opted-in DM sender, with unsubscribe, blocked-DM handling, rate limits and idempotent delivery. Authentication's `identify` scope is not a notification mechanism. Send a test only to the owner after that recipient/purpose is authorized.
7. Revisit the app launch-list plan and copy: either explain channel notifications with an invite and optional role, or finish a tested DM opt-in flow before promising DMs. Do not imply notification delivery is implemented merely because the server exists.

Community mode, forum conversion, app installation, production integration and campaign delivery are not complete.
