# Wowhead item artwork and tooltips

Verified on 2026-09-08. This is a design and implementation reference; no application integration has been built.

## What works

Wowhead documents an embeddable tooltip script, icon sizing, and item options including gems and enchants. The supported integration entry point is [Wowhead Tooltips](https://www.wowhead.com/tooltips), loading `https://wow.zamimg.com/js/tooltips.js`. Wrath links must use `https://www.wowhead.com/wotlk/item=ITEM_ID` rather than retail links.

Direct HTTP verification also returned status 200 and JSON from `https://nether.wowhead.com/wotlk/tooltip/item/50363`, including `name`, `quality`, `icon`, and `tooltip`. The icon was `inv_jewelry_trinket_04`. Its image, `https://wow.zamimg.com/images/wow/icons/large/inv_jewelry_trinket_04.jpg`, returned status 200 and `image/jpeg`. Additional items were checked and recorded in `item-assets.json`. These exact images now appear in Paper.

The JSON endpoint is observable infrastructure, not a versioned public API contract established by this research. Use it as optional metadata enrichment, with a cached manifest and fallback; do not make rendering or simulation depend on its availability. The documented tooltip integration is the preferable route for external rich tooltips.

## Application contract for the code phase

- Resolve artwork by expansion + item ID into a versioned icon manifest. Reuse icon URLs across duplicate item instances, but keep each instance's selections, gems, enchant, and slot identity separate.
- Render 40–48px item images in reserved boxes. Use quality borders, readable names, item levels, and explicit selection/slot labels. Supply accessible item names; a hover tooltip cannot be the only way to identify gear.
- On a missing image, retain the dimensions and render the slot fallback plus item name. An icon failure never makes an item ineligible or prevents a run.
- Keep imports, stats, restrictions, loot sources, and numerical tooltips authoritative to the pinned simulator and normalized inventory. Wowhead's Wrath Classic data is not proof of Warmane mechanics. Never feed its tooltip HTML or stats into the simulator.
- Load the optional Wowhead script once in a client boundary. For custom icon/name layouts, disable automatic renaming, recoloring, and icon insertion to prevent duplicated images or layout shifts. Pass only validated item, gem, and enchant identifiers through documented attributes. Do not insert the raw JSON `tooltip` HTML into our DOM.
- Verify Wrath gem/enchant options and dynamically added rows in the browser during implementation; documented options alone do not prove that every Wrath combination works. Local accessible item details remain available when the external script is blocked or fails.
- No per-row metadata requests, arbitrary user-provided image hosts, or bulk runtime scraping. Validate icon keys and use the fixed CDN host. Review provider usage terms before expanding the small design manifest into production data generation.

## Revision 3 visual use

Top Gear selection uses real item icons and one-line names; extra enhancements and lock controls move into item details/menus. The report previews all 17 gear slots and highlights changes. Ranked rows use changed-item icons with slot labels, preserving the difference between replacing trinket 1 and trinket 2. Selecting a row updates the complete set preview. Raid results show artwork, item, boss, gain, and an expandable swap row. Detailed assumptions and tier requirements live behind disclosures.

All character DPS numbers and fixed gear assignments are illustrative design fixtures, not simulations of this exact equipment. The icons are existing WoW artwork delivered by Wowhead/ZAM, not generated assets or artwork owned by this project.
