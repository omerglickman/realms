# Realms, Kings and Other Stuff — Design Contract

**Version 0.2 — 2026-11-03 — Status: DRAFT, core decisions made; see §5 for what is still open**

Working title: **Realms, Kings and Other Stuff** (DECIDED 2026-11-03; may change later).

This document is the single source of truth for *what the game is*. Every future chat in this Project reads it before doing anything.

## How to read this document

- **Roles.** Omer is the designer and creative director and has final say on all design questions. Claude implements. Claude may propose, never decide.
- **DECIDED** — comes from Omer's brief or a later explicit decision. Does not change without Omer saying so, in writing, in a chat. When it changes, the change is recorded here *and* in DEVLOG.md.
- **PROPOSED** — Claude's suggestion, not yet accepted. May be implemented as a placeholder if the phase needs *something* there, but must stay easy to change, and the DEVLOG must say it is a placeholder.
- **OPEN** — a question that needs Omer's answer before the phase that depends on it.
- Numbers marked *(draft)* are starting values for tuning, not design commitments.

Companion documents: **ROADMAP.md** (how and in what order we build it) and **DEVLOG.md** (what has actually been done).

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

OPEN: Should **Desert** exist? (Not in the brief. Only matters if the world has a hot south.)

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

Horses come from pasture (terrain), not a resource. The test map's resources are placed in the editor (seeded spawn, then hand-edits) and live in the map file. OPEN: Furs and Game overlap (both forest/woodland/tundra) — keep both, or fold furs into game?

### 3.2 Units (DECIDED concept, PROPOSED roster)

Units are mobile entities belonging to a faction. **Every unit carries population** (people with a demographic profile) that was drawn from a settlement and returns to one when the unit is disbanded or settles.

Unit families:

- **Settlers** — found a new village. Carry ~200–400 people *(draft)*.
- **Work-bands** — build infrastructure outside settlements (roads, forts, mills, extraction sites). Carry ~50–100 people.
- **Military units** — see §4.6. Each has a size (people), demographic requirement (e.g. men 15–44), source (village levy vs. city militia vs. professional), upkeep, and facility requirements.
- *(later)* **Caravans / envoys / ships.**

**Grouping (DECIDED):** units on the same hex can be joined into a **group** that moves and acts as one — e.g. military units escorting settlers, or several military units forming an *army*. A group moves at the speed of its slowest member and may have a commanding character.

### 3.3 Settlements (DECIDED)

Three tiers: **Village**, **Town**, **City**.

| | Village | Town | City |
|---|---|---|---|
| Population *(draft)* | 200–1,500 | 1,500–6,000 | 6,000+ |
| Influence zone | 1 ring (6 hexes) | 2 rings (18) | 3 rings (36) |
| Food | Produces surplus | Roughly balanced | Large deficit — needs villages |
| Economy / culture | Little | Moderate | Large |
| Buildings | Few, simple | Several | Many, including unique |

PROPOSED details:

- **Work zone** (hexes the settlement's own population works): ring 1 for all tiers, expanding to ring 2 for cities *(draft)*.
- **Influence zone** defines territory, taxation, recruitment area, and **food sharing**: villages inside a town's or city's influence zone automatically send their surplus food to it. Beyond that, food moves only along roads between connected settlements, with losses per distance *(draft)*. This is what makes roads matter.
- Overlapping influence zones between factions are **contested** territory — a source of diplomatic friction and a trigger for border events.
- **Growth between tiers is a player decision**, not automatic: upgrading village→town or town→city requires a population threshold, money, materials, and enough **administrative capacity** (§4.3). This is how "few cities, many villages" is enforced softly.
- **Buildings** (inside settlements) modify public order, resource extraction, recruitment capacity, storage, literacy. PROPOSED starter list: Granary, Mill, Palisade, Chapel (village); Market, Workshop, Walls, Barracks, Stables, Inn (town); Cathedral, School, Guildhall, Citadel, Mint, Ironworks, Great Market (city). Full table in `data/buildings.json`.

### 3.4 Infrastructure and buildings outside settlements (DECIDED concept)

Built by work-bands, costing money, materials and turns:

- **Roads** of varying quality — PROPOSED: *track* (free, appears with use), *dirt road*, *paved road*. Affect movement, trade and food transport.
- **Road-stations** (inns/relay posts) — PROPOSED: extend the distance over which food and trade move without loss; improve army supply.
- **Watermills** — on River hexes; boost food/goods of the owning settlement.
- **Forts** — garrison point, zone of control, protect villages from raids.
- PROPOSED: **Bridges** (river crossings), **mines/quarries/lumber camps** (unlock a resource hex), **watchtowers** (vision).

---

## 4. Systems

### 4.1 Demographics (DECIDED concept, PROPOSED model)

The world contains a fixed, countable population: the sum of everyone in every settlement and unit. Each settlement and unit has a demographic distribution that drives births, deaths, working hands and recruits.

PROPOSED representation — **cohort model**: population is stored as counts by *sex × age band* (0–14, 15–29, 30–44, 45–59, 60+). That is 10 numbers per settlement — cheap enough for thousands of settlements, rich enough to produce the effects in the brief:

- **Births** per year depend on women 15–44 and food sufficiency.
- **Deaths** depend on age band, food, disease, and war.
- **Working hands** = adults 15–59 not under arms.
- **Recruitable** = men 15–44 (by unit type, see §4.6). Taking them lowers working hands → lowers food/production.
- **Raids and sieges** kill or carry off people, skewed toward the vulnerable or the able-bodied depending on the attacker's intent; the demographic shape of the loss shapes the recovery.
- **Migration** *(later)*: people drift from starving or disorderly settlements to prosperous ones.

### 4.2 Economy (DECIDED concept)

Economic output is computed from in-world activity — resources gathered, goods produced, trade conducted — and modified by organizational factors: bureaucracy quality, laws, infrastructure, number of working hands.

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

The player controls one faction; the computer controls all others. PROPOSED: 6–10 factions on the test map, each with a *persona* (expansionist, trader, raider, defensive) that weights a utility-based AI. The AI uses the same rules and information as the player as far as practical; any cheat is documented.

### 4.9 Events — PROPOSED (optional flavour)

A small random-event system: plague, bumper harvest, failed harvest, bandits, a comet, a gifted child born to a character. Cheap to build once the state exists; strong return in flavour.

### 4.10 Culture — PROPOSED, later

Population carries a culture tag; ruling a settlement of foreign culture lowers order until it assimilates over decades. Cities project culture through their influence zone. Not needed for the first playable version.

---

## 5. Open decisions (need Omer)

1. **Desert** terrain: yes/no.
2. **Furs vs Game** overlap (§3.1); draft yield rows in the terrain table (§3.1).
3. **Number of factions** on the test map (proposed 6–10) and whether they are hand-designed or generated.
4. **Government & Institutions** detailed design — scheduled as a dedicated design session before Phase 2 (§4.3 is a sketch only).

Resolved 2026-11-03: name; turn length (1 month); hex scale (nominal, movement tuned for fun); map size (160×100 test map, engine for 400×250); institutions + policies as the advancement system; ruler as a mortal character with succession; builds delivered as a single HTML file Omer opens from disk (plus a private web page as backup); code hosted on GitHub (`omerglickman/realms`).

---

## 6. Glossary

- **Influence zone** — rings of hexes around a settlement that it controls (1/2/3 for village/town/city).
- **Work zone** — hexes a settlement's own population works for resources.
- **Group** — several units on one hex acting as one; an *army* is a group of military units.
- **Administrative capacity** — how much a faction can govern before corruption and disorder rise.
- **Government form** — the faction's type of state; sets what institutions and policies are available.
- **Institution** — an earned organizational advance (Chancery, Schools…), founded once its milestone is reached.
- **Policy** — a chosen stance with a trade-off (Provincial Division, Professional Army…), available after a milestone, reversible at a cost.
- **Levy** — temporary soldiers drawn from a settlement's population.
- **Client / subjugated / conquered** — the three states of a defeated faction; all count toward victory.

---

## Change log

- 0.2c (2026-11-04): §3.1 rewritten — fertility/pasture/timber are terrain yields (Omer's decision); Game added; resource table with current spawn chances.
- 0.2b (2026-11-04): §3.1 note on the implemented resource table.
- 0.2a (2026-11-04): starting canvas chosen (seed vinral) and frozen as `maps/testmap.json`.
- 0.2 (2026-11-03): Omer's decisions recorded — title, turn/scale, map size, institutions+policies, mortal ruler, HTML delivery, GitHub hosting. §4.3 restructured into government form / institutions / policies.
- 0.1 (2026-11-03): first draft from Omer's brief plus Claude's proposals.
