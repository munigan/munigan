# Munigan design implementation

> Execute the approved design directly; preserve existing simulation and import behavior.

**Goal:** Ship the approved neutral-black Munigan Paper design across all existing app flows, with compositional Base UI primitives, Tailwind CSS 4, homepage SEO, Paper social artwork and a branded favicon.
**Architecture:** Shared semantic tokens and small UI primitives; feature orchestration retains domain state while presentation lives in focused components. Server-rendered marketing content remains separate from interactive tools.
**Tech:** Next.js 16.3, React 19, installed Tailwind 4.x, @base-ui/react.
**Spec:** User-approved Paper file 01M20P4F8A377J1GT1GGCM3K1Z, pages 7-0/8-0/9-0, latest neutral charcoal revision. User request in current conversation is authoritative.

## Global constraints
- Canvas #090A0C, surface #17191D, border #303238, text #F3F4F6, muted #A5A8AF, action/gain #78E34D, loss #F58D88, epic #D3AAEF.
- Open layouts: headings/summaries/sidebar content unboxed. Use charcoal surfaces for dense item tables, controls and dialogs. No green background panels.
- Munigan above Droptimizer in brand; logo has no hover effect. Green shield M symbol from Paper.
- Preserve full existing behavior: only equipped selected by default, 120 sets free limit, unsupported items collapsed and passive, original/Classic version selection, enhancement automation, pair deduplication, WoWhead tooltips, drafts, run recovery.
- Use Base UI for reusable button/dialog/tabs primitives. Use render composition; forward native props and refs. Keep native selects where migrating would risk data controls unnecessarily.
- Tailwind 4 already installed; use its tokens and utilities, do not downgrade 4.x.
- Desktop and mobile responsive; keyboard access, dialog focus trapping/restoration, reduced motion.
- No report data in SEO/sitemap. Homepage static indexable with canonical, OG and Twitter metadata. Reports noindex/nofollow/no-referrer.
- Do not deploy, push, or change simulator/domain/backend logic.

## Shared component contracts
Root provides src/components/ui/Button.tsx: Button with Base UI Button props plus variant primary|secondary|ghost|danger, size sm|md|lg; render prop supported, className optional. src/components/ui/Dialog.tsx exports DialogRoot, DialogTrigger, DialogClose, DialogTitle, DialogDescription, DialogContent. DialogContent includes Portal+Backdrop+Popup and accepts Popup props plus className. DialogRoot uses Base UI controlled open/onOpenChange. src/components/ui/Tabs.tsx exports TabsRoot, TabsList, TabsTab, TabsPanel using Base UI props. src/components/ui/layout.tsx exports PageHeading, SectionHeading, Surface (standard HTML props), and Eyebrow. Use children composition, not giant config objects. Root owns these files, app global tokens/styles, shell, home, SEO/assets. Feature implementer owns inventory/import/settings/reports only and colocated styling.

### Task 1: Foundation, homepage, branding and SEO (root)
- [x] Extract Paper JSX/style values and save source references in docs/design.
- [x] Install Base UI; add shared Button/Dialog/Tabs/layout primitives and matching tokens.
- [x] Replace shell and homepage with approved composition: LESS GUESS. MORE DAMAGE., translucent Icecrown art, ranked sample, three steps, final CTA/footer.
- [x] Create 1200x630 social artwork in Paper; export optimized PNG. Add centered dark-square favicon.
- [x] Add homepage metadata/canonical/schema, robots/sitemap, report noindex headers.
- [x] Verify server HTML/SEO, desktop/mobile rendering and primitive behavior.

### Task 2: Tool workflows (feature implementer)
Owned paths: src/features/inventory, src/features/import, src/features/settings, src/features/reports; related tests and new feature-local components/styles. Do not edit root-owned shared primitives/global styles/shell/home/app routes/package files.
- [x] Read current feature code, existing e2e tests and relevant local Next CSS docs.
- [x] Read exact Paper JSX and computed styles for desktop import 4E6-0, selection 4JG-0, settings 4P6-0, reports 6BT-0 and mobile 7BG-0/7GL-0/7JZ-0 (same file). Guide required first. Do not mutate Paper.
- [x] Split oversized orchestration/presentation components at meaningful seams. ReportView 966 lines should split loading/status, result summary, combination table and full gear dialog; import should split review/instructions; TopGearApp should extract run setup and allowance; settings should split dialog shell/navigation/content as useful. Keep domain logic intact and state ownership clear.
- [x] Adopt shared Base UI Button/Dialog/Tabs where useful. Remove redundant manual dialog focus/escape/backdrop handling after migration. Match shared contracts above.
- [x] Style all states with neutral palette and open layouts, small uppercase eyebrows, Barlow headings, green actions. Run sidebar unboxed with left divider desktop/top divider mobile. Rounded 1px item table outer borders, separators only between rows. Settings charcoal dialog with vertical navigation desktop and scrollable tabs mobile. Reports summary unboxed, ranked table bounded/rounded, green/red gains with arrows, equal item tile width.
- [x] Preserve accessible names where possible. Update existing tests only where intentional markup/visual semantics change, preserving their behavioral assertions.
- [x] Run focused UI/e2e checks for changed controls and typecheck. Report results, file map, concerns to docs/design/tool-workflows-implementation.md. Do not commit or spawn agents (root handles final review/integration).

### Task 3: Integrated verification and review
- [x] Run lint/typecheck/unit/UI tests and relevant e2e flows.
- [x] Production build and check server-rendered homepage/SEO/report noindex.
- [x] Inspect screenshots desktop/mobile for homepage, import, inventory, settings, report; correct layout issues.
- [x] Independent final review on changed files; resolve findings. Update this plan and component documentation.

Final verification: typecheck, lint, 77 unit/UI tests, 23 end-to-end tests (including real local DPS), production build, design contract and spec coverage all passed. Foundation and feature reviews have no open findings. Changes remain local and uncommitted; no deployment was performed.
