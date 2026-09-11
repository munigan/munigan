# Buffs & settings — Paper design

Design exploration and approved implementation, 2026-09-10. The implementation notes below describe the web app follow-through.

[Open the Paper page](https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/M-0)

## Coverage

The page contains 15 editable artboards, arranged in reading order:

1. Encounter: quick presets, numeric duration and variation, target count, duration-window visualization, imported target details.
2. Talents & glyphs: preset selection, six compact icon-and-name selectors with effect descriptions outside the controls, raw talent-string disclosure.
3. Rotation: automatic/preset choice, current rotation provenance, a read-only summary of selected Fury APL actions, preset entry point.
4. Buffs — raid effects: search, active-only filter, clear action, effect descriptions, improved/normal selectors and checkboxes.
5. Buffs — target debuffs: armor and spell-support effects, with a reminder to keep result assumptions consistent.
6. Buffs — personal and party: assigned external support counts and Heroic Presence.
7. Consumes — Warrior: flask, food, pre-pull/combat potions, conjured item, explosives and engineering choices.
8. Consumes — Hunter example: elixir exclusivity and conditional pet food/scroll controls.
9. Professions: two profession pickers, imported ranks, enabled enhancements and per-combination validation.
10. Profession conflicts: removal of Jewelcrafting with manual Dragon’s Eyes; unknown Blacksmithing rank; affected-item review and automatic replacement action.
11. Advanced: JSON editing with line numbers and separate syntax/configuration validation.
12. Advanced error: precise error location, retry and disabled application.
13. Interaction states: glyph search, duplicate-choice explanation, empty buff search, clear-buffs confirmation, unsaved-change recovery.
14. Mobile section navigation: all seven sections and a fixed action footer.
15. Mobile buffs: stacked controls, compact effect rows and a section chooser.

## Visual contract

Desktop artboards are 1440 × 900, with a 1200 × 820 dialog. The header is 88px, body 658px, footer 72px, and navigation 254px wide. Mobile examples are 390 × 844.

Reuse the existing `--color-munigan-*` tokens. Modal framing uses `#17191D`; controls, lists and navigation use `#101215`; active navigation uses `#191C21`, a flush-left 2px green rule and a trailing green dot. Green indicates selection or the primary action; muted amber and red are reserved for requirements and errors.

Use Inter, 24px dialog titles, 20px section titles, 14px controls, and 12–13px supporting text. Controls are 44px high with 5px corners and neutral focus borders. Fixed icon and action lanes keep rows aligned. WoW icons come from the existing settings catalog; navigation uses consistent monochrome SVG icons.

## Proposed interaction changes for implementation review

- Stage edits locally across all seven tabs. Apply changes commits the draft; Cancel/X with edits offers discard recovery. Switching sections preserves the draft. The current app applies most settings immediately, so this is a proposed behavior change.
- Simulator default resets the current category in the draft, not every category. Show Imported, Default or Edited provenance.
- Combine personal and party buffs into one navigation group while preserving their separate data scopes. Long catalogs remain scrollable/expandable; illustrated rows are representative, not an exhaustive list.
- Search glyph and consume pickers by names/effects, show icons and descriptions, explain unavailable choices, and prevent duplicate glyphs. Reuse the established searchable-select styling.
- Make flask versus elixir exclusivity explicit. Keep engineering, pet and class-specific consume controls conditional on eligibility.
- Connect profession changes to manual enhancement conflicts. Offer affected-item review or eligible automatic replacements. Do not silently discard overrides. Treat unverified skill ranks distinctly from confirmed ineligibility.
- Advanced must validate both JSON syntax and the actual settings schema before committing. The artboard JSON is an illustrative sample, not a replacement simulator profile. Its condensed Fury rotation summary is not a complete APL or a DPS guarantee.
- Preserve all existing simulator fields, imported settings and locale support during implementation. No new combat rules are defined by these mockups.

## Reference sources

The seven-tab inventory and existing behavior were inspected in `src/features/settings/`. Glyph descriptions, buff names and consume/profession icons come from `data/wotlk/settings-ui.json` and `VisualSettings.tsx`. The rotation summary references `.cache/wotlk/ui/warrior/apls/fury.apl.json` and its preset definitions.

Screenshots were reviewed for typography, contrast, row alignment, text wrapping, mobile stacking and footer clearance. The design reuses the custom-item and per-item enhancement modal direction.

## Visual refinement pass

The follow-up pass audits all 15 artboards and applies these rules consistently:

- Glyph controls are 44px high. Their descriptions sit on the plain surface beneath each selector, without the previous 88px card boxes. Major and minor columns have equal widths and aligned headings.
- Related list rows share one complete rounded outline. Bottom rules appear only as internal dividers; final rows do not add a duplicate bottom border. This applies to rotation behavior, profession benefits and personal-support rows. Single effect rows have a complete outline.
- All five segmented controls size to their contents with `width: fit-content`, no growth, start alignment and a consistent 44px height. The buff category switcher no longer leaves an empty track across the content area.
- Segmented options include 16px monochrome SVG icons with an 8px label gap: flask, paired elixir bottles, raid group, personal support and target. Icons follow the label's active or muted color. All five controls retain their content-based widths.
- Ordinary explanatory notes are borderless. Requirement warnings and errors retain their complete container treatment.
- Inter is explicitly assigned to interface text; Advanced code and the system status bar retain their appropriate fonts.
- Buff, debuff, personal-support, rotation and profession list rows use a 2px title-to-description gap.
- `Select / Small` is 32px high for the inline Off / Normal / Improved choices, preserving the regular select typography, border, corners and horizontal padding. Standard form selects remain 44px high. The compact variant is applied to desktop and mobile buff lists.
- Mobile buffs use a continuous bordered list with compact selects beside each effect. Five effects fit where the original layout showed three oversized cards. Implementation should retain a 44px touch target around each 32px visual select on touch screens.

The pass preserves the settings and staged-application proposal while refining grouping, density and hierarchy.

### Numeric control refinement

- Personal-buff source counts and pet-scroll ranks use `Number input / Small`: 170px wide and 32px high, aligned with compact effect selects. Pet-scroll labels sit beside their controls rather than above stretched full-width fields.
- The stepper has three clear regions: a fixed decrement button, a centered editable value with its muted unit, and a fixed increment button. Buttons use 16px SVG icons, subtle surface contrast, and internal vertical dividers within one complete rounded outline. Values use tabular numerals; source labels pluralize correctly.
- The zero-source example shows a disabled decrement button. Implementation must respect each field's existing bounds, allow direct keyboard entry and arrow-key changes, and provide specific accessible names for both step buttons. Use a subtle neutral border for focus and a small neutral surface change for hover, without a green focus line. Keep touch targets at least 44px even when the visible control is 32px.
- Encounter duration and variation reuse the polished stepper structure at the regular 44px form height, matching the adjacent target select. Search, navigation selectors and rich two-line item pickers retain their existing form sizes.


## Web app implementation — 2026-09-10

All seven sections now use the approved modal frame, dark navigation and control surfaces, flush-left active indicator, compact icon segments, and fixed Apply/Cancel footer. At narrow widths, section navigation and buff categories use compact select menus. English and Brazilian Portuguese labels retain stable internal category IDs.

Edits are staged across sections and committed together on Apply. Cancel/X offers to discard unsaved edits. Simulator default resets the current section. Advanced uses the actual protobuf settings schema with encounter and talent checks; invalid JSON/settings remain editable and disable Apply until corrected.

Glyphs and consumes use searchable catalog choices and existing WoW icons. Duplicate glyph/profession choices are disabled. Profession changes report affected manual enhancements and only reset them when explicitly requested; unrelated overrides remain intact. Buff controls preserve the complete simulator field catalog, including imported numeric values.

The rotation tab uses the current class module’s actual presets and imported APL, with action counts and expandable configuration. Automatic priorities remain resolved by the simulator; the illustrative Fury sequence from Paper is not hardcoded for other classes. Consumable descriptions explain their purpose where the local catalog does not provide a complete effect description.

Shared item links and the Original-tooltip wrapper now fit their visible content, covering inventory titles, import previews and report icon/detail links. Top Gear’s Selected only control and filter state were removed.

Validation includes unit/UI tests, browser coverage for settings, both tooltip providers and item enhancement editing, English/Portuguese desktop/mobile overflow checks, TypeScript, targeted ESLint and a production build.
