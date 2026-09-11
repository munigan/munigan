# Discord authentication experience

Status: design proposal, September 10, 2026. No application implementation.

[Paper: 22 munigan.app · Discord & saved reports](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/O-0)

## Direction

Gear Lab (the user-approved replacement for Top Gear) remains available without an account. It compares equipped items, bag items and manually added items. Introduce the benefit of signing in when a completed report is available: keep this result and find past comparisons across devices.

Use the existing dark munigan.app surfaces, green primary actions, Inter controls, Barlow Condensed page headings, line icons and character/spec thumbnails. Discord is the only sign-in provider. No email, password or registration form.

## Main journey

1. An anonymous visitor runs Gear Lab and reads the result.
2. A dismissible inline notice offers **Save report** and explains the expiry. It does not automatically open a blocking dialog.
3. **Save report** opens a focused dialog with character/spec, DPS result, the saving benefit, **Continue with Discord**, and **Continue without saving**. The X has the same dismissal behavior.
4. Discord handles its own authorization screen. Return to the same report, retaining the current selection and report context.
5. Show a saving state until persistence succeeds. Only then show **Report saved** and **Open My Library**.
6. Proposed behavior: future completed runs made while signed in are saved automatically.

Use the shared top navigation from Paper's **21 Raid Trainer · Before the pull** page across app screens. The left group contains Overview, Gear Lab, Raid Trainer and More tools. The right group contains **My Library**, help, language and Discord sign-in/account access. Signing out does not delete saved work.

My Library is an account-wide destination, not a tool-specific reports section. Each entry identifies its tool and content type. Search applies across saved work, and **All tools** filters the list. A summary column can show DPS, practice outcomes, or setup details. The mixed report, practice-result and saved-setup examples demonstrate future extensibility; they do not imply those save capabilities already exist. New tools appear in the library filter when the account has saved content from them.

The homepage describes Gear Lab as: **Compare your gear. Test upgrades. Find your strongest combination.** Supporting copy explicitly covers equipped, bag and custom items. Use **Open Gear Lab** for entry points and **Compare gear** for the simulation action. Keep the Gear Lab product name in both EN-US and PT-BR.

## Paper boards

- **00 — Experience map:** journey, product rules and implementation considerations.
- **01 — Result ready:** anonymous result with the inline notice and a precise expiry footer.
- **02 — Save report:** Discord dialog, report context and a clear way to continue without saving.
- **03 — My Library:** saved work across tools, with type, context, summary and saved date.
- **04 — Entry, success & account menu:** general sign-in, account menu, successful save and compact expiry status after dismissal.
- **05 — Authentication & save recovery:** opening Discord, cancelled/denied sign-in, save failure after successful sign-in, saving, expired report and expired session.
- **06 — My Library states:** signed out, first-run empty state, no search matches and library load failure.
- **07 — Mobile:** completed result, Discord dialog and My Library at 390px content width.
- **08 — Shared navigation:** desktop top bar, More tools dropdown, library tool filter and the expanded mobile navigation.

## State and interaction details

- Dismiss the large notice for that report; retain a quiet expiry and save action. Do not repeatedly interrupt report browsing.
- The general sign-in entry returns to the page where it was opened. The report-saving entry returns to and saves the eligible current report.
- Authentication cancellation leaves the result available and offers another sign-in attempt.
- Authentication success followed by save failure offers **Try saving again**, rather than requesting authorization a second time.
- A network failure while loading history is not proof that reports were deleted. Avoid making claims about persistence in the failure message.
- An expired anonymous report cannot be recovered by signing in afterward. Offer a new run or access to already saved reports.
- Keep report saving idempotent and do not create duplicate history entries after retrying.
- Account identity must be apparent before attaching a report to a signed-in account.
- Shared links remain read-only. Saving ownership requires verification of the visitor's own eligible anonymous run; possession of a public URL alone is insufficient.

## Expiry and policy assumptions

The design uses the existing seven-day anonymous report access expiry from `docs/engineering/top-gear-operations.md`, not a newly approved retention policy. Use the actual server expiry timestamp and format it in the visitor's locale/time zone. Avoid implying immediate physical deletion when access expires; the existing cleanup process has a grace period.

Account-saved report retention, account deletion and individual report removal still need product decisions before implementation. The design does not promise permanent storage. Future tools can reuse the same account and history entry point.

## Accessibility and localization

- Preserve the result and restore focus to the initiating control after dialog dismissal.
- Support Escape, focus containment and appropriate accessible names for close/menu controls.
- Announce saving, save success and failure without moving focus unexpectedly.
- Use at least 44px touch targets on mobile; visible icon glyphs may be smaller.
- Preserve reduced-motion preferences for transitions and feedback.
- Keep the existing EN-US / PT-BR language controls; localize all new copy and format dates and numbers with the active locale.

## Reference

Discord's `identify` scope provides account identity such as username and avatar without requiring email or server access. The exact authentication integration is outside this design task.

- [Discord OAuth2 and permissions](https://docs.discord.com/developers/platform/oauth2-and-permissions)
- [Discord user resource](https://docs.discord.com/developers/resources/user)

## Design verification

The authentication, library, homepage and navigation revisions were inspected in Paper screenshots. Reviewed desktop and mobile spacing, typography, contrast, fixed alignment lanes, action hierarchy, content fit and consistency of sample report values. Recovery copy distinguishes authentication from report persistence. The screens reuse the existing design tokens. Main app screens and their modal backdrops use the shared top bar; older exploratory alternatives remain design history. No application code was changed.

Paper preview limitation: the added shared-navigation detail board has intermittent missing groups in MCP screenshots, despite the groups and text being present in the document. The main result, My Library, homepage and mobile screen previews were verified separately. The detail board needs a final canvas-render check before implementation.
