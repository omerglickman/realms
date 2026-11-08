# Realms, Kings and Other Stuff — Design: Settlements

**Part of the design contract — version 0.7 — 2026-11-08.** Section 3.3 — tiers, zones, clusters, subordination, buildings. The index and the reading rules (DECIDED / PROPOSED / OPEN, *(draft)*) are in **DESIGN.md**; section numbers are the same everywhere, so "§3.2b" always means the same rule.

---

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

**Cluster (DECIDED 2026-11-05, Omer's concept):** a cluster is an **unparented settlement together with every settlement subordinate to it, transitively** (its towns, their villages, its own villages). A lone village is a cluster of one. Food flows only inside a cluster, so the cluster is the real demographic and food unit of the realm; it is also the natural unit for the tithe (§4.2), for future provinces, governors and public order. It is a **derived view**, never stored — computed from the parent links, so it cannot drift from the subordination rule. A town under a city is a member of the city's cluster, not a cluster of its own. **Upgrades and leadership (DECIDED 2026-11-07, Omer):** a settlement that grows to its parent's tier **stays in the cluster, subordinate to its old parent** (the link becomes explicit; equal tiers are never joined by the automatic rule, only kept or chosen). When a cluster holds **more than one settlement of its highest tier**, the crown may in the cluster ledger **name which of them leads** (the others go under it, within its influence) or **split one off** into a cluster of its own, taking the villages nearer to it. UI: a cluster outline on the map, a cluster panel (people by tier, the year's food balance, tithe, migration, hunger, members); the realm report is the sum over clusters.

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
