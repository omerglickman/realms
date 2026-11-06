# Realms, Kings and Other Stuff — how a session works

Omer designs; Claude implements. The full working agreement is ROADMAP.md Part A; this file is the short version a session needs every time.

## Start (every session)

1. Read **DEVLOG.md "Current state"** from the Project (`project_read claude/DEVLOG.md`) — where we are and the next step. The session entries below it are history; read the latest only if the current state points at it.
2. Read **this file** and skim **ARCHITECTURE.md** (repo) for the modules the session will touch. If the session touches `src/ui/` or adds anything the player will see, read **UI-DESIGN.md** (Project + repo) — the palette, type, icons, components and zoom levels — and amend it when a UI decision is made.
3. Read **DESIGN.md by section** (`project_search`, or `project_read` and jump to the §) for the rules the session implements. Read it whole only in a design session.
4. ROADMAP.md: only at a phase boundary or when the working agreement is in question.
5. Clone `omerglickman/realms`, then `npm install && npm test && npm run build` — all green before touching anything.
6. Say in one or two sentences what the session will do (from Current state → Next steps unless Omer says otherwise). **One feature cluster per session.**

## Work

- Rules in `src/sim/` (no DOM, runs in Node), UI in `src/ui/`, numbers in `data/`. Every state change is a command. `endTurn` is deterministic.
- Anything not covered by a DECIDED item in DESIGN.md is a placeholder: `// PLACEHOLDER (DESIGN §x.y)` in code, and named in the DEVLOG entry. Never retune a number Omer set without logging it.
- After any rule change: `npm test`, the relevant headless run (`npm run sim -- --scenario start --years 40 [--builder 1]` is the A/B tool), then `npm run build` and `npm run smoke`.
- All people-counts are at model scale ×3 (DESIGN §5.8).

## Commands

```
npm test                 # vitest
npm run typecheck        # tsc --noEmit
npm run build            # → dist/realms.html (single file)
npm run smoke            # headless Chrome check of dist/realms.html (python3 + playwright; uses /usr/bin/google-chrome)
npm run sim -- --scenario start --years 40 --builder 1   # the start position, Omer's knobs, scripted builder
npm run sim -- --scenario phase1 | testmap                # ideal-land cases / cities on the real map
npm run mapdiff -- <file>                                # diff an exported map
npx tsx src/headless/inspect.ts scenarios/start.json     # list a scenario's settlements
```

## Close (mandatory, even if unfinished)

1. Tests and build green (or say so loudly in the DEVLOG entry).
2. Commit with a `phase1: …` style message and push `main` (fetch first; the clone is shallow).
3. DEVLOG.md: **overwrite** the Current state block (keep it under ~6 KB — present tense, by feature, no session history inside it) and **append** a session entry (template in DEVLOG.md). Update ARCHITECTURE.md in place if a module's job changed. Record any decision Omer made in DESIGN.md the same session (DECIDED + date); keep findings and implementation chatter out of DESIGN.md — they go in the DEVLOG entry.
4. Mirror DEVLOG.md / DESIGN.md / ROADMAP.md (and UI-DESIGN.md when it changed) to the Project (`project_write` with `local_path`; the tool needs the file read in full first — so keep them small). Every fifth session, or when DEVLOG.md passes ~45 KB, move all but the last three entries to DEVLOG-archive.md.
5. Deliver `realms.html` to Omer (SendUserFile) with a short summary: what changed, findings, what needs his decision.

## Git

Commits end with:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```
plus the session link the harness gives. Default branch `main`; Omer never touches git.
