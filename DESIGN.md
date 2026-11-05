# Realms, Kings and Other Stuff — Design Contract

**Version 0.4d — 2026-11-05 — Status: DRAFT, core decisions made; see §5 for what is still open**

> **Model scale ×3 (DECIDED 2026-11-04, §5.8).** All people-counts in this document — hex yields, hands, building staff, settler and unit sizes, typical settlement sizes — are at the ×3 scale implemented in Session 6. The tier gates (town 1,500, city 6,000) were deliberately *not* scaled; the metropolis gate is 36,000.

Working title: **Realms, Kings and Other Stuff** (DECIDED 2026-11-03; may change later).

This document is the single source of truth for *what the game is*. Every future chat in this Project reads it before doing anything.

## How to read this document

- **Roles.** Omer is the designer and creative director and has final say on all design questions. Claude implements. Claude may propose, never decide.
- **DECIDED** — comes from Omer's brief or a later explicit decision. Does not change without Omer saying so, in writing, in a chat. When it changes, the change is recorded here *and* in DEVLOG.md.
- **PROPOSED** — Claude's suggestion, not yet accepted. May be implemented as a placeholder if the phase needs *something* there, but must stay easy to change, and the DEVLOG must say it is a placeholder.
- **OPEN** — a question that needs Omer's answer before the phase that depends on it.
- Numbers marked *(draft)* are starting values for tuning, not design commitments.

Companion documents: **ROADMAP.md** (how and in what order we build it) and **DEVLOG.md** (what has actually been done — findings, measurements and implementation notes live there, not here). This document states the rules; numbers in `data/*.json` are the live values.

---

## 1. Vision

A turn-based grand strategy game on a large hex map, set in an original medieval-ish world. The player leads one faction among several, competing for land, people and food, with the goal of conquering, subjugating or clienting every other faction. The game borrows the map-and-settlements skeleton of Civilization-style games but replaces technology research with **economic and organizational development**, and puts **population and food** — not abstract production — at the centre of the economy. Characters give the faction a human face; the player's own ruler is one of them.

### Design pillars (DECIDED — derived from the brief)

1. **The land feeds everything.** Population, food, working hands and recruits are one connected system. Everything the player does — building, levying, raiding, growing a city — pushes on it somewhere.
2. **People, not technology.** A faction advances by organizing itself better (institutions, policies, laws, bureaucracy, infrastructure), not by discovering things. Invention exists only at the margins.
3. **Few cities, many villages.** Cities are engines of wealth and culture but cannot feed themselves. A flourishing faction is a web of villages around a small number of towns and cities.
4. **War has a demographic cost.** Armies are made of people drawn from somewhere. Levies empty fields; raids leave scars that last for years.
5. **Characters personalize the faction.** Governors, commanders, ministers and the ruler are individuals with skills, traits and lifespans, and the player's choices about *who* matter.

### Victory (DECIDED)

A faction wins when every other faction has been **conquered**, **subjugated** or made its **client**.

*(PROPOSED for later: an optional turn limit with a score, so a game can also end "on points"; not needed for the first playable version.)*

---

## 2. World and map

### 2.1 The hex map (DECIDED)

- The game is played on a hexagonal grid. Each hex has exactly one terrain type.
- We start with **one hand-edited test map**. Procedural generation is a later goal.
- The game must include **map editing tools** from the start so Omer can revise the map himself.

### 2.2 Map size (DECIDED 2026-11-03)

- The engine is **built to support 400×250** hexes.
- The first test map is **about 160×100 (≈16,000 hexes)**.
- The editor includes a **crude noise-based draft generator** from the first phase. It is *not* the real procedural generator — it only produces a plausible starting canvas that Omer then edits by hand.
- **The starting canvas (DECIDED 2026-11-04):** generator seed `vinral`, 160×100, 2 continents, 6 islands, 45 % land — frozen as `maps/testmap.json`. From now on **the file is the map**: the game opens on it, the editor works on it, and the generator is only for making *new* drafts (so later changes to the generator never alter the test map).

### 2.3 Terrain types (DECIDED list, PROPOSED properties)

| Terrain | Move cost *(draft)* | Base food *(draft)* | Notes |
|---|---|---|---|
| Plains | 1 | 2 | Open, good for farming and cavalry |
| Grassland | 1 | 3 | Best farmland |
| River | 1 | 4 | Grassland crossed by a river. Watermills possible. Bonus to trade. |
| Hills | 2 | 1 | Defensive bonus. Stone/iron more likely. |
| Mountains | impassable *(or 4)* | 0 | Blocks movement unless a pass/road exists. Iron, silver. |
| Woodland | 2 | 1 | Light wood. Timber. Furs. |
| Forest | 3 | 0 | Dense. Timber, furs. Slows armies, hides raiders. |
| Tundra | 2 | 0 | Furs. Harsh winters. |
| Swamp | 3 | 0 | Disease risk for armies. Peat/salt. |
| Lake | impassable | 0 | Fish for adjacent settlements. |
| Sea | impassable (naval later) | 0 | Fish and sea trade for coastal settlements. |

**Desert** does not exist for now (Omer, 2026-11-05); perhaps in a future iteration if the world gets a hot south.

PROPOSED for later (not v1): river as an *overlay* on any terrain (so rivers can cross hills or woodland) instead of a terrain type. For v1, "River" is a terrain type exactly as in the brief.

### 2.4 Scale and time (DECIDED 2026-11-03)

- **One turn = one month. Twelve turns = one year.** Seasons fall out of this: harvest arrives in the autumn turns, winter imposes attrition on armies in the field, aging and the yearly demographic update happen at year's end.
- **One hex ≈ 15–20 km nominally**, but this is flavour, not a simulation target: we are not simulating Earth. **Movement rates are tuned for fun**, not for geographic realism. Starting values *(draft)*: army on a road ~6–8 hexes per month, off-road 3–5, less through forest/swamp.

### 2.5 Fog of war — PROPOSED

Hexes are *unknown*, *explored* or *visible*. Settlements and units see 2 hexes *(draft)*; hills and watchtowers see further. The AI does not cheat on visibility in principle, but may in early phases for simplicity (this must be flagged in DEVLOG if so).

---

## 3. Entities on the map

### 3.1 Terrain yields and resources (DECIDED concept; numbers draft)

**Terrain yields (DECIDED 2026-11-04).** Soil fertility, pasture and timber are **properties of the terrain**, not resources on the map. Each terrain has a yield on a 0–4 scale (none / low / medium / high / very high) in `data/terrain.json`:

| Terrain | Fertility | Pasture | Timber | Status |
|---|---|---|---|---|
| Grassland | very high (4) | low (1) | — | fertility per Omer; pasture draft |
| Plains | high (3) | high (3) | — | per Omer |
| Hills | medium (2) | medium (2) | low (1) | per Omer; timber draft |
| Woodland | medium (2) | low (1) | medium (2) | per Omer; pasture draft |
| Forest | low (1) | — | high (3) | timber per Omer; fertility draft |
| River | very high (4) | low (1) | — | draft (as grassland) |
| Tundra | — | low (1) | — | draft |
| Swamp | low (1) | — | low (1) | draft |
| Mountains, Lake, Sea | — | — | — | — |

**Map resources (DECIDED concept, list PROPOSED).** Resources are features that spawn on hexes with a probability that depends on terrain; a hex has at most one. They are drawn from by the settlement whose work zone covers the hex, some only after a work-band builds an extraction site (mine, quarry, lumber camp). Current table (`data/resources.json`; per-hex chance by terrain; spacing rules thin these out):

| Resource | Spawns on | Gives (draft) |
|---|---|---|
| Game | Forest 15% · Woodland 8% · Hills 3% | food (hunting) |
| Stone | Mountains 11% · Hills 9% · Plains 0.8% | stone |
| Iron | Mountains 8.5% · Hills 4.5% | iron |
| Fish | Lake 22% · Sea 9% (coastal only) · River 3.5% | food |
| Furs | Tundra 12% · Forest 6.5% · Woodland 3.5% | trade goods |
| Salt | Swamp 11% · Hills 1.8% · Tundra 1.5% | trade goods, preservation |
| Wine | River 4.5% · Hills 3.5% · Plains 1.2% | luxury |
| Silver | Mountains 2.8% · Hills 0.5% (min 4 hexes apart) | money |

**Water hexes are workable (DECIDED 2026-11-04).** Lake, River and **shore** hexes (a sea hex with at least one land neighbour) in a settlement's work zone yield food from fishing: **225 people fed per year for 30 hands** *(draft)*; with a Fish resource **450 for 90 hands**. Sea hexes that touch no land are *offshore* and need a port (below). River hexes keep their farming yield as well (fertility 4), so a river hex is the richest in the game — intended, to pull settlement toward rivers and coasts (confirmed by Omer 2026-11-05). Water hexes carry no pasture.

**Game vs Furs (DECIDED 2026-11-04):** both stay — Game is food (hunting), Furs a trade good. **Horses are not a resource (DECIDED 2026-11-04):** mounted units need **access to a pasture-bearing hex**, in the settlement's zone or via a road to a settlement that has one. **Offshore fish (DECIDED 2026-11-04):** hand-placed sea hexes away from the coast, workable only with an improved port (a later building). The test map's resources are placed in the editor and live in the map file.

### 3.2 Units (DECIDED concept, PROPOSED roster)

Units are mobile entities belonging to a faction. **Every unit carries population** (people with a demographic profile) that was drawn from a settlement and returns to one when the unit is disbanded or settles.

Unit families:

- **Settlers** — found a new village. Carry ~600–1,200 people *(draft, ×3 scale)*.
- **Work-bands** — build infrastructure outside settlements (roads, forts, mills, extraction sites). Carry ~150–300 people *(draft, ×3 scale)*.
- **Military units** — see §4.6. Each has a size (people), demographic requirement (e.g. men 15–44), source (village levy vs. city militia vs. professional), upkeep, and facility requirements.
- *(later)* **Caravans / envoys / ships.**

**Grouping (DECIDED):** units on the same hex can be joined into a **group** that moves and acts as one — e.g. military units escorting settlers, or several military units forming an *army*. A group moves at the speed of its slowest member and may have a commanding character.

### 3.3 Settlements (DECIDED; zones and tiers DECIDED 2026-11-04)

Four tiers: **Village**, **Town**, **City**, **Metropolis**. Every settlement has two distinct zones (DECIDED 2026-11-04):

- **Work zone** — the hexes the settlement's own hands extract from (food, timber, stone…).
- **Influence zone** — does three things: (1) **surplus flows up** — villages send their surplus to the town or city they are subordinate to, towns likewise to a city; (2) **bonuses trickle down** — administrative, organizational and cultural effects of a higher tier reach every lower-tier settlement in its zone (details in the Government & Institutions session); (3) **borders** — the realm's territory is the union of its settlements' and forts' influence zones. A village's zone trickles nothing down, so its two zones coincide.

| | Village | Town | City | Metropolis |
|---|---|---|---|---|
| **Gate** (population needed to upgrade *to* this tier; DECIDED §5.8) | — (founded by settlers) | **1,500** | **6,000** | **36,000** |
| Typical size *(draft, ×3 scale)* | 900–2,100 (plateaus ~2,100 when its land is full) | ~10,000 alone, ~18,000 with villages | 18,000–33,000 depending on the orbit's land | 36,000+ (needs food by road) |
| **Work zone** | 1 ring (7 hexes) | 2 rings (19) | 2 rings (19) | 2 rings (19) |
| **Influence zone** | 1 ring (7) | 3 rings (37) | **5 rings (91)** | **6 rings (127)** |
| Food | Surplus | Balanced alone; ~18,000 with ~6 villages | Own land feeds ~8,500; an orbit of up to ~24 villages holds ~25,000–28,000 (headless, average land); beyond that needs roads | Orbit feeds more; exact ceiling TBD |
| Economy / culture | Little | Moderate | Large | Largest; unique features (TBD) |

*(Why: a 7-hex village zone cannot sit inside a 2-ring influence zone without most of its fields being the town's; with town influence 3, six villages fit. City influence 5 rings and the metropolis gate were chosen by Omer after the A/B test of 2026-11-04 — DEVLOG Session 5c.)*

**Abandonment (DECIDED 2026-11-05):** a settlement whose population falls below a threshold (30 people, draft, `data/settlements.json` `abandonment.abandonBelow`) is removed at the end of that month; whoever is left walks to its parent, its granary is lost, and the event is logged. *(PROPOSED for later: an "abandoned village/town/city" entity with 0 population that marks the site and makes resettling easy.)*

**Cluster (DECIDED 2026-11-05, Omer's concept):** a cluster is an **unparented settlement together with every settlement subordinate to it, transitively** (its towns, their villages, its own villages). A lone village is a cluster of one. Food flows only inside a cluster, so the cluster is the real demographic and food unit of the realm; it is also the natural unit for the tithe (§4.2), for future provinces, governors and public order. It is a **derived view**, never stored — computed from the parent links, so it cannot drift from the subordination rule. A town under a city is a member of the city's cluster, not a cluster of its own. UI: a cluster outline on the map, a cluster panel (people by tier, the year's food balance, tithe, migration, hunger, members); the realm report is the sum over clusters.

**Contested hexes (DECIDED 2026-11-04):** each hex is worked by exactly one settlement. Where work zones overlap, the **higher tier wins**; ties go to the nearer centre; the player may reassign any hex by hand.

**Subordination (DECIDED 2026-11-04):** a lower-tier settlement is subordinate to ("parent") the settlement whose influence zone covers its centre. If several qualify, default to the highest tier, then the nearest; the player can choose the parent explicitly. Surplus and migration go to the parent.

**Metropolis (DECIDED 2026-11-04 as a tier; prerequisites accepted as a draft by Omer 2026-11-05, to be revisited when roads exist):** a city of 36,000+ may be upgraded to a metropolis — 6 rings of influence and features to be defined. It must be rare and require roads and good land. Prerequisites *(draft)*: population ≥ 36,000 for 3 consecutive years; a paved road to at least two towns; an institution from §4.3 (e.g. Chancery). A city's own orbit holds ~25,000–33,000 without roads, so the rarity is built into the geometry.

Other details:

- Overlapping influence zones between factions are **contested** territory — a source of diplomatic friction and a trigger for border events. *(PROPOSED)*
- **Where a settlement may stand (PROPOSED, implemented as placeholder in Session 7):** any passable land hex (not water, not mountains), not already occupied. Placing inside a higher tier's work zone is allowed — the contested-hex rule simply leaves the new settlement fewer hexes, and the editor warns.
- **Growth between tiers is a player decision**, not automatic: upgrading requires a population threshold, money, materials, and enough **administrative capacity** (§4.3). This is how "few cities, many villages" is enforced softly. *(DECIDED concept)*
- **Buildings need hands (DECIDED 2026-11-04).** Buildings are staffed from the settlement's working hands before any hand goes to the fields; staffing is linear (half staff = half effect). Every settlement has from its founding a **hall** (village: *Moot Hall*; town: Town Hall; city: City Hall; metropolis: *Great Hall* — names DECIDED 2026-11-05) that cannot be demolished and a **Granary**; hands *(draft, ×3)*: hall 30 / 150 / 300 / 600, granary 90 / 180 / 360 / 720. The hall is where government happens; an understaffed hall penalizes tax and order. Hands not needed by buildings or fields are, in a **village**, *spare hands* (the crowding pool, the builders and gatherers, later the levy pool); in a **town, city or metropolis** they are **private hands** (§4.2b).

**Buildings the player builds (DECIDED 2026-11-05; names and numbers draft, in `data/buildings.json`).** A settlement builds **one project at a time**, chosen by the player from the list its tier allows. Every building costs **money + labour + materials + time**: queuing a project pays its money from the faction treasury and its timber and stone from the cluster's stockpile at once (§4.2); construction then takes months and is done by the settlement's spare or private hands — fewer than the project wants means proportionally slower building, and in a town or city the hands on the site pay no tax while they build (§4.2b). Some buildings need a particular hex in the work zone (a river for the Mill, a shore/lake/river for the Wharf, pasture for the Stables — the §3.1 horses rule). Effects scale with staffing. The player can cancel a project for a full refund (draft). The AI will issue the same command in Phase 5.

| Building | From tier | Hands | Cost (coins · timber / stone) | Months | Effect *(draft)* |
|---|---|---|---|---|---|
| Mill | village (river hex) | 30 | 2,000 · 90 / 30 | 6 | +15 % farming output |
| Fishing Wharf | village (shore hex) | 60 | 2,000 · 120 / 0 | 6 | +50 % fishing; later the port for offshore fish |
| Chapel | village | 30 | 1,500 · 60 / 90 | 9 | +5 order — recorded only until §4.4 exists |
| Great Granary | town | 180 | 4,500 · 240 / 120 | 12 | +12 months of granary capacity, spoilage halved |
| Workshop | town | 30 | 4,000 · 180 / 90 | 9 | multiplier on the private economy: +50 % goods per private hand |
| Market | town | 30 | 3,000 · 120 / 60 | 6 | sells 60 % of the cluster's goods a year — **the only way goods become money** (Omer, Session 12c) |
| Warehouse | town | 30 | 3,000 · 150 / 60 | 6 | the cluster's stockpile cap +900 timber / +450 stone / +450 goods |
| Archery Range | village | 15 | 1,500 · 90 / 0 | 4 | **military (Omer)** — unlocks archers in Phase 4 |
| Stables | village (pasture hex) | 30 | 2,500 · 120 / 0 | 6 | **military (Omer)** — unlocks mounted units in Phase 4 |
| Drill Yard *(PLACEHOLDER name)* | village | 15 | 1,500 · 90 / 30 | 4 | **military (Omer)** — trains melee levies, Phase 4 |
| Palisade / Walls / Barracks / Ironworks / Citadel | village / town / town / city / city | 0 / 0 / 60 / 300 / 150 | 2,000 · 180/0 · 12,000 · 120/600 · 4,500 · 180/180 · 9,000 · 300/300 · 30,000 · 300/1200 | 6 / 24 / 12 / 18 / 36 | data only; effects come with Phase 4 |

Buildings for the professional army come later (Omer). Cathedral, School, Guildhall, Mint, Great Market, Inn remain PROPOSED for the institutions session (§4.3). **Money costs (DECIDED by Omer 2026-11-05, Session 12c): five times the first draft** — a town of ~10,000 affords a modest building every 2–3 years from its own tax, and the realm's whole income buys a few a year; the sinks to come (upkeep, institutions, characters) will tighten it further. The Workshop is a multiplier on the private economy, not an employer; the **Market is the only way goods become money** (§4.2b).

### 3.4 Infrastructure and buildings outside settlements (DECIDED concept)

Built by work-bands, costing money, materials and turns:

- **Roads** of varying quality — PROPOSED: *track* (free, appears with use), *dirt road*, *paved road*. Affect movement, trade and food transport.
- **Road-stations** (inns/relay posts) — PROPOSED: extend the distance over which food and trade move without loss; improve army supply.
- **Watermills** — on River hexes; boost food/goods of the owning settlement.
- **Forts** — garrison point, zone of control, protect villages from raids.
- PROPOSED: **Bridges** (river crossings), **mines/quarries/lumber camps** (unlock a resource hex), **watchtowers** (vision).

---

## 4. Systems

### 4.1 Demographics (DECIDED concept; cohort model and starting numbers approved 2026-11-04)

The world contains a fixed, countable population: the sum of everyone in every settlement and unit. Each settlement and unit has a demographic distribution that drives births, deaths, working hands and recruits.

**Cohort model (DECIDED 2026-11-04):** population is stored as counts by *sex × age band* (0–14, 15–29, 30–44, 45–59, 60+) — 10 numbers per settlement or unit. The yearly update runs in December; hunger acts monthly. All rates live in `data/demography.json`; the values below are Omer-approved **starting values for tuning** *(draft)*, deliberately faster than medieval reality so a faction visibly changes over 20 years.

| | Starting value *(draft)* |
|---|---|
| Births per woman 15–44 per year, well fed | 0.18 (×1.15 in plenty — stock above a year's need; × food sufficiency of the year when hungry) |
| Deaths per year by band 0–14 / 15–29 / 30–44 / 45–59 / 60+ | 3 % / 1 % / 1.5 % / 3 % / 10 % |
| Aging | 1/15 of each 15-year band moves up each year |
| Working hands | everyone 15–59 (≈ 58 % of a settled population) |
| Recruitable | men 15–44 (by unit type, §4.6); taking them lowers working hands |
| Hunger (granary empty) | extra deaths that month = shortfall fraction × 5 % of population, children and 60+ hit twice as hard; order drops |
| Crowding (DECIDED 2026-11-04) | **villages only**: births × (1 − 1.0 × share of hands that are idle). A village whose land is full stops growing instead of starving, and settles with ≈ 28 % spare hands — its standing levy pool. Towns and cities are exempt: their idle hands are the workshop/recruit pool. |
| Net result | ≈ +1.1–1.6 %/year well fed → a village doubles in ~50–65 years; a village founded by 900 settlers crosses the 1,500 town gate ~30 years later and plateaus ~2,100 |

- **Raids and sieges** kill or carry off people, skewed toward the vulnerable or the able-bodied depending on the attacker's intent; the demographic shape of the loss shapes the recovery.
- **Migration (DECIDED 2026-11-04):** when a settlement **forecasts that it will run out of food before the next harvest** (granary + expected monthly income − consumption until the harvest month < 0) and it has **idle hands**, **10 % of the idle hands per month leave with their dependants** (a proportional slice of all cohorts) for the **parent settlement**. A settlement with no parent sends nobody. Migration outpaces hunger deaths on purpose. The two famines are thus distinguished automatically: overpopulation (idle hands → people leave) vs. a shortage of hands after a levy or raid (no idle hands → nobody leaves; they recover or die).
- **Demographic realism (DECIDED by Omer 2026-11-05; values are starting values for tuning):**
  - *Vital sampling* — births and deaths are Poisson draws around the expected value (variance = mean): a village jitters, a city barely moves. (`demography.json` `noise.vitalSampling` = 1.)
  - *Harvest variance* — **±12.5 %**: each January every settlement draws a harvest factor, half of the variance shared by its 12×12-hex block so bad years are regional; floored at 30 %. Forecasts assume an average year. (`economy.json` `farming.harvest.variance`.)
  - *Epidemics* — 1 % chance per settlement per year of a year with double deaths (`noise.epidemic`). A placeholder for the game-wide natural-events mechanic Omer wants later (§4.9).
  - All draws come from the seeded game RNG; the headless runner and the tests can switch every knob off (`src/sim/noise.ts`).
- **Pull factor (DECIDED by Omer 2026-11-05, revised the same day to the prosperity condition):** each December a settlement whose spare hands exceed 15 % of its hands sends **4 % of them (±50 %), with dependants, to its parent** — but only if the parent is **prosperous**: fully fed that year **and fed with margin** (spare months at the next harvest ≥ 4, the granary brake's measure) and — once villages have a tax figure to compare, not yet built — paying more per head than the village does. People moved to towns because towns were prosperous, not because the crown had a job open (the earlier "vacancies" condition never fired and was dropped). The granary brake stops the pull before it starves anyone.
- **Granary brake (DECIDED by Omer 2026-11-05; values draft):** towns, cities and the metropolis breed less when their stock is thin — at the December reckoning births are multiplied by a factor of *spare months* = months of stock − months until the next harvest: 1 at ≥ 4, 0.25 at ≤ 0, linear between (`demography.json` `granaryBrake`). A city therefore stops growing *before* famine and settles with about two months to spare in a normal year, so only a bad harvest starves it. Villages keep the crowding rule instead.
- **Settlers from idle hands (DECIDED direction, Phase 2):** raising a settlers unit is the *player's* lever, never automatic — any settlement with idle hands can raise settlers from them (cost: the people); the panel flags "overcrowded". Later a starving city may use the same exit.

### 4.2 Economy (DECIDED concept; food model starting numbers approved 2026-11-04)

Economic output is computed from in-world activity — resources gathered, goods produced, trade conducted — and modified by organizational factors: bureaucracy quality, laws, infrastructure, number of working hands.

**Food model (DECIDED structure 2026-11-04; numbers are draft, in `data/economy.json`):**

- **1 food feeds one person for one month.** Everyone eats 1 regardless of age *(v1 simplification)*.
- **Farming** on a worked hex: people fed per year at full labour by fertility level 0–4 = **0 / 150 / 300 / 450 / 600**; **90 hands** work a hex fully; yield scales linearly with hands. **Herding** by pasture level = **0 / 45 / 90 / 135 / 180** per year, 15 hands. **Fishing** on water hexes (§3.1): 225 / 30 hands, or 450 / 90 hands with Fish. **Game**: +180 / 30 hands. *(All at the ×3 model scale, §5.8; `data/economy.json` carries `modelScale: 3`.)*
- **Harvest timing:** farming output lands **60 % in September, 40 % in October**; herding, fishing and hunting arrive monthly in twelfths.
- **Staffing order:** buildings first (halls, granary, everything built), then fields (best hexes first); the **spare hands** left over build the current project and then gather timber and stone (Session 11).
- **Granary:** every settlement has one (§3.3). Fully staffed: capacity 24 months of consumption, spoilage 0.5 % of stock per month. Unstaffed: 15 months, 1.5 %. Linear in between.
- **Sharing:** after the harvest a subordinate settlement keeps a **3-month reserve** and sends the rest to its parent each month (the parent takes what it lacks; the rest stays). Roads (Phase 2) extend this beyond the influence zone with losses per distance.
- **Tithe (DECIDED 2026-11-05):** on top of the surplus flow, the parent takes a **fixed share of every subordinate's food production in kind, at the moment it is produced** — *10 % (draft)* of all food, before the subordinate reckons its own needs. In a lean year it is taken even though the village would have kept it, so famine shifts partly from the cities to the countryside — intended. A single number (`sharing.titheShare`) for now; **must become a player-decided policy** (light / customary / heavy, city food against countryside order) with §4.3. **Crisis requisition** (a parent taking a subordinate's stock down to a floor; costs order) is deferred to **Phase 4**.

**Materials (DECIDED by Omer 2026-11-05; numbers draft, in `data/economy.json` `materials`):**

- Two building materials, **timber** and **stone**, plus **goods** (made by the private economy). Units are abstract (a Mill costs 90 timber).
- **Gathering is done by the spare hands** — the hands the food jobs do not need — so it never costs food. Timber comes from the terrain's timber yield of the worked hexes (0 / 60 / 120 / 180 / 240 a year per fully worked hex, 30 hands); stone from worked **Stone** hexes (90 a year, 30 hands; Phase 2 quarries and lumber camps multiply this). A grassland city gathers nothing; its woodland villages gather for it. Spare hands that gather still count as spare for the crowding rule.
- **The cluster is the stockpile.** Every settlement holds its own stock; the cluster's stockpile is the sum over its members, and a building project draws from it (the builder's own stock first, then the others). Goods likewise.
- **Stockpile caps (DECIDED 2026-11-05, Session 11b; numbers left to Claude by Omer, Session 12c):** a cluster's stockpile has a **cap** per material — *draft:* 300 timber / 150 stone / 150 goods plus 60 / 30 / 30 per member settlement, plus +900 / +450 / +450 per **Warehouse** (a 22-settlement cluster holds 810 stone, enough for Walls; a Citadel's 1,200 needs a Warehouse or shipping); every month what a cluster holds above its cap flows to the **realm stockpile** (taken from the holders in proportion), which has its own cap — *a flat draft of 6,000 / 3,000 / 3,000 until administration quality exists (§4.3)* — above which it is lost. The player ships from the realm stockpile to any cluster; **the shipment arrives at once** — a PLACEHOLDER until roads and caravans carry it with delay and loss.
- **Money** is **faction-wide**: clusters hold grain and materials, never coin. It comes from **tax on private hands** (§4.2b) and from goods sold; it pays for buildings and, later, upkeep and institutions.

**4.2b The private economy (DECIDED by Omer 2026-11-05, Session 11b; draft numbers in `data/economy.json` `privateEconomy`: 0.2 coins and 0.05 goods per private hand per year, 1 coin a good; administration quality = the hall's staffing until §4.3 exists).** Omer's framing: the vast majority of townspeople did not work for the state — they were artisans, labourers, traders, professionals — and the crown saw them not as hands but as **revenue** (tolls, market dues, hearth taxes, tallage, charter sums). So in a town, city or metropolis every hand not in a building or a field is a **private hand**, and:

- Private hands **produce tax** (coins per hand per year, draft, into the faction treasury) and **goods** (artisan output into the cluster stockpile, which markets sell) *by themselves*, with no building required. Both are multiplied by **administration quality** (hall staffing now; institutions, the tax-regime policy and public order later).
- **Using them costs money.** Construction gangs, timber and stone gatherers, levies, professional soldiers, settlers and work-bands are drawn from the private pool (list DECIDED by Omer 2026-11-05, Session 12c; more may be added), and the price is the tax and goods they no longer produce — shown in the panel as the tax base ("15,600 private hands → 3,100 coins/yr") and its dent while they are away. No separate rule; the lost tax *is* the cost.
- Workshop, Market, Guildhall and the like are **multipliers** on the private economy, not employers (small hands counts). **Goods become money only through a Market** in a town or city (Omer, Session 12c): a cluster without one piles goods up to its cap and overflows them to the realm, from where the player can ship them to a cluster that has one.
- The player **does not manage the private economy** hand by hand: it runs itself and the king sees the receipts. The levers are a king's levers — the tax regime, charters, markets, order, and taking people out of it.
- Villages keep spare hands (peasants); only towns and above have a private economy.
- Hook for §4.3: a **Town Charter** policy — the commune pays a fixed sum and keeps its autonomy (reliable money, less control, order up) vs direct taxation (more money when administration is good, less when it is not).

PROPOSED flow per settlement per turn:

1. **Gather**: working hands × hex yields (terrain + resources + buildings) → food, timber, stone, iron, raw goods.
2. **Produce**: workshops in towns/cities turn raw goods into finished goods (tools, cloth, weapons).
3. **Consume**: population eats food; shortfall → hunger → deaths, order drops.
4. **Store / share**: granaries hold surplus (with spoilage); surplus moves within influence zones and along roads.
5. **Trade & tax**: markets sell surplus and goods → money; taxes depend on administration quality and a tax-rate policy.
6. **Faction treasury** pays upkeep (units, buildings, characters' salaries), builds, and funds institutions.

Currencies: **money** (one coin), plus stockpiled **food, timber, stone, iron, horses, goods** per settlement.

### 4.3 Government, institutions and policies (DECIDED as the advancement system 2026-11-03; structure PROPOSED)

There is no research. A faction advances by organizing itself. Omer's framing (DECIDED): some advances are **simply enabled once a milestone is reached**; others are **policy choices with trade-offs** that the player must actively decide on, even after the milestone makes them available. The game must gradually hand the player more tools as the faction becomes more sophisticated. *How the faction is organized* is itself part of this system.

PROPOSED three-layer structure (to be worked out in a dedicated **Government & Institutions design session before Phase 2** — see ROADMAP):

**Layer 1 — Government form.** A few forms of state, each defining what the ruler is called, which institutions and policies are available, and the base administrative capacity. Sketch *(draft)*: *Chiefdom* (a warlord and his hall; rule by personal loyalty) → *Petty Kingdom* (a king, a court, a handful of named offices) → *Kingdom* (provinces, chancery, law). Changing form is a major event with prerequisites and consequences, not a free upgrade.

**Layer 2 — Institutions (earned).** Founded once a milestone is reached and a price paid; they then exist. Examples *(draft)*:

| Institution | Prerequisite | Effect |
|---|---|---|
| Chancery | A city; a literate chancellor | +administrative capacity; better tax collection |
| Law Code | Chancery | Reduces corruption; enables law policies |
| Royal Roads | 3 towns connected by road | Cheaper roads; faster movement on them |
| Schools | A city with a Cathedral | Raises literacy → more capable governors |
| Guild Charters | 2 towns with Workshops | More goods, more money, slightly less order |
| Royal Mint | Silver source or Great Market | More money from trade |

**Layer 3 — Policies (chosen).** A milestone makes a policy *available*; adopting it is a decision with a trade-off, and it can be reverted later at a cost (order, money, or a cooldown). Examples *(draft)*:

| Policy | Available when | Trade-off |
|---|---|---|
| Provincial Division | N hexes under influence; Chancery | Better finances and reach; less direct control, governors gain power |
| Professional Army | Treasury surplus for N turns; Barracks | Strong standing units; drains money, can lower cohesion/loyalty of levied nobles |
| Tax regime (light / normal / heavy) | always | Money vs. order |
| Levy obligations (none / customary / universal) | government form | Manpower vs. order and production |
| Tolerance of foreign populations | Law Code | Order in conquered lands vs. cohesion of the core |

**Administrative capacity** is a faction-level number (from government form, the ruler, the chancellor, institutions, literacy). Each settlement costs capacity (cities cost most). Exceeding it raises **corruption** (money lost) and lowers public order everywhere. This is the soft cap that makes "few cities, many villages" the natural shape.

### 4.4 Public order — PROPOSED

Each settlement has an order value (0–100). Raised by: garrison, chapel/cathedral, food plenty, luxury goods, a good governor, same culture as the ruler. Lowered by: hunger, heavy levies, high taxes, corruption, foreign culture, recent raids. Low order → reduced output → riots → **revolt**, which can spawn a new rebel faction holding the settlement. (Rebel factions must also be beaten or clients for victory — keeps the endgame alive.)

### 4.5 Characters (DECIDED concept)

Each faction generates a pool of characters with **skills** (military, logistics, administration, diplomacy, education level *(draft)*) and **traits** (e.g. *corrupt*, *intelligent*, *brave*, *pious*, *cruel*) that give bonuses or penalties. The pool's quality depends on the faction: literacy → more administrators; professional army → more military talent; institutions shape the mix.

Characters can be **appointed** to positions: government offices (PROPOSED: ruler, chancellor, marshal, treasurer, envoy), **governor** of a city or region, **commander** of a unit or army.

**The ruler is a character (DECIDED 2026-11-03).** The player's ruler (the king, or whatever the government form calls them) is one character among many, with the same life cycle, skills and traits as the rest. When the ruler dies an **heir** succeeds; a weak or contested succession costs order and may trigger a crisis.

PROPOSED lifecycle details: characters have an age, gain experience in their post, and die. Characters have **loyalty** and **ambition**; a disloyal, ambitious marshal with an army is a risk the player must manage. *(Intrigue beyond this — plots, assassination — is out of scope unless Omer wants it later.)*

### 4.6 Warfare (DECIDED concept)

Military units differ in size, demographic requirement, upkeep, facility requirements and quality.

**Tiers (DECIDED):**
- **Levies** — cheap, temporary, raised from villages (or towns). Raising them removes working hands and lowers order in the source settlement. Fight poorly. Disband back home.
- **Professional / standing units** — expensive in money and resources, recruited from towns/cities (or anywhere with the right facilities). Little disturbance, fight well. Require upkeep every turn. Availability tied to the Professional Army policy (§4.3).

PROPOSED roster *(draft)*: village levy (spears), levy archers, town militia, professional spearmen, crossbowmen/longbowmen, light cavalry (needs horses), knights/heavy cavalry (needs horses + Ironworks + Stables), siege engineers (needs city with Workshop).

**Facilities (DECIDED):** Stables for cavalry, Ironworks for armoured troops, Barracks for professional recruitment, etc.

**Battle resolution v1 (DECIDED):** a point system with randomness — each side's strength = sum of unit strength × morale × experience, modified by commander skill, terrain, and fortifications, with a random factor. Casualties scale with the loser's margin; the loser retreats or routs. Battle reports show the calculation.

PROPOSED additions:
- **Supply and attrition**: armies eat food; in friendly territory they draw from nearby settlements and roads; in enemy or empty land they forage (damaging villages) or starve. Winter worsens it. The commander's logistics skill reduces losses.
- **Sieges**: walled settlements must be besieged; the siege takes turns, both sides suffer attrition, assaults are possible, surrender when food runs out.
- **Raids**: a unit action against a weakly defended settlement — steal money and food, burn stores, kill or carry off people. Cheap, nasty, and the main tool of small or nomadic factions.

**Future (DECIDED as a direction, not scheduled):** battles playable directly, in real time or turns, from a third-person view (reference: *Lines of Battle*). The v1 point system must be built so it can be swapped out.

### 4.7 Diplomacy (DECIDED)

Factions can: exchange resources, money and settlements; coordinate attacks; declare war; make and negotiate peace; **subjugate** or **client** one another.

PROPOSED: a relations value per pair of factions, treaty types (peace, non-aggression, alliance, trade agreement, tribute, clientage), and clear definitions:
- **Client**: keeps internal autonomy, pays tribute, follows the overlord into war. Counts toward victory.
- **Subjugated**: lost its independence; the overlord appoints its governor; can rebel. Counts toward victory.
- **Conquered**: no longer exists; its settlements are the conqueror's.

### 4.8 Factions and AI (DECIDED)

The player controls one faction; the computer controls all others. **The test map starts with 6 factions (DECIDED 2026-11-04)**; until the AI exists only the player's faction acts. PROPOSED: each faction has a *persona* (expansionist, trader, raider, defensive) that weights a utility-based AI. The AI uses the same rules and information as the player as far as practical; any cheat is documented.

**Decisions of 2026-11-05 (Omer):**
- **Phases 1–3 are built with the player's faction alone.** The other five are added once the mechanics work — same rules, different naming scheme, AI-controlled; every settlement and unit carries a faction id from the start.
- The six factions are **hand-designed** (names, start positions, starting settlements and sizes), not generated.
- The world has **several culture groups**; factions may share one. Flavour and naming schemes are settled later.
- **Start positions are placed by Omer in the map editor** (tier, population, name), optionally **run forward a few years and saved** as the starting state — a scenario file, which is the game state itself. The first one exists: `scenarios/start.json` (Hugeopolis, Omerburg, Hillside, 7 towns, 50 villages, ≈248,000 people); the game opens on it.
- The **player faction is fixed** for now (a start screen can come later). **AI personas** are a Phase 5 question.

### 4.9 Events — PROPOSED (Omer 2026-11-05: natural events are to become a bigger, game-wide mechanic)

A random-event system: plague, drought, bumper harvest, failed harvest, bandits, a comet, a gifted child born to a character. The Session 9 epidemics and harvest variance (§4.1) are its first, settlement-local pieces; Omer wants droughts, disease and similar natural events folded into one game-wide mechanic later (regional, multi-year, with player responses). The state already carries an event log (`state.events`).

### 4.10 Culture — PROPOSED, later

Population carries a culture tag; ruling a settlement of foreign culture lowers order until it assimilates over decades. Cities project culture through their influence zone. Not needed for the first playable version.

---

## 5. Open decisions (need Omer)

1. ~~Desert terrain~~ — RESOLVED 2026-11-05: not now; perhaps a future iteration.
2. The yield rows marked *draft* in the §3.1 terrain table — the ones Omer has not ruled on: River as grassland (fertility 4, pasture 1), Tundra pasture 1, Swamp fertility 1 / timber 1, Forest fertility 1, Hills timber 1, Woodland and Grassland pasture 1. Confirm or change.
3. ~~Whether the 6 factions are hand-designed or generated~~ — RESOLVED 2026-11-05: hand-designed; player faction alone until the mechanics work (§4.8). Still OPEN: the culture groups and naming schemes (later).
4. **Government & Institutions** detailed design — scheduled as a dedicated design session before Phase 2 (§4.3 is a sketch only).
5. ~~Hall names~~ — RESOLVED 2026-11-05: Moot Hall (village) and Great Hall (metropolis).
6. ~~River farming + fishing~~ — RESOLVED 2026-11-05: yes, both.
7. ~~Metropolis prerequisites~~ — accepted as a draft 2026-11-05; revisit with roads.
8. ~~Tier upgrade thresholds~~ — RESOLVED 2026-11-04: **model scale ×3** (yields, hands, building staff, unit sizes); the town and city gates stay 1,500 / 6,000, the metropolis gate is 36,000; `data/economy.json` `modelScale: 3`; `tests/scale.test.ts` proves the curves invariant.
9. ~~City growth brake~~ — RESOLVED 2026-11-05: the granary brake (§4.1) plus the pull factor.
10. ~~Urban work scale~~ — RESOLVED 2026-11-05: the private economy (§4.2b); the pull factor runs on prosperity, not vacancies.
11. ~~Money and the private economy~~ — RESOLVED 2026-11-05 (Session 12c): building prices ×5; gatherers and professional soldiers join construction, levies, settlers and work-bands as uses that cost tax; cap numbers left to Claude (realm cap doubled); goods become money only through a Market.

Every DECIDED item above carries its date; the change log below lists what each version settled, and the DEVLOG entries hold the discussion and the measurements behind each decision.

---

## 6. Glossary

- **Influence zone** — rings of hexes around a settlement (1/3/5/6 for village/town/city/metropolis): surplus flows up through it, bonuses trickle down, borders are drawn from it.
- **Work zone** — hexes a settlement's own hands extract from (1 ring for a village, 2 for the rest).
- **Parent settlement** — the higher-tier settlement a village or town is subordinate to; receives its surplus and its migrants.
- **Cluster** — an unparented settlement plus all its subordinates, transitively; the unit inside which food flows. Derived from parent links, never stored. A lone village is a cluster of one.
- **Tithe** — the fixed share (10 % draft) of a subordinate's food production taken by its parent in kind as it is produced; later a policy.
- **Shore** — a sea hex with at least one land neighbour; workable for fish. Sea touching no land is *offshore* (needs a port).
- **Hands** — working adults 15–59. *Staffed* hands run buildings, *field* hands work hexes, *spare hands* do neither — they build the current project, gather timber and stone, and are the crowding and migration pool.
- **Private hands** — in a town, city or metropolis, everyone not in a building or a field: the private economy, which yields tax and goods on its own and from which construction gangs, levies and settlers are drawn at the cost of that tax (§4.2b).
- **Vacancies** — hands a settlement's buildings, fields and construction could use but it does not have (shown in the panel; no longer drives the pull factor).
- **Tax base** — a settlement's private hands and the coins they yield a year; its **dent** is the tax forgone while some of them build (or gather).
- **Stockpile** — a cluster's pooled timber, stone and goods (the sum of its members' stocks), held up to its **cap** (raised by Warehouses). The **realm stockpile** is the faction's: fed by what the clusters hold above their caps, capped itself, shipped by the player.
- **Metropolis** — the fourth settlement tier: a city of 36,000+ upgraded to 6 rings of influence and unique features.
- **Model scale** — all people-counts (yields, hands, sizes) are ×3 the original draft (§5.8); the tier gates 1,500 / 6,000 are not.
- **Group** — several units on one hex acting as one; an *army* is a group of military units.
- **Administrative capacity** — how much a faction can govern before corruption and disorder rise.
- **Government form** — the faction's type of state; sets what institutions and policies are available.
- **Institution** — an earned organizational advance (Chancery, Schools…), founded once its milestone is reached.
- **Policy** — a chosen stance with a trade-off (Provincial Division, Professional Army…), available after a milestone, reversible at a cost.
- **Levy** — temporary soldiers drawn from a settlement's population.
- **Client / subjugated / conquered** — the three states of a defeated faction; all count toward victory.

---

## Change log

- 0.4d (2026-11-05, Session 12c): Omer's verdicts — prices ×5; uses of private hands that cost tax (incl. gatherers, professional soldiers); Market the only route from goods to money; realm cap doubled; desert no; hall names; river both; metropolis draft accepted; §5 updated.
- 0.4c (2026-11-05, Session 12b): trimmed to a contract — implementation notes, findings and the resolved-items log removed or reduced to pointers (DEVLOG holds them); no decision changed.
- 0.4b (2026-11-05, Session 12): §4.2b, §4.2 caps, §4.1 pull on prosperity implemented; §3.3 money column, Workshop/Market multipliers, Warehouse; §5.11 opened.
- 0.4a (2026-11-05, Session 11b): §4.2b private economy DECIDED; buildings cost money; money faction-wide; stockpile caps with Warehouses; pull factor on prosperity; §5.10 resolved.
- 0.4 (2026-11-05, Session 11): §3.3 player-built buildings DECIDED (incl. military); §4.2 materials DECIDED; §4.1 pull factor DECIDED; §5.10 raised.
- 0.3g–0.3i (2026-11-05, Sessions 9c–10b): §3.3 Cluster and §4.2 tithe DECIDED, requisition deferred to Phase 4; §4.1 granary brake DECIDED; §5.9 raised and resolved.
- 0.3c–0.3f (2026-11-05, Sessions 7–9b): §4.8 factions hand-designed, player faction alone until the mechanics work, start positions placed in the editor; the first starting position; §4.1 realism knobs DECIDED; §3.3 abandonment DECIDED; §4.9 natural events to become game-wide.
- 0.3–0.3b (2026-11-04, Sessions 5–6): §3.3 rewritten — work vs influence zones, four tiers incl. metropolis (city 5 rings / metropolis 6 after the A/B), contested hexes, subordination, staffed buildings; §3.1 water hexes workable; §4.1 cohort model, starting rates, crowding, migration by forecast; §4.2 food model; model scale ×3 (§5.8).
- 0.2–0.2e (2026-11-03/04, Sessions 0–4): Omer's decisions recorded — title, turn/scale, map size, institutions + policies, mortal ruler, HTML delivery, GitHub hosting; starting canvas "vinral" frozen; terrain yields instead of resources; Game added; horses via pasture; offshore fish; 6 factions; Phase 0 signed off.
- 0.1 (2026-11-03): first draft from Omer's brief plus Claude's proposals.
