# Realms, Kings and Other Stuff — Design: People, Food and Money

**Part of the design contract — version 0.7a — 2026-11-09.** Sections 4.1 (demographics), 4.2 / 4.2b (food, materials, private economy) and 4.3 (government, institutions, policies — a sketch until the design session). The index and the reading rules (DECIDED / PROPOSED / OPEN, *(draft)*) are in **DESIGN.md**; section numbers are the same everywhere, so "§3.2b" always means the same rule.

---

### 4.1 Demographics (DECIDED concept; cohort model and starting numbers approved 2026-11-04)

The world contains a fixed, countable population: the sum of everyone in every settlement and unit. Each settlement and unit has a demographic distribution that drives births, deaths, working hands and recruits.

**Cohort model (DECIDED 2026-11-04):** population is stored as counts by *sex × age band* (0–14, 15–29, 30–44, 45–59, 60+) — 10 numbers per settlement or unit. The yearly update runs in December; hunger acts monthly. All rates live in `data/demography.json`; the values below are Omer-approved **starting values for tuning** *(draft)*, deliberately faster than medieval reality so a faction visibly changes over 20 years.

| | Starting value *(draft)* |
|---|---|
| Births per woman 15–44 per year, well fed | **0.27** (DECIDED by Omer 2026-11-09: ×1.5 of the former 0.18, "between moderate and strong"), times the four factors below |
| Deaths per year by band 0–14 / 15–29 / 30–44 / 45–59 / 60+ | 3 % / 1 % / 1.5 % / 3 % / 10 % |
| Aging | 1/15 of each 15-year band moves up each year |
| Working hands | everyone 15–59 (≈ 58 % of a settled population) |
| Recruitable | men 15–44 (by unit type, §4.6); taking them lowers working hands |
| Hunger (granary empty) | extra deaths that month = shortfall fraction × 5 % of population, children and 60+ hit twice as hard; order drops |
| Crowding (DECIDED 2026-11-04) | **villages only**: births × (1 − 1.0 × share of hands that are idle). A village whose land is full stops growing instead of starving, and settles with ≈ 28 % spare hands — its standing levy pool. Towns and cities are exempt: their idle hands are the workshop/recruit pool. |
| Net result | *(at the former 0.18)* ≈ +1.1–1.6 %/year well fed → a village doubled in ~50–65 years; a village founded by 900 settlers crossed the 1,500 town gate ~30 years later. *(Session 22, with the births below: a lone village of 900 on average land crosses 1,500 in about 10 years, 40 season turns; a 600-village in about 13. The start position as a whole still barely grows — land and food are its ceiling, not births.)* |

- **What moves the births (DECIDED by Omer 2026-11-09, Session 22; the values are drafts in `data/demography.json`).** Once a year, in the winter turn, a settlement's births are the women of 15–44 × 0.27 × four factors: **(1) enough food** — the year's food sufficiency to the power 3 (fed 90 % → 73 % of births, 70 % → 34 %, 50 % → 12.5 %): famine drops births significantly until there is enough food for everyone, and a settlement is back to full births the first year it is fed; **(2) stock in the granary** — the granary factor (below) now works on every tier, lowering births when the store is thin and raising them (up to ×1.15) when there is a surplus; **(3) jobs without hands** — missing hands raise births: the share of the settlement's jobs (buildings, fields, the building site) that it has no hands for, over 25 %, gives up to +30 %; **(4) idle hands** — lower births through the crowding rule (villages only: in a town or city the spare hands are the private economy, §4.2b, not idle). Items 3 and 4 pull a village toward full employment.
- **Raids and sieges** kill or carry off people, skewed toward the vulnerable or the able-bodied depending on the attacker's intent; the demographic shape of the loss shapes the recovery.
- **Migration (DECIDED 2026-11-04):** when a settlement **forecasts that it will run out of food before the next harvest** (granary + expected monthly income − consumption until the harvest month < 0) and it has **idle hands**, **10 % of the idle hands per month leave with their dependants** (a proportional slice of all cohorts) for the **parent settlement**. A settlement with no parent sends nobody. Migration outpaces hunger deaths on purpose. The two famines are thus distinguished automatically: overpopulation (idle hands → people leave) vs. a shortage of hands after a levy or raid (no idle hands → nobody leaves; they recover or die).
- **Demographic realism (DECIDED by Omer 2026-11-05; values are starting values for tuning):**
  - *Vital sampling* — births and deaths are Poisson draws around the expected value (variance = mean): a village jitters, a city barely moves. (`demography.json` `noise.vitalSampling` = 1.)
  - *Harvest variance* — **±12.5 %**: each January every settlement draws a harvest factor, half of the variance shared by its 12×12-hex block so bad years are regional; floored at 30 %. Forecasts assume an average year. (`economy.json` `farming.harvest.variance`.)
  - *Epidemics* — 1 % chance per settlement per year of a year with double deaths (`noise.epidemic`). A placeholder for the game-wide natural-events mechanic Omer wants later (§4.9).
  - All draws come from the seeded game RNG; the headless runner and the tests can switch every knob off (`src/sim/noise.ts`).
- **Pull factor (DECIDED by Omer 2026-11-05, revised the same day to the prosperity condition):** each December a settlement whose spare hands exceed 15 % of its hands sends **4 % of them (±50 %), with dependants, to its parent** — but only if the parent is **prosperous**: fully fed that year **and fed with margin** (spare months at the next harvest ≥ 4, the granary brake's measure) and — once villages have a tax figure to compare, not yet built — paying more per head than the village does. People moved to towns because towns were prosperous, not because the crown had a job open (the earlier "vacancies" condition never fired and was dropped). The granary brake stops the pull before it starves anyone.
- **Granary factor (brake DECIDED by Omer 2026-11-05; extended to a surplus factor for every tier 2026-11-09; values draft):** at the December reckoning births are multiplied by a factor of *spare months* = months of stock − months until the next harvest: **0.25 at ≤ 1.5, 1 at 7, 1.15 at ≥ 12**, linear between (`demography.json` `granaryBrake`; the thresholds were 0 / 4 until Session 22 moved them, because with births ×1.5 a city overshot its land and starved in bad harvests). A city therefore stops growing *before* famine; only a bad harvest starves it. Villages keep the crowding rule as well.
- **Settlers from idle hands (DECIDED direction, Phase 2):** raising a settlers unit is the *player's* lever, never automatic — any settlement with idle hands can raise settlers from them (cost: the people); the panel flags "overcrowded". Later a starving city may use the same exit.

### 4.2 Economy (DECIDED concept; food model starting numbers approved 2026-11-04)

Economic output is computed from in-world activity — resources gathered, goods produced, trade conducted — and modified by organizational factors: bureaucracy quality, laws, infrastructure, number of working hands.

**Food model (DECIDED structure 2026-11-04; numbers are draft, in `data/economy.json`):**

- **1 food feeds one person for one month.** Everyone eats 1 regardless of age *(v1 simplification)*.
- **Farming** on a worked hex: people fed per year at full labour by fertility level 0–4 = **0 / 150 / 300 / 450 / 600**; **90 hands** work a hex fully; yield scales linearly with hands. **Herding** by pasture level = **0 / 45 / 90 / 135 / 180** per year, 15 hands. **Fishing** on water hexes (§3.1): 225 / 30 hands, or 450 / 90 hands with Fish. **Game**: +180 / 30 hands. *(All at the ×3 model scale, §5.8; `data/economy.json` carries `modelScale: 3`.)*
- **Harvest timing:** farming output lands **60 % in September, 40 % in October**; herding, fishing and hunting arrive monthly in twelfths.
- **Staffing order:** buildings first (halls, granary, everything built), then fields (best hexes first); the **spare hands** left over build the current project and then gather timber and stone (Session 11). **Partial staffing (DECIDED 2026-11-07):** a hex's yield is no longer linear in hands below 75 % staffing — see §3.2b.1 (buildings stay linear).
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

PROPOSED three-layer structure (to be worked out in a dedicated **Government & Institutions design session after Phase 2 and before Phase 3** — moved 2026-11-07 so that it opens with the measured sprawl of a realm that can found settlements and with the list of "§4.3 hooks" Phase 2 accumulates; see ROADMAP):

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
