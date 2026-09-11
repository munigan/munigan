# DPS preset selector

Import review and the talent settings panel share `DpsPresetSelect`. Each choice shows the specialization icon, a readable build name, its talent point split, and a short explanation. The selected value keeps the icon, name, and point split; descriptions stay in the dropdown.

The presentation catalog covers all 40 shipped DPS presets across 10 classes. It expands abbreviations such as Frost BL to Frost/Blood, names meaningful weapon or talent variants, and retains phase labels where presets differ by progression. Labels and descriptions are available in English and Portuguese; WoW specialization and talent names retain their canonical English spelling.

Point totals are calculated from each preset's talent string rather than copied into display names. The three numbers always follow the class's in-game talent tree order, shown below the control. For example, Frost/Blood (15/56/0) uses Blood / Frost / Unholy order.

Names and descriptions were checked against the pinned `data/wotlk/presets.json`, `data/wotlk/talent-trees.json`, and their WowSims sources in `.cache/wotlk/ui/`. When updating the preset data, review the presentation mapping and descriptions too. Catalog tests check coverage, translations, unique labels, point totals, and tree order.

Icons are decorative, and options expose separate accessible names and descriptions. Keyboard selection and typeahead use the full readable label. Long selected labels wrap on narrow screens. The component preserves simulator IDs and the existing import and talent selection behavior.
