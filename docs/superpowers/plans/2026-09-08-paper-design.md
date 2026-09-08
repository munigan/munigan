# Paper Website Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Work inline unless the user explicitly requests delegation.

**Goal:** Design, refine, and obtain approval for the complete WotLK optimizer experience in Paper before any application coding.

**Architecture:** Paper is the editable visual source. A repository handoff records stable screen keys, actual Paper references, design tokens, example data, interactions, and approval. The [code implementation plan](2026-09-08-code-implementation.md) consumes that handoff after the user approves it.

**Tech Stack:** Paper MCP, native Paper tokens, incremental HTML/flexbox design nodes, SVG icons, Markdown/JSON handoff artifacts. No website framework or backend is implemented in this phase.

**Spec:** [Approved product specification](../specs/2026-09-08-wotlk-droptimizer-design.md).

## Global constraints

- "All three are initially free and anonymous."
- "Free tools must remain usable without sign-in."
- "The first public release covers every DPS specialization supported by the pinned simulator."
- "Owned items retain their existing enhancements, including empty sockets and missing enchants."
- "Evaluate one new drop independently at a time. Never sum gains to predict a complete future set."
- "Boss selection specifies loot source, not a promise to reproduce that boss's encounter mechanics."
- Design Top Gear, Boss Droptimizer, and Raid Droptimizer. Do not add account onboarding, billing, talent optimization, cap optimization, or retail systems.
- The approved spec's dark WotLK direction takes precedence over Paper's generic light-mode default. Visual details remain subject to refinement.
- Paper-first is an explicit user requirement. Do not scaffold the application, install its dependencies, build the simulator, or deploy workers during this plan.
- Design figures are illustrative, never presented as actual simulation evidence.

## Deliverables and stable references

Use the user-created **WoW Droptimizer** file, ID `01M20P4F8A377J1GT1GGCM3K1Z`. This explicit user selection supersedes the original proposed file name. Do not modify or clone unrelated files. Actual screen references are recorded in `docs/design/screens.json`.

Create these repository artifacts during design execution:

| Path | Responsibility |
| --- | --- |
| `docs/design/brief.md` | Visual direction, audience, source references, agreed vocabulary |
| `docs/design/screens.json` | Stable screen keys mapped to actual Paper file/page/artboard IDs and URLs, widths, state, and revision |
| `docs/design/tokens.css` | Exact approved Paper tokens, exported as Tailwind v4 theme CSS |
| `docs/design/fixtures.json` | Consistent fictional character and result values used across screens |
| `docs/design/interactions.md` | Transitions, validation, focus, disclosure, and responsive behavior by screen key |
| `docs/design/review-log.md` | Dated user feedback and disposition, plus visual-review verdicts |
| `docs/design/handoff.md` | Reading order, component mapping, asset provenance, approved revision |
| `docs/design/approval.json` | Explicit approval status, revision, date, and user approval message |
| `docs/design/exports/` | Named PNG exports and reference JSX for approved screens/components |

Paper IDs must be obtained from tool responses. Do not invent URLs or IDs. The code plan references screen keys below until D8 records their real Paper references. This is a dependency contract, not permission to code from an unfinished design.

Screen record shape:

```ts
type ScreenRecord = {
  key: string;
  fileId: string;
  pageId: string;
  artboardId: string;
  url: string;
  width: number;
  revision: number;
  state: 'draft' | 'reviewed' | 'approved';
};
```

## Paper execution protocol

Before editing, load `get_guide({topic:"paper-mcp-instructions"})`, read the current tool schemas, then use `get_basic_info` and `get_selection`. Reuse existing project tokens where present. Call `get_font_family_info` before the first typographic styling. Post the design brief before any mutation.

Create sections incrementally: one visual group per `write_html` call, usually fewer than 15 HTML lines. Use inline styles, flexbox, padding, and gap; Paper does not support grid, HTML tables, or margins for these layouts. Use `layer-name` for identifiable components. Clone repeated nodes with `duplicate_nodes` or `x-paper-clone`; prefer targeted `update_styles` and `set_text_content` to rebuilding artboards.

After every completed section, call `get_screenshot` at scale 1, evaluate spacing, typography, contrast, alignment, artboard fit, and repetition, and record a one-line verdict. Fix defects before moving on. After three repeated rows inspect fixed icon/action lanes. If content clips, set artboard height to `fit-content`. Leave at least 80px between artboards. Call `finish_working_on_nodes` at the end of every editing session, including before waiting for user feedback.

Use actual MCP operations, for example after D1 has obtained `fileId` and the created artboard ID has been assigned to `artboardId`:

```js
await tools.mcp__paper__create_artboard({
  fileId,
  name: 'TG-SELECT.desktop',
  styles: {width:'1440px', height:'1000px', display:'flex',
    flexDirection:'column', backgroundColor:'var(--color-canvas)'}
});
await tools.mcp__paper__write_html({
  fileId, targetNodeId: artboardId, mode:'insert-children',
  html:'<header layer-name="Tool header" style="display:flex;align-items:center;justify-content:space-between;padding:24px 32px"><h1 style="font-family:var(--font-display);font-size:32px;line-height:40px;color:var(--color-text)">Top Gear</h1><span style="font-size:14px;line-height:20px;color:var(--color-muted)">No account needed</span></header>'
});
await tools.mcp__paper__get_screenshot({fileId,nodeId:artboardId,scale:1});
```

Do not treat this example header as an approved component. Implement the selected direction and use returned node references. Paper artboards demonstrate states; interaction annotations describe behaviors that static Paper nodes do not execute.

## D1. Establish the brief and project canvas

**Files:** Create `docs/design/brief.md`, `docs/design/screens.json`, `docs/design/fixtures.json`, `docs/design/review-log.md`, `docs/design/approval.json`.

**Consumes:** Spec §§1–5 and its Raidbots observation notes. **Produces:** dedicated `fileId`, initial pages, mood/type/palette brief, consistent sample values, pending approval record.

- [ ] Read the spec and both implementation plans. Preserve the sequence: Paper design → refinement → explicit design approval → code.
- [ ] Inspect Paper context read-only. Use `list_files` to find the project file; create it with `create_file({name:"WotLK Droptimizer — Product Design"})` only if absent. Capture the actual response references.
- [ ] Create pages named `00 Direction`, `01 Components`, `02 Desktop`, `03 Mobile`, and `04 States and Handoff`. A page creation/open changes context; verify the active page before every artboard group.
- [ ] Post a brief with mood candidates **glacial**, **moonlit stone**, **armory**, and **instrument panel**. Start with **moonlit stone**: charcoal stone surfaces, pale ice detail, and restrained amber reward highlights. This avoids a decorative ice-fantasy skin while honoring the approved direction.
- [ ] Propose palette roles: canvas `#111518`, surface `#1B2227`, border `#3C4851`, text `#F1F5F7`, muted `#B2BEC7`, action `#9CD6F0`. Use amber only for semantic reward emphasis. Validate contrast during D2; these are starting values, not immutable approval.
- [ ] Check **Inter** and **Barlow Condensed** with `get_font_family_info`; if unavailable use an available neutral sans returned by the tool and record the choice. Propose body 16/24px, label 14/20px, section 24/32px, page 36/44px, display 48/56px; tabular numerals for DPS.
- [ ] Record fictional sample values: character `Aldren`, level 80 Fury Warrior; current 10,000 DPS; optimized owned 10,200; drop outcome 10,350. Top Gear gain is +200 (+2%); drop gain is +150 (+1.47%). Include a second illustrated drop +40, a near-tie, a no-improvement item, and one failed comparison. Use real item names only when verified against upstream data, with numeric gains labeled illustrative.
- [ ] Set approval status to `pending`, revision to 1, and approval message/date to null. Do not create an approved status from absence of feedback.
- [ ] Verify the file is dedicated to this project and initial documents agree; commit the documents with `docs: establish Paper design brief`.

## D2. Establish visual direction and reusable components

**Files:** Update `brief.md`, `screens.json`, `review-log.md`; create draft `tokens.css` and `interactions.md` under `docs/design/`.

**Consumes:** D1 brief and sample values. **Produces:** `FOUNDATIONS`, `COMPONENTS`, `TG-SELECT.direction`, `RAID-RESULT.direction` artboards.

- [ ] Create a foundation board with color roles, type hierarchy, spacing 4/8/12/16/24/32/48px, and corner radii 4/8/12px. Use measured contrast ≥4.5:1 for normal text and ≥3:1 for large text/UI boundaries; adjust the initial palette if needed.
- [ ] Create tokens through `create_tokens` with namespaces `--font-*`, `--color-*`, `--breakpoint-*`, `--container-*`, `--text-*`, `--font-weight-*`, `--tracking-*`, `--leading-*`, `--radius-*`, and `--spacing-*`. Body surfaces should not become a grid of decorative cards.
- [ ] Design the shared app header/tool tabs, compact character summary, preset selector, button variants, inline errors, status labels, and persistent run summary as separately named groups.
- [ ] Design item-row variants: equipped, bag, selected, excluded, locked, unknown, duplicate copy with different enhancements. Use a 40px fixed icon lane, flexible name lane, tabular DPS lane where relevant, and 44px fixed trailing-action lane. A text label accompanies color-based status.
- [ ] Design result-row variants: upgrade, effectively tied, no improvement, conditional redemption, and failed comparison. Distinguish uncertainty from failure and from zero gain.
- [ ] Build one representative desktop Top Gear selection and one raid result using these components. Start at 1440px width, maximum content width 1280px, 320px summary column, 32px gutter. Capture screenshots and fix section-level issues.
- [ ] Present this concrete visual direction for user refinement before producing the complete screen family. Record feedback; make targeted edits and propagate accepted changes into components/tokens. Call `finish_working_on_nodes` before yielding.
- [ ] Commit the documented direction after the user accepts it: `docs: record selected Paper visual direction`.

**Revision 3 refinement applies to D2–D8:** The latest direction boards supersede the earlier text-heavy layouts. Use actual Wrath item artwork from `docs/design/item-assets.json`; follow `wowhead-item-assets.md` for provenance and the future integration contract. Keep tool headings compact, selection rows mostly one line, report gear sets visual, and detailed assumptions behind disclosures. Preserve visible allowance counts, complete-set rankings, paired-slot labels, duplicate-enhancement identification, and accessible item details. Consolidate the older component-state board into this style before final handoff. Optional themed art must not compete with equipment comparison.

## D3. Design import and settings

**Files:** Update `screens.json`, `interactions.md`, `review-log.md`, `fixtures.json`.

**Consumes:** D2 components and accepted direction. **Produces:** `HOME.desktop`, `IMPORT.desktop`, `IMPORT-REVIEW.desktop`, `SETTINGS.desktop`.

- [ ] Design a concise home with the three tools and a shared import entry. No login button is required for launch; no artificial premium badge or price appears on the free raid tool.
- [ ] Design character export and optional bag export fields with `/wse` instructions, plus an advanced full simulator JSON/link option. Explain that a missing bag export limits owned gear to equipped items.
- [ ] Design import review with source labels **Imported**, **Preset**, and **Edited**, inventory counts, missing fields, and class/spec selection when ambiguous. An invalid equipped item blocks Run; an unknown bag item offers explicit exclusion with its reason.
- [ ] Add variants for incompatible expansion, malformed export, missing glyph/profession data, reimport replacing a bag snapshot, and a simulator profile with existing settings. Show empty sockets as real state, not missing import defaults.
- [ ] Design compatible preset menus and category-specific editing for encounter, rotation, buffs/debuffs, consumes, talents/glyphs, and spec options. Preserve imported values unless that category is explicitly changed. Preset equipment is never counted as owned.
- [ ] Annotate a transition matrix in `interactions.md`: source screen, trigger, destination/state, retained values, validation, and focus destination. Record that selecting a raid does not change encounter mechanics.
- [ ] Review each section in Paper, fix issues, and commit `docs: specify import and preset screens`.

## D4. Design gear and loot selection

**Files:** Update `screens.json`, `interactions.md`, `review-log.md`, `fixtures.json`.

**Consumes:** D3 imported-character context. **Produces:** `TG-SELECT.desktop`, `BOSS-SELECT.desktop`, `RAID-SELECT.desktop`, `TOKEN-OPTIONS.desktop`.

- [ ] Build Top Gear slot groups with selection/lock controls, scoped select-all/clear, selected-only filter, equipped/bag origin, duplicate quantities, and enhancement details. Show source inventory and search size in the run summary.
- [ ] Add paired weapon/ring/trinket states and a live free allowance meter with used/maximum work and gear-combination count. Show within-limit, exactly-at-limit, and over-limit states; block Run when over limit and offer selection/lock changes while preserving the import. Distinguish budget accounting from actual fight iterations. The provisional 300,000/5,000 example is subject to WotLK benchmarks. No presumed universal hit/expertise lock appears.
- [ ] Build raid/size/difficulty selection and boss selection; present unavailable catalog combinations as unavailable. Boss mode selects one boss, raid mode presents the full eligible catalog with explicit exclusions and coverage.
- [ ] Add slot/boss grouping, eligible-item inclusion controls, and new-loot gem/enchant setup with a per-item preview. Owned enhancements remain visibly unchanged.
- [ ] Build token alternatives showing the chosen reward, required prerequisite item/currency, owned versus unknown resource state, and the one-redemption rule. Show an incomplete recipe outside immediate-upgrade candidates.
- [ ] Annotate how each selection updates the summary and persists when switching tools. Use the same inventory, settings, and reference terminology in all screens.
- [ ] Review screenshots and commit `docs: specify equipment and loot selection`.

## D5. Design progress and result reports

**Files:** Update `screens.json`, `interactions.md`, `review-log.md`, `fixtures.json`.

**Consumes:** D4 submission states and D1 arithmetic. **Produces:** `JOB.desktop`, `TG-RESULT.desktop`, `BOSS-RESULT.desktop`, `RAID-RESULT.desktop`, `DROP-DETAIL.desktop`.

- [ ] Design progress phases **Queued**, **Finding your best owned gear**, **Comparing drops**, **Refining results**, **Complete**. Use actual completed counts; show an unknown completion time gracefully. Include report link, expiry, and owner-only cancel action.
- [ ] Design Top Gear as ranked complete combinations: current 10,000 → highest set 10,200, +200 (+2%), with several alternative sets, each set’s exact swaps, and a full-slot view. Include equipped reference, jump-to-equipped, gear differences versus equipped/top set, and reuse of a chosen set in Droptimizer. A 10,196 set with fewer changes can be recommended as a near-tie without changing exact rankings or the numerical equipped baseline. Show evaluated/refined/displayed counts and pagination for larger retained result lists. See the real Raidbots run recorded in `docs/design/raidbots-top-gear-observations.md`.
- [ ] Design boss and raid rankings against the shared optimized-owned baseline 10,200. The illustrated 10,350 outcome shows +150 (+1.47%), not +350. Include item/boss grouping, gains in DPS/percent, and catalog coverage.
- [ ] Design expanded drop details with before/after slots, enhancements, prerequisite consumption, set bonuses, relevant hit/expertise change, and the full equipment set. Label one-drop independence beside the report summary.
- [ ] Add report variants for provisional rows, one failed candidate, interrupted limited search, all no-improvement, unavailable uncertainty, zero baseline percentage, invalid/expired link, and canceled work. A failed row never displays zero gain.
- [ ] Annotate retry-failed-work behavior, preservation of completed results, read-only shared report behavior, and resimulate-with-new-settings creating a new report.
- [ ] Review screenshots and arithmetic, then commit `docs: specify comparison reports and job states`.

## D6. Resolve responsive layouts and accessibility

**Files:** Update `screens.json`, `interactions.md`, `review-log.md`.

**Consumes:** D3–D5 desktop screens. **Produces:** `.mobile` variants for IMPORT, IMPORT-REVIEW, SETTINGS, TG-SELECT, BOSS-SELECT, RAID-SELECT, TOKEN-OPTIONS, JOB, TG-RESULT, BOSS-RESULT, RAID-RESULT, DROP-DETAIL; `RAID-RESULT.tablet`; narrow stress variants.

- [ ] Build mobile screens at 390px; verify IMPORT and RAID-RESULT at 320px and 200% text-size treatment. Build a 768px tablet report. Use flexible heights, content wrapping, and a summary drawer instead of squeezing desktop columns.
- [ ] Convert rankings to readable stacked rows on narrow widths while keeping item name, source, gain, status, and detail action visible. Preserve right alignment only where there is space.
- [ ] Specify breakpoint transitions: below 768px one-column; 768–1023px condensed one-column summary; ≥1024px two-column workspace. Record changes if visual testing justifies different thresholds.
- [ ] Show focused import fields with keyboard space and the bottom action area. Annotate bottom padding and safe-area treatment so fixed controls never cover content.
- [ ] Document keyboard order, radio/checkbox semantics, disclosure focus, error summary links, and polite progress announcements. Paper static previews cannot prove live keyboard or screen-reader behavior; hand these requirements to code tests.
- [ ] Inspect long names, duplicated items, many bosses, empty lists, and slow/error states. Fix issues at the component level and propagate them to desktop where applicable.
- [ ] Commit `docs: define responsive and accessible behavior`.

## D7. Run the user refinement loop

**Files:** Update `review-log.md`, `screens.json`, `brief.md`, `interactions.md` and draft `tokens.css`.

**Consumes:** Complete D3–D6 screen family. **Produces:** reviewed design revision ready for final approval.

- [ ] Present the actual Paper link and a short guided sequence: import → Top Gear → boss comparison → raid comparison → expanded swap result → mobile. Use human-readable screen names in chat, not raw node IDs.
- [ ] Invite consolidated feedback on visual direction, density, navigation, and result clarity. Record requests individually with affected screen/component keys and accepted/revised disposition.
- [ ] Refine existing Paper nodes in place. Refresh screenshots after every changed section and update shared components, token exports, and affected responsive variants together.
- [ ] Walk the complete happy path and error states against spec §§2–9. Verify free tools and the initially free raid tool never require sign-in.
- [ ] Repeat review when requested until the user approves the refined experience. Distinguish approval of one screen from approval of the full set. Call `finish_working_on_nodes` at every pause.
- [ ] Commit `docs: record Paper refinement decisions` with the actual review revision.

## D8. Export the design contract and obtain final handoff approval

**Files:** Create `docs/design/handoff.md`; finalize `screens.json`, `tokens.css`, `interactions.md`, `approval.json`; export to `docs/design/exports/`.

**Consumes:** D7 reviewed Paper file. **Produces:** the approved design contract required by code task C0.

- [ ] Export exact tokens with `get_tokens({fileId,format:"tailwind"})`. Read `get_jsx` and `get_computed_styles` for key shell, item-row, result-row, summary, preset, and detail components; use `get_fill_image` for referenced images where needed. Do not estimate colors or dimensions from screenshots.
- [ ] Export reviewed artboards as PNG with names derived from stable screen keys; retain source JSX as reference rather than production-ready code. Record asset source/license and font availability. Do not add AI-generated imagery unless the user requests it.
- [ ] Populate every `screens.json` record with actual file/page/artboard references, width, revision, and state. Export files are named `docs/design/exports/<screen-key>.png` and component references `docs/design/exports/<component-key>.tsx` using actual registered keys.
- [ ] In `handoff.md`, map component names to future code components: AppShell, CharacterSummary, ImportPanel, PresetPanel, InventorySelector, LootSelector, TokenOptions, RunSummary, JobProgress, ResultList, and EquipmentDiff. Link source screens and list responsive/state requirements for each.
- [ ] Check that all planned screen keys exist, all paths resolve, sample numbers agree, and reviews have no unresolved blocking feedback. Record the six-part Paper screenshot verdict for each final screen family.
- [ ] Ask for approval of this specific refined revision before coding. Once the user explicitly approves, set `approval.json` to `{status:"approved", revision, approvedAt, approvalMessage, paperFileUrl}` using the actual revision, date, message, and URL. Otherwise retain `pending` and keep working only on design.
- [ ] Mark approved screen records accordingly and commit `docs: finalize approved Paper design handoff`. Finish Paper working indicators. Proceed to C0 only after approval.

## Completion checklist

- [ ] Editable Paper designs exist in the dedicated project file.
- [ ] Every core workflow has desktop/mobile designs, required exception states, and interaction annotations.
- [ ] Exact tokens, references, screenshots, and asset provenance are exported.
- [ ] User refinement feedback is resolved and final approval is recorded truthfully.
- [ ] No application, worker, billing, or deployment implementation occurred during this plan.

The user's requested next phase is design execution. The code plan remains dependent on D8; approving these plan documents does not approve visual designs that have not yet been created.
