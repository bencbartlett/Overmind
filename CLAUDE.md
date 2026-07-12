# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Overmind is a TypeScript AI for [Screeps](https://screeps.com/), an MMO strategy game where you program creeps'
behavior in JavaScript running in a sandboxed 24/7 server environment. This repository is a personal fork
(`stoleas/overmind`, remote `origin`) of [bencbartlett/Overmind](https://github.com/bencbartlett/Overmind).

## Commands

```bash
npm install          # install dependencies
npm run build         # tsc -p .  (typecheck / compile to tsc-out/, does not bundle)
npm run lint          # tslint "src/**/*.ts"
npm run clean         # rm -rf tsc-out dist
npm test              # clean && lint && build  -- this is the CI/Travis command, run it before considering work done

npm run compile       # rollup -c  -- bundles src/main.ts into dist/main.js (dry run, no deploy)
npm run push-main     # rollup -c --environment DEST:main      (deploy to public server "main" branch)
npm run push-pserver  # rollup -c --environment DEST:pserver   (deploy to a private server)
npm run push-screepsplus  # deploy to a screepsplus-configured destination
```

There is no unit test suite — `npm test` is typecheck + lint only, and the real validation is running the
bundled `dist/main.js` in an actual Screeps environment (public server, private server, or the in-browser
simulator). Deploy destinations (`main`, `sim`, `pserver`, `screepsplus`) are configured in a git-ignored
`screeps.json` (copy `screeps.example.json` to create it) and consumed by `rollup-plugin-screeps` in
`rollup.config.js`.

Deploying (`push-*`) pushes code to a live, running game server — treat it like a production deploy, not a
build step. Don't run it without the user asking.

### Style

- Indentation is **tabs**, width 4 (see `.editorconfig`, enforced by `tslint.json`'s `indent` rule).
- Single quotes, no member-access modifiers on public members (`member-access: no-public`), 120-char line limit.
- `tslint.json` excludes `src/deprecated/*.ts` from linting — treat that directory as legacy/unmaintained code.

## Architecture

The design is themed around Starcraft's Zerg swarm intelligence. Understanding the object hierarchy is essential
before touching gameplay logic, since behavior is spread thin across many small, cooperating classes rather than
concentrated in one place.

```
global.Overmind (Overmind_obfuscated.js)
 └─ Colony (one per owned room)            Colony.ts
     ├─ HiveClusters (per-room structure groups: Hatchery, CommandCenter, EvolutionChamber,
     │                UpgradeSite, SporeCrawler, ...)     hiveClusters/
     ├─ Overlords (spawn & direct creeps for a task: mining, transport, upgrading, defense, ...)
     │                                                    overlords/
     │    └─ Zerg / CombatZerg (wrapped Creep with a persistent Task)   zerg/
     │         └─ Task (do-X-to-Y-until-Z; the actual creep action state machine)  tasks/
     └─ Directives (persistent flags that spawn/own Overlords in response to stimuli;
                     analogous to a process table entry)                directives/
 └─ Overseer                                                Overseer.ts
     runs directives and overlords for ALL colonies each tick, sorted by priority — the scheduler.
```

- **`main.ts`** is the entry point Screeps calls every tick. It loads/cleans memory (`Mem`), rebuilds or
  refreshes the global `Overmind` object every `NEW_OVERMIND_INTERVAL` ticks (see `~settings.ts`), then runs
  `Overmind.init()` → `Overmind.run()` → `Overmind.visuals()` → `Stats.run()`.
- **`Overmind_obfuscated.js`** contains the actual `Overmind` class implementation but is intentionally
  obfuscated (never expected to be edited — the source `src/Overmind.ts` and `src/assimilation/Assimilator.ts`
  are gitignored/excluded entirely; don't try to "fix" or de-obfuscate this file). The obfuscated class
  instantiates and refreshes all `Colony` objects, catches and reports unhandled exceptions per-tick, and
  drives the checksum-based `Assimilator` validation system used for the shared "hivemind" between Overmind
  users.
- **Directives** are the reactive layer: a `Flag`'s color/secondaryColor pair is looked up in
  `directives/initializer.ts` (`DirectiveWrapper`) to construct the right `Directive` subclass. A Directive
  attaches to a `Colony`, expires/removes its flag based on memory, and spawns one or more `Overlord`s to
  fulfill its purpose (e.g. `DirectiveHarvest` spawns a mining `Overlord`).
- **Overlords** are the "process" layer — they request creeps of given `CreepSetup`s from a colony's
  `Hatchery`/`SpawnGroup`, then assign `Task`s to those creeps every tick via `init()`/`run()` phases.
- **Zerg** (`zerg/Zerg.ts`, `CombatZerg.ts`, `NeuralZerg.ts`) wrap the native `Creep` object, adding a
  persistent `Task` reference and convenience methods; `Swarm.ts` coordinates multiple combat Zerg as a unit.
- **Tasks** (`tasks/Task.ts` + `tasks/instances/*`, constructed via `Tasks.ts` factory functions) encapsulate a
  single creep behavior (harvest, build, repair, attack, ...) including travel-to-target and completion-check
  logic, and can chain to a `_parent` task on completion.
- **Memory** (`memory/Memory.ts`) wraps `RawMemory`/`Memory` access; keys are heavily aliased to single
  characters via `_MEM` enums (see `declarations/memory.d.ts`) to minimize serialized memory size/CPU —
  when touching memory shapes, follow this convention rather than adding verbose keys.
- **Caching** (`caching/GlobalCache.ts`, `GameCache.ts`) provides cross-tick / per-tick memoization used
  heavily throughout hive clusters and logistics to avoid recomputation (`$` import in `Colony.ts`).
- **`@profile`** (`profiler/decorator.ts`) is a class/method decorator applied throughout (Colony, Overlord,
  Directive, Task, Overseer, ...) that hooks into `screeps-profiler` when `USE_PROFILER` is enabled in
  `~settings.ts`; it's a no-op otherwise, so it's safe to leave on new classes that follow the existing pattern.
- **`@assimilationLocked`** (`assimilation/decorator.ts`) registers a class's code with the `Assimilator` for
  checksum validation — used on core classes like `Colony`; don't add it casually to new classes.
- **`~settings.ts`** is the single place for player-configurable constants (username, profiler toggle, room
  claim limits, RL training mode, etc.) — check here before threading a new constant through elsewhere.
- **`logistics/`** handles energy/resource flow between structures (`LogisticsNetwork`, `LinkNetwork`,
  `RoadLogistics`, `TransportRequestGroup`, `Energetics`) — read this before changing hauling/transport
  behavior (relevant if you see references to prior "Haul flag" bugs in git history).
- **`roomPlanner/`** contains the automated base-layout logic (bunker layout, structure placement); layouts
  live under `roomPlanner/layouts/`.
- **`reinforcementLearning/`** implements an alternate main loop (`main_RL`/`RL_TRAINING_MODE` in
  `~settings.ts`) that serializes creep actions to memory for an external Python RL environment instead of
  running the normal AI logic — this path bypasses almost everything above.

## Notes for making changes

- TypeScript target is `es2017`/`esnext` modules with `strict: true` but `strictPropertyInitialization: false`
  and `noImplicitThis: false` — class fields are commonly declared without initializers and assigned in
  lifecycle methods (`refresh()`/`init()`), not always the constructor.
- Global ambient types (`Memory`, `FlagMemory`, `CreepMemory`, `RoomMemory`, `operationMode`, etc.) live in
  `declarations/*.d.ts` and are available everywhere without import — check there before declaring a
  conflicting local type.
- `rollup.config.js` builds with `treeshake: false`, and `main.ts` documents deliberate import ordering
  (`assimilation/initializer` first, `zerg/CombatZerg` before other things) — don't reorder those imports
  without understanding why a comment calls it out.
- `src/deprecated/` is excluded from linting and should be treated as unmaintained reference code, not a
  place to add new functionality.
