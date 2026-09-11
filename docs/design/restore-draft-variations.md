# Restore draft alert — proposals

Status: Option 01’s compact layout is implemented, updated with Option 02’s surface background at 80% opacity, full border and rounded corners. Text and controls remain fully opaque so the page artwork can show through without reducing readability. Restore uses Option 01’s text-only action (15px semibold, 12px icon gap). Actions remain inline to preserve the compact layout.

Paper: https://app.paper.design/file/01M20P4F8A377J1GT1GGCM3K1Z/I-0

Comparison artboard: BF4-0

- 01 / BFH-0: Compact character strip. Class/spec image, character name, spec and level, inventory summary, inline restore/discard actions.
- 02 / BG5-0: Character resume card. Larger character identity, explicit saved-draft heading, primary restore button, inventory summary and destination hint.
- 03 / BH3-0: Setup at a glance. Character and inventory on the left; item version, encounter, enhancements and selected count on the right.

All use existing Munigan colors, Inter body type, Barlow Condensed display type and the same class/spec assets as CharacterPortrait. Counts are sample data, not promises about available item support. For an unfinished import, show the import-review stage and missing preset instead of claiming equipment selection is ready.

## Implemented separately

- Warmane character-name placeholder is Munigan in both locales.
- The Top Gear menu resets to the initial import screen, including same-route navigation, through a cancelable navigation intent.
- Equipment selections remain in the existing draft. Unfinished form/review inputs are saved separately and reparsed on explicit restoration; Warmane review data is retained without another network lookup.
- Selecting gear or editing a report replaces the saved import with the equipment draft. Discard removes both forms of saved data.
- If saving fails, navigation is canceled to retain the current work.
