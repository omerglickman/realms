# Realms, Kings and Other Stuff — UI Design

**Version 1.7 — 2026-11-08 — Status: ACTIVE.** The look and the layout of the game's interface, as decided in Sessions 13–13f and built through Session 15. Read this whenever a session touches `src/ui/` or adds anything the player will see; amend it (with a dated entry in the change log) whenever a UI decision is made. DESIGN.md says what the game *is*; this document says what it *looks like*. Nothing here changes a game rule.

Omer's brief (2026-11-05): the bottom lines (funds, people, resources) always visible in a clear place that hides little of the map; everything else in hover summaries or modals that present resources, buildings, economic activity and demographics in an orderly, friendly way, with graphics; headers in a hand resembling Carolingian minuscule; a medieval palette. Design left to Claude; Omer amends.

---

## 1. Principles

1. **The map is the screen.** Chrome is one thin strip at the top (48 px) and one at the bottom (≈ 20 px). Nothing else is permanent.
2. **Three depths of information:** the *bottom lines* on the strip (always); a *hover card* for the thing under the cursor (one glance); a *ledger* (modal) for everything about a settlement, a cluster or the realm (reading). A number appears at the shallowest depth where it is useful and in full at the deepest.
3. **The map stays live under a ledger.** The backdrop only dims; clicking another settlement swaps the ledger. Esc, × or a click on empty map closes.
4. **Words in the game's voice, numbers tabular.** "hands", "spare hands", "private hands", "tithe", "the crown's money" — the terms of DESIGN.md's glossary; every number uses tabular figures and thousands separators.
5. **Explain on hover, not in the layout.** Explanations (what a building does, what a tile measures) live in tooltips; the layout shows names, numbers and state.
6. **One icon set everywhere.** A resource looks the same on the strip, in a ledger and on its hex (§4).

## 2. Palette

CSS variables in `src/ui/style.css` `:root`. Use the variables, never literals, so the palette can be retuned in one place.

| Role | Variable | Value | Used for |
|---|---|---|---|
| Parchment | `--parch` / `--parch-2` / `--parch-3` / `--parch-4` | `#ecdfc2` / `#e3d3ae` / `#d3bf95` / `#c2ab7c` | ledger and card backgrounds; darker steps for inputs, bar troughs, hover |
| Ink | `--ink` / `--ink-2` / `--ink-3` | `#2b1d12` / `#5a4632` / `#8a7658` | text; secondary text; dim labels and hints |
| Rule | `--rule` | `#b59a6c` | hairlines, table rules, borders inside parchment |
| Oak | `--oak` / `--oak-2` | `#4a2f1a` / `#6b4423` | headings in the script hand, borders of parchment panels, icon colour in ledgers |
| Leather | `--leather` / `--leather-2` | `#3a2314` / `#4d3220` | the top strip and its buttons |
| Vermilion | `--verm` / `--verm-2` | `#a8321e` / `#c94a33` | warnings, hunger, shortfalls, the active tab, the End-month seal |
| Lapis | `--lapis` / `--lapis-2` | `#2f4f7f` / `#4a6ea6` | links; the "private economy" / first series in bars |
| Verdigris | `--verd` / `--verd-2` | `#4f7a52` / `#6c9a6e` | good / positive, the Start action, built things |
| Gold | `--gold` / `--gold-2` / `--gold-3` | `#c7972b` / `#e5c466` / `#f3dc96` | accents: the strip's rule and icons, the project (under construction), the mid level of gauges |
| Map void | body background | `#221a12` | the space around the map |

Semantic use: green = good or available, gold = in progress or "watch", vermilion = bad or blocked, lapis = a link or the first data series, oak = structure. Never encode a meaning in colour alone — pair it with a word or a number.

Bar/stack series: `.c1` lapis, `.c2` verdigris, `.c3` gold, `.c4` oak, `.c5` vermilion, `.c6` parchment-4. Tier stacks use c4 → c1 from village to metropolis.

The map's terrain colours are untouched by this document (they live in `data/terrain.json`); faction colours come from `data/factions.json`.

## 3. Type

| Role | Font | Size | Notes |
|---|---|---|---|
| Script hand (headers, settlement names on the map, tab labels, cube names) | **Lugrasimo** (default) · *Uncial Antiqua* (alternative, chosen in Settings; stored in the browser) · Almendra kept as a third option | title 26 px, section 17 px, card/cube 14–16 px, map labels 13 px | Omer is deciding between Lugrasimo (closer to a Carolingian book hand, more legible) and Uncial Antiqua (more stylised); both stay (2026-11-06). The map labels follow the chosen hand (`setLabelFont`). |
| Body | **Alegreya** 400 / 700 / italic | 13.5 px in ledgers, 12.5 px in cards and tables, 11 px uppercase for small labels (letter-spacing 0.06–0.1 em) | numerals tabular (`font-variant-numeric: tabular-nums`) |
| Mono | Consolas / Courier | 11 px | the fps readout and `kbd` keys only |

All fonts are bundled in `src/ui/fonts/` (woff2, SIL OFL, licences alongside) and declared with `@font-face` in `style.css`, so `realms.html` works from disk.

## 4. Icons

One set, `src/ui/icons.ts`: original line glyphs on a 24 × 24 grid, 1.6-px round stroke, no fill, `currentColor` in the DOM. The same paths are rasterised for the map (`iconTexture`, 64-px textures, preloaded at startup). Omer's direction (2026-11-06): the simple-line, highly legible style of the strip's food / timber / stone icons is the style for everything.

| Group | Ids | Where |
|---|---|---|
| Bottom lines | `coin` `people` `wheat` `timber` `stone` `goods` | the strip, stat tiles, cost chips |
| Map resources | `game` (an antlered head) `stone` `iron` (an ingot) `fish` `furs` `salt` `wine` `silver` (a star in a circle) — the `icon` field of `data/resources.json` | on the hex as a **badge** (⌀ 0.92 hex): a resource that a settlement works ("tapped") is an ink icon on warm parchment `#f5e7c2` with an ink border; one nobody works yet is greyed — `#6b5f4e` lines on `#d9d2c3` (`MAP_BADGE` / `MAP_BADGE_IDLE`; the renderer is told the worked hexes and redraws the chunks that change). Same icons in the hex readout and the ledgers. The old coloured glyph is the fallback for a resource without an icon. |
| Settlement tiers | `village` (hut) `town` (houses + church) `city` (walls and towers) `metropolis` (towers around a spire) | the map **marker**: a disc in the faction colour (radius by tier: 0.42 / 0.60 / 0.78 / 0.95 hex, never under 5 screen px) with the icon in parchment on it (⌀ 1.6 × radius); hover ring white 70 %, selection ring white |
| **Units** (Phase 2; Omer 2026-11-07) | `settlers` (a covered cart) `workband` (crossed pick and shovel) `levy` (spear and round shield) — the `icon` field of `data/units.json`; later the Phase 4 roster | the map **unit marker**: a different shape from the settlement disc — a **heater shield** (pointed base) in the faction colour with an ink border and the icon in parchment, ≈ 0.55 hex tall, never under 7 screen px; standing on a settlement's hex it sits at the upper-left of the marker; a **group** (several units on one hex) is one shield with a small count. Selected: white ring; hovered: white 70 %. Same icons in the Recruitment cubes and the unit card. |
| Built on hexes | `mill` (house with a wheel) `wharf` (pier and boat) — and, for later, `castle1` `castle2` `castle3` (tower / tower with wall / keep), `station` (road station) | badge style, ⌀ 0.8 hex, offset to the upper right of the hex centre so a resource badge stays readable. A Mill is drawn on the settlement's worked **river** hex, a Wharf on its worked fishing hex (shore or lake first). Castles and stations are defined now and used when the entities exist. |
| Buildings | `granary` `chapel` `market` `workshop` `warehouse` `range` `stables` `drill` `walls` `barracks` `ironworks` `citadel` plus the tier icons for halls — the `icon` field of `data/buildings.json` | the building cubes |
| Interface | `hammer` `sun` `calendar` `hand` `scroll` `crown` `warn` `skull` `walk` `arrowUp` `cow` `deer` `house` `tree` `map` `gear` `book` `grid` `close` | stat tiles, warnings, job kinds (farm = wheat, herd = cow, fish = fish, hunt = deer, timber, stone) |

Adding an icon: draw it in the same grid and stroke, add it to `ICON_PATHS`, reference it by id from the data file; anything drawn on the map must be in the preload list in `app.ts`.

## 5. Layout and components

**The ledger strip** (`#topbar`, 48 px, leather, gold rule): brand and date · tiles **Treasury** (coins; net last year) · **People** (realm; growth last year) · **Food** (months of stock; starved) · **Stockpile** (timber · stone · goods on one line; caps or losses underneath) · End month (vermilion seal, script hand) · run N yrs · ☰ menu. Tiles have an uppercase 10.5-px label, a 15-px number, an 11.5-px subline (green up / red down); each has a tooltip (§5, tooltips) and opens the matching page of the realm ledger. Below 1440 px the sublines go, below 1200 px the labels and the title, so the strip never collides with the turn controls (the stockpile is one tile for the same reason).

**The status strip** (`#status`, bottom, translucent leather): the hovered hex (terrain, resource, coordinates, move cost, yields, who works it) · the last event · the run timing · the fps readout.

**Menu** (`#menu`): Realm ledger (K) · Edit map (E) · Start position · Bare map · New draft… · Settings… · Keys & help (?).

**Hover card** (`#popover`): parchment, a faction-colour left edge, name in the script hand, tier, people with trend, food months with a gauge marked at the 3-month reserve, land, tax, parent, cluster, project, harvest, warnings in vermilion; "click to open the ledger". Placed right of the marker, flipped left when there is no room.

**Ledgers** (`#modal`): 900 px wide (1040 for wide tables), parchment with an oak border and an inset gold rule, a faction-colour stripe by the title, the date at the right, tabs in the script hand (active one vermilion), a scrolling body that keeps its scroll position across the monthly re-render, an optional footer (the editor's name / people / remove controls).
- **Settlement:** Overview · People · Land & Food · Economy · Buildings · **Recruitment** (Phase 2; Omer 2026-11-07 — works and looks like Buildings, for units; below).
- **Cluster:** Overview (+ a **Leadership** block when several members share the top tier — Make leader / Split off, Session 15c) · Members · Food (**+ Send food** between members, Phase 2 — the Stockpile page's Send form reused for grain, member → member) · Stockpile.
- **Realm:** Overview · Clusters · People · Food · Treasury · Stockpile.
- Also: Settings (header hand), Keys & help, New draft (the generator form).

**Components** (all in `src/ui/panels/format.ts` and `style.css`):
- *Stat tile* (`.stat`): icon, uppercase label, 18-px number with a small unit, a subline, optional gauge. A page opens with a row of 3–5.
- *Gauge* (`.gauge`): 9-px bar, green / gold / red by level (< 34 % / < 67 %), thin ink marks for thresholds (the next harvest, the reserve).
- *Bars* (`.bars` + `.hbar`): label · bar · value rows for stock vs cap, people by tier.
- *Stack* (`.stack` + `.legend`): one 16-px bar of parts with a legend (where the hands go, the year's food flows).
- *Tables*: `table.kv` (label / value rows) and `table.data` (uppercase column heads, tabular numerals, right-aligned numbers, dotted row rules, nested rows indented by depth, tier glyphs before names).
- *Cards* (`.card`): used for the running project on the Overview page, and (Session 15b) the **upgrade card** — "Become a town / city / metropolis" with cost chips (lacking items in red), the gate, the reason or **Begin**; while rising, gold with progress, months left and Cancel; the title badge reads "Village → Town" and the hover card "Rising to".
- *Cubes* (`.cube`, Session 13b): the Buildings page — 128-px tiles with the icon, name (script), family (uppercase) and cost chips; order **built → under construction → available → unavailable**; built green with a staffing gauge, the project gold with a progress gauge and Cancel, available green-outlined and clickable (click = start), unavailable greyed. The description, full cost, months, hands and the reason live in the tooltip.
- *Recruitment cubes* (Phase 2): one cube per unit type the settlement can raise (settlers, work-band, levy; the Phase 4 roster later), ordered **mustering → available → unavailable**; a mustering party is gold with a Cancel (the people return); available green-outlined; unavailable greyed with the reason in the tooltip (no idle hands, no money, cluster lacks timber — "will come from the realm stockpile" is a notice, not a block). The tooltip carries the rule in words (who leaves, what it costs, upkeep). **Click opens the raise dialog** (a small modal over the ledger; built Session 15): **How many** — a slider (to three times the usual party, at least 3,000, never more than the pool) with the reckoning for settlers ("to work the land around the destination plus a hall and a granary takes 750 hands; at 62 % hands per head that is 1,210 people"); **Provisions** in months (default from the harvest calendar) with what leaves the granaries and the months to the harvest; **Destination** (optional: *Pick on the map* hides the ledger and the dialog, the status strip says what to click, hovering previews the route, a click sets it — the raising settlement's own hex means none — Esc goes back; the dialog then shows the walk in months and whether a village can be founded there, with a **village name** field); **Muster** rows last (the raising settlement first, then the cluster's members and own settlements within 3 hexes by distance: people, spare hands ≈ people, food months, a field each; the slider fills spare hands first); the footer carries the cost chips (coins, timber with the realm's share when the cluster is short, people, food, the tax dent in a town) and **Raise** (verdigris, script hand), disabled with the reason when the raise cannot be made. A mustering party's cube has **Cancel** (everyone and everything returns) — in the session it was raised in; after a reload the party simply forms.
- *Unit card* (Phase 2; built Session 15): clicking a unit marker opens a pinned card (the hover card's shape, faction-colour edge): type icon and name, people and hands, provisions in months with a gauge marked at the chosen months, home (a link), destination and months to arrival, state (mustering / marching / marching to settle / going home / blocked / arrived / foraging / waiting), warnings; actions **Move** and **Settle at…** (settlers; then click a hex — the route is previewed as a dotted white line with "N mo" and, for settling, "· settle" or the reason the hex refuses; a click orders, Esc cancels), **Settle here** (settlers, when the hex allows; disabled with the reason when not), **Build here** (work-bands; the road kind chosen in the select beside it — Dirt road / Paved road; disabled with the reason on a settlement's hex, water, or where the road already is), **Road to…** (a second click: the route is previewed as a dotted white line with "N hexes · ≈ M mo · timber + stone · bridges" or the reason it refuses, and the band lays the road hex by hex, bridges included) and **Bridge at…** (click a river hex beside the band) — Session 16; the card then shows *Building*, *Still to do* (jobs, bridges, months, materials) and *At work on* with a percentage, or *Unfinished* when an order was cancelled mid-project, **Disband** (into the settlement on the hex at once, or a walk to the nearest per DESIGN §3.2b; the tooltip names it), **Cancel order**. Esc or a click on empty map closes. Opening a unit card closes a settlement or cluster ledger, and opening a ledger closes the card — the two do not share the screen. The card sits right of the shield, or right of the settlement marker when the party stands on a settlement; it flips left when there is no room.
- *Age pyramid* (SVG): men lapis left, women vermilion right, working bands full, dependants faded.
- *Growth line* (SVG sparkline): people at each December, oak line over a light fill.
- *Harvest calendar*: twelve bars of monthly production, the current month outlined in vermilion, a dashed vermilion line for monthly consumption.
- *Hex table*: terrain chip (terrain colour), name, resource, yields, each job with its icon and "now / full" figures. **Omer 2026-11-07 (Session 15b):** worked hexes first (most food at the top), partly worked next with a gold "partly" tag, hexes nobody works last, faded, with a vermilion "not worked" tag; a job nobody works is greyed.
- *Buttons*: `.btn` parchment; `.btn.primary` verdigris, script hand (Start, Send, Go); `.btn.danger` vermilion outline (Cancel, Remove).
- *Tooltips* (`#tooltip`, `src/ui/panels/tooltip.ts`): one shared element; any element with `data-tip` and a hidden child `.tip` shows it below (or above) the element on hover. Parchment, gold top rule, a script-hand heading (`.tiph`).

**Editor** (`#editor`): a parchment drawer at the top right, 262 px, with the same buttons and tabs in the script hand; `body.editing` gives the map a crosshair cursor.

## 6. The map at different zooms

Camera zoom 1 ≈ one hex 42 px wide; the start position fits a 1500-px window at ≈ 0.43. Four levels (`src/ui/zoomLevels.ts`; Omer 2026-11-06):

| Level | Zoom | Shown |
|---|---|---|
| 0 | ≥ 2.0 | everything: all markers, all names, resource badges, hex badges (mill, wharf) |
| 1 | 1.0 – 2.0 | village names hidden |
| 2 | 0.6 – 1.0 | town names and village markers hidden too |
| 3 | < 0.6 | town markers, resource badges and hex badges hidden — only cities and the metropolis, with their names |

The hex grid hides below 0.5. Thresholds are starting values; tune them in `ZOOM_LEVELS`.

**Shoreline (Omer, Session 13d; IMPERIUM's construction, ported from its `collectShoreFringe`):** on every sea or lake hex, each edge that faces land carries a fringe drawn inside the water hex: a **light sand band** `#d9b16a` from the edge inward to 18 % of the hex radius, over a **darker tide band** `#b8894a` reaching 30 %, whose sea-side boundary **meanders** (a seeded sine, amplitude 5 %, zero at the vertices so neighbouring hexes agree). At each vertex a small bridge wedge runs to the adjacent edge at the same depth, so coves close and no blue crack opens at a corner. **Rivers (Omer, Session 13e)** are drawn as water too: the hex is filled lake-blue (the renderer overrides the data colour, which still serves the editor palette and the ledgers' chips) and its land-facing edges carry the same fringe in **grassland's colour** — the light band is grassland's terrain colour as read from `data/terrain.json`, the meandering inner band the same darkened by 22 % (`BANK_DARKEN`) — so a future grassland texture changes the banks in the same place. River–river, river–lake and river–sea edges get no fringe. The band depth is the sea's for now (Omer may tune it). Constants `SHORE_SAND` / `SHORE_BAND` / `SHORE_AMP` and the two colours at the top of `mapRenderer.ts`; the edge → neighbour mapping (`EDGE_DIR`) is derived from the hex geometry, never assumed. Drawn per chunk between the terrain fill and the grid; editing a hex redraws its neighbours' chunks too.

**Units on the map (Phase 2; Omer 2026-11-07; built Session 15).** Unit markers (§4) are drawn at every zoom level — at level 3 as plain shields without the icon — above the settlement markers; one shield per occupied hex, with a count when several parties share it. **Movement is animated:** at End month a shield **glides from hex to hex along the path it walked**, ≈ 120 ms a hex with ease-in-out, all moving units at once; Run years animates nothing (markers jump). The camera does not follow. A unit with a standing order shows its remaining path as a dotted ink line with a ring on the destination while selected; a unit that cannot move (blocked, no route) shows a small vermilion dot at the shield's upper right. A party mustering (raised, not yet departed) is drawn on the settlement's hex at 60 % opacity until it forms. Hovering a shield takes the hover from the settlement under it; the status strip names the parties on the hovered hex.

Other map marks (unchanged from Sessions 7–10): influence zones as a light faction fill with a solid border; cluster outlines inset and lighter; the hovered / selected settlement's worked hexes outlined white with its influence edge dotted; in settle mode every worked hex hatched.

**Roads and bridges on the map (Session 16):** drawn by `render/infraLayer.ts` between the terrain and the settlement layer. A road is a ribbon from hex centre to hex centre between two *linked* hexes (both built, or one a settlement's hex — a settlement counts as a dirt road): a **dirt road** a brown ribbon (`#8a6238`) with a thin ink casing; a **paved road** a pale stone band (`#c9c1ad`) with dark edges (`#5a5246`) and a heavier casing; a **bridge** a tan deck (`#c8a266`) with a heavy ink casing along the road through the river hex. An unlinked road hex is a dot. Line weights are in world units scaled by `1/√zoom` (0.55–1.6×) so a road stays a thin line when zoomed out and does not fatten when zoomed in. The hex's status-line text names a road or bridge on it. Build previews reuse the unit route preview (dotted white line, label at the end).

## 7. Open UI questions

- The unit marker shape: a heater shield (built in Session 15) is Claude's proposal for "a shape different from the discs"; Omer may prefer a banner or a pennant.
- Whether the unit card may close the settlement ledger (Session 15: it does, so the card is never hidden under the modal).
- The raise dialog's muster list at a metropolis (22 rows): keep, or default to members within reach only.
- Modals vs side panels for the settlement ledger (Omer to say after playing).
- The script hand: Lugrasimo or Uncial Antiqua.
- A per-faction palette for the six factions (Phase 5).

---

## Change log

- 1.7 (2026-11-08, Session 16): §5 the work-band's unit card (Build here with a road-kind select, Road to…, Bridge at…, the Building / Still to do / At work on / Unfinished rows); §6 roads and bridges on the map.
- 1.6b (2026-11-07, Session 15c): §5 the cluster ledger's Leadership block.
- 1.6a (2026-11-07, Session 15b): §5 the upgrade card; the hex table's worked-first order and idle marks (Omer).
- 1.6 (2026-11-07, Session 15): the Phase 2 UI as built — §5 the raise dialog's final layout (size → provisions → destination → muster), the unit card's states and the card/ledger exclusion, Cancel of a muster; §6 one shield per hex with a count, the vermilion dot, the preview line; §7 two questions added.
- 1.5 (2026-11-07, Session 13f): Phase 2 UI decided ahead of building — §4 unit icons and the shield marker; §5 the **Recruitment** tab as cubes with a raise dialog (size, muster, provisions, destination), the unit card and its orders, Send food in the cluster ledger; §6 units at every zoom, the gliding movement animation.
- 1.4 (2026-11-07, Session 13e): §6 rivers drawn as water with grassland banks.
- 1.3 (2026-11-06, Session 13d): §6 the shoreline fringe on water hexes that touch land (IMPERIUM's two-tone meandering construction).
- 1.2 (2026-11-06, Session 13c): iron is the ingot, silver a star in a circle, a simpler fish and an antlered head for game (Omer); map resource badges distinguish tapped from untapped.
- 1.1 (2026-11-06, Session 13b): §4 the icon set extended to every resource, the tiers, mill / wharf on hexes, future castles and stations, the buildings; map resources as badges, tier icons on faction discs; §5 the stockpile tile, the responsive strip, the shared tooltip, the building cubes; §6 the four zoom levels; §3 both hands kept.
- 1.0 (2026-11-05, Session 13): first version — the Session 13 overhaul as built.
