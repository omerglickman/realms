# Realms, Kings and Other Stuff — Design Contract

**Version 0.7a — 2026-11-08 — Status: DRAFT, core decisions made; Phase 1 signed off; Phase 2 unit rules decided in full (§3.2b); see §5 for what is still open**

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

## Where things are (the document is split by area; section numbers are global)

| Read this file | When | Sections |
|---|---|---|
| **DESIGN.md** (this file) | always, first | how to read · §1 vision · §2 world and map · §3.1 yields and resources · §4.4–4.10 order, characters, war, diplomacy, factions, events, culture · §5 open decisions · §6 glossary |
| **DESIGN-units.md** | units, movement, work-bands, roads, bridges, castles, forts | §3.2 · §3.2b (the twelve Phase 2 unit rules) · §3.4 · §3.5 |
| **DESIGN-settlements.md** | tiers, zones, clusters, parents, upgrades, buildings | §3.3 |
| **DESIGN-people-economy.md** | population, food, materials, money, the private economy, government sketch | §4.1 · §4.2 / §4.2b · §4.3 |
| **DESIGN-history.md** | only to see who decided what and when | the change log |

Open decisions and the glossary stay here so that one short read shows everything still unsettled.

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
| River | 1 | 4 | Grassland crossed by a river. Watermills possible. Bonus to trade. **Crossed only by a bridge; a unit on it moves along one bank (DECIDED 2026-11-07, §3.2b).** |
| Hills | 2 | 1 | Defensive bonus. Stone/iron more likely. |
| Mountains | **one hex per month** (DECIDED 2026-11-07) | 0 | Entering costs the month's whole movement unless a road runs through. Iron, silver. |
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

### 3.2–3.5 Units, settlements, infrastructure, castles

Moved: units and movement (§3.2, §3.2b), infrastructure (§3.4) and castles and forts (§3.5) are in **DESIGN-units.md**; settlements, tiers, zones, clusters and buildings (§3.3) in **DESIGN-settlements.md**.

---

## 4. Systems

### 4.1–4.3 Demographics, economy, government

Moved to **DESIGN-people-economy.md** (§4.1 demographics, §4.2 economy and §4.2b the private economy, §4.3 government, institutions and policies).

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
4. **Government & Institutions** detailed design — a dedicated design session at **step 4 of the work order** (ROADMAP v0.7, 2026-11-08: after castles, the levy, and the time-scale / economy / demography overhaul; it now also covers characters and the one-faction naming scheme; §4.3 is a sketch only).
5. ~~Hall names~~ — RESOLVED 2026-11-05: Moot Hall (village) and Great Hall (metropolis).
6. ~~River farming + fishing~~ — RESOLVED 2026-11-05: yes, both.
7. ~~Metropolis prerequisites~~ — accepted as a draft 2026-11-05; revisit with roads.
8. ~~Tier upgrade thresholds~~ — RESOLVED 2026-11-04: **model scale ×3** (yields, hands, building staff, unit sizes); the town and city gates stay 1,500 / 6,000, the metropolis gate is 36,000; `data/economy.json` `modelScale: 3`; `tests/scale.test.ts` proves the curves invariant.
9. ~~City growth brake~~ — RESOLVED 2026-11-05: the granary brake (§4.1) plus the pull factor.
10. ~~Urban work scale~~ — RESOLVED 2026-11-05: the private economy (§4.2b); the pull factor runs on prosperity, not vacancies.
11. ~~Money and the private economy~~ — RESOLVED 2026-11-05 (Session 12c): building prices ×5; gatherers and professional soldiers join construction, levies, settlers and work-bands as uses that cost tax; cap numbers left to Claude (realm cap doubled); goods become money only through a Market.
12. ~~Phase 2 kickoff~~ — RESOLVED 2026-11-07 (Session 13f): the twelve rules of §3.2b decided by Omer, the sub-points confirmed the same day (continuous staffing curve; foraging 20 % / 30 %; river banks as described, a settlement on a river counts as a bridge; muster from neighbours added; the raising materials and the disband refusal accepted as drafted).
13. **Phase 1 numbers** — tuning of food / materials / tax deferred until the Phase 2 sinks exist (Omer, 2026-11-07).
14. ~~Forts and castles~~ — RESOLVED 2026-11-08: §3.5 (the seven-rank ladder, castle staff from the villages in reach, the siege reserve, forts); numbers draft.
15. **Roads and food sharing** (§3.2b.8) — deferred to the end of Phase 2 because it bears on what a cluster is.
17. **Roads — the numbers Claude chose** (Session 16, all *(draft)* in `data/infrastructure.json`; Omer to rule): (a) ~~the road's minimum cost~~ — RESOLVED 2026-11-08: dirt road 0.5, paved road 0.25 a step (§3.2b rule 5). (b) ~~Paved vs dirt~~ — RESOLVED 2026-11-08: paved is to be significantly quicker than dirt; the paved factor is ¼ (a plains step 0.25 against dirt's 0.5, a forest step 0.75 against 1.5). Other benefits of paved roads (food sharing §5.15, trade) are set aside for now. (c) **Work speed** follows the band's people (300 = the data's months; up to ×3 for 900) — rule 2 says bigger bands "do more and eat more". (d) A **bridge is built from the bank beside it**, or by a band standing on an open river hex; it **carries a dirt road**. (e) **Materials are paid when work on a hex begins**, from the cluster whose influence covers the hex, else the realm; the band waits if neither has them; a cancelled project keeps its progress and the same order resumes it. (f) A **settlement's hex counts as a dirt road** for the link rule, and a step between two road hexes is priced at the *lower* of their levels. (g) Roads belong to no faction yet (one faction); ownership, upkeep and decay wait for §4.3.
16. ~~Food down to a new village~~ — RESOLVED 2026-11-07: a manual **Send food** action in the cluster ledger, never automatic (§3.2b.6).

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
- **Castle** — a settlement of the second kind (small / medium / large) on the tier ladder between the settlement tiers; staffed by the villages in its rings, holding a garrison and a siege reserve, heading a cluster (§3.5). A **fort** is a unit's own fortification: a ring of border, 100 men, gone a year after it is left.
- **Castle service** — hands a village or town lends to a castle in its rings, paid by the treasury, counted at home.
- **Group** — several units on one hex acting as one; an *army* is a group of military units.
- **Administrative capacity** — how much a faction can govern before corruption and disorder rise.
- **Government form** — the faction's type of state; sets what institutions and policies are available.
- **Institution** — an earned organizational advance (Chancery, Schools…), founded once its milestone is reached.
- **Policy** — a chosen stance with a trade-off (Provincial Division, Professional Army…), available after a milestone, reversible at a cost.
- **Levy** — temporary soldiers drawn from a settlement's population.
- **Client / subjugated / conquered** — the three states of a defeated faction; all count toward victory.

---
