# Changelog
All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Created a [documentation site](https://bencbartlett.github.io/overmind-docs/) using TypeDoc!
    - Added/reformatted docstring-comments throughout the codebase
- Added the `RemoteDebugger` module, which lets me remotely debug other Overmind players' code in real-time by communicating through public memory segments. 
    - You can start and end a debug session with the `startRemoteDebugSession()` and `endRemoteDebugSession()` commands
    - Debug sessions automatically time out after 1000 ticks unless extended
    - Ping me on Slack #overmind if you want me to debug something for you
        - I can only remotely debug players on a shard that I have a presence in (currently only `shard2`)
    - This allows for me to remotely execute arbitrary code, but I promise not to be evil! <3 
- `DirectiveRoomClear`, which claims a room, destroys all hostile structures in the room (by default, keeping store structures and roads intact), then unclaims the room. This is useful for cleaning out remote outposts which were previously claimed rooms
- Added room layout analysis to `CombatPlanner`, which classifies rooms to one of the four most common types of rooms:
    - Bunkers: most structures in the rooms are covered by ramparts
    - EdgeWall: barriers placed as close as possible to all room exits
    - InnerWall: barriers placed to enclose structures but are recessed from the room exits
    - Exposed: key structures are pathable to from some room exit
- Added additional heap cleaning routines to prevent periodic bucket crashes. At low bucket, the global cache will periodically be cleared, and at even lower buckets, `Game.cpu.halt()` will occasionally be called.
- `Visualizer` content:
    - Added `displayCostMatrix` method, which is useful for debugging pathfinding operations
        - Added `displayCostMatrix` option to combat and swarm `MoveOptions`
- Added logic to suspend and unsuspend a colony. Suspended colonies will not be run, and their associated directives/overlords will not be handled either.
    - Use `suspendColony(roomName)` and `unsuspendColony(roomName)` in the console to do this.
- Added `in/out` terminal exception states, which seek to set the terminal contents to exactly the specified amounts, pushing everything else from the terminal to the network
    - Changed `TerminalState_Rebuild` to an `in/out` state
- Nuke defense behavioral improvements:
    - Boosted workers will be spawned to fortify ramparts with incoming nukes
    - Towers will not repair nuked ramparts unless they calculate that fortifications will not finish in time
    - Workers now prioritize fortifying ramparts covering important structures first
- Market improvements:
    - New console method: `cancelmMarketOrders(filter?)`: cancels all market orders matching filter (if provided)
    - Will now place and maintain buy orders for energy if average colony energy is too low and player has sufficient credits
    - Reduced terminal equilibrium energy from 100k to 50k

### Changed
- MASSIVE memory size reduction: many common memory keys have been aliased to single-character names using a set of constant enums in `memory.d.ts`. For example, `memory.colony` is now `memory.C` and is referenced in code as `memory[_MEM.COLONY]`.
    - You can expect your memory usage to drop by about half(!) after applying this change.
- `MiningOverlord` will now suicide old miners when their replacements arrive, preventing excess CPU use
- Major improvements to swarm target finding/avoiding logic
- `Directive`s no longer have a `requiredRCL` property and now take more general `colonyFilter` optional arguments in their constructor
- Managers will transfer 200000 energy from terminal to storage before it gets destroyed in the event of a rebuild state
- Updated the Grafana dashboard to reflect lots of accumulated changes
- `Abathur` now tries to synthesize a number of intermediate compounds if some minerals are unavailable (thanks, Conventia!)
- Increased the scaling of number of upgraders to 1 upgrade part per 10k energy above threshold, down from 25k. This should make the bot spawn more upgraders below RCL8 and operate with less excess energy in storage.
- Project now complies with tslint standards specified in the configuration file; lint checks have been added to the CI scripts

### Fixed
- Fixed a critical issue which caused the CPU reset routine to repeat indefinitely in low-CPU environments like shard3 (#65)
- Security patch for `Assimilator`
- Fixed a bug in `WorkerOverlord` where workers would not fortify ramparts to the needed hits to withstand multiple stacked nuclear strikes
- Fixed a `RoadPlanner` bug which caused it to prever pathing roads along edge tiles between rooms
- Fixed a recently-introduced bug which prevented drones from repairing their containers
- `Swarm` bugfixes -- swarms should now pivot and swap orientations correctly, preserving the reflexive parity of the formation
- Fixed a bug which caused towers to fire too readily on hostiles
- Fixed a bug which caused towers to not fire readily enough on hostiles
- Fixed a bug which could calculate `outpostIndex` to be negative, messing up creep spawning priorities
- Fixed a typo which miscalculated needed fortification hits for ramparts with incoming nukes
- Fixed unhandled memory access when spawning in for the very first time on a new account (#75)
- Fixed a bug in `RoomPosition.getPositionsAtRange` (thanks, Conventia!)
- Account for hitback when computing `hitsPredicted`
- Various `CombatIntel` and `RoomIntel` bugfixes
- No longer calls `Directive.spawnMoarOverlords()` if directive instantiation is aborted (in lieu of #82)


## Overmind [0.5.2.1] - 2019.2.8

This patch fixes a critical bug with the `RoomIntel` module.

### Fixed
- Fixed an unprotected access error with `RoomIntel.getSafetyData()`



## Overmind [0.5.2] - 2019.2.1

This release adds improvements to Overmind's performance at lower RCL, fixes boosting logic to account for the removal of pre-boosting, and improves road planning, room intel, and swarms. This release is the version running in botarena 202.

### Added
- Visualizer improvements:
    - Added a dashboard section for the evolution chamber
    - Labs now display their mineralTypes overlaid as a room visual
    - Added version update messages to the notifications board when available
- Improvements to swarms:
    - All overlords controlling swarms are now extended from the `SwarmOverlord <- CombatOverlord <- Overlord` class
        - New `swarmWishlist` method prevents swarms from spawning "out of sync"
    - Improvements to swarm assembly point calculations; supports multiple swarms now
    - `Swarm.pivot()` provides more reliable in-place rotation without breaking formation
- New console methods:
    - `notifications()` will print out a list of notifications shown in the GUI with links to rooms
    - `listDirectives()` now takes an optional functional-style filter, such as `listDirectives(dir => dir.color == COLOR_PURPLE && !!dir.overlords.colonize)`
    - `listConstructionSites()`, which takes an optional functional filter
- Smarter behavior when dealing with over-stressed hatcheries
    - New `overload` stat tracks the rolling average of ticks where the hatchery is idle, wants to spawn something, but is unable to because it is being loaded
- RoadPlanner improvements:
    - New routing algorithm allows for tunnel placement, although this will be relatively rare due to very high maintenance costs
    - Changes to `Colony.destinations` ensures more determinism when recomputing road networks; you should notice a decrease in roads which become deprecated as levels grow or outposts are added
    - `RoadPlanner.roadCoverage` property tracks paving completion throughout a colony; transporter bodies will now use this stat rather than colony level to determine when to switch between setups with 1:1 and 2:1 carry:move ratios
- New information tracked with `RoomIntel`:
    - (Approximate) harvesting data and rolling averages of energy/tick over 10k, 100k, and 1M ticks
    - Casualty data, with effective energy costs and rolling average of cost/tick over 10k, 100k, 1M ticks
    - Creep occupancy data over the last 25 ticks (computed only in owned rooms)
    - Safety data, tracking consecutive safe, unsafe ticks and rolling average of safety over last 1k and 10k ticks
- `CombatIntel.isEdgeDancing` uses creep occupancy data tracked in `RoomIntel` to determine if a likely tower drain attack is occurring; towers will adjust their firing patterns accordingly.
- Initial (incomplete) implementation of `CombatPlanner`, which will coordinate automatic offensive and defensive actions betweeen colonies.

### Changed
- Rewrote the boosting protocol to account for the removal of [pre-boosting capabilities](https://blog.screeps.com/2018/12/changelog-2018-12-14/#Other-changes). RIP in-spawn boosting, you will be missed... :'(
    - Instead of three booster labs (one adjacent to each spawn), each applying every boost to their respective creeps, the new system allows up to 8 boosting labs, which will contain the total current amount of each distinct resource needed by all creeps currently being spawned by the colony.
- Improvements to keeping newly-constructed ramparts alive at low RCL: towers will repair critical ramparts below RCL5, and workers will prioritize fortifying critical ramparts above repairs
- Overlords are now instantiated immeditely after a directive is placed rather than having to wait for the next full `rebuild()`
- Pioneers will remove structures blocking a controller from being claimed, and claimers won't spawn until controller is reachable
- Workers will upgrade controllers sooner at higher levels and will spawn when a downgrade is imminent
- Non-stationary managers have fewer move parts in bunker-type colonies
- Reservers allow for a lower reservation buffer and will use the cached reservation info from `RoomIntel` if vision is unavailable
- Queens now spawn with 1:1 move:carry ratios until a storage is built
- Changes to overlord priorities at lower RCL
- Tweaks to safemode and invasionDefense triggers
- UpgradeSites won't place containers until RCL 2
- Consolidated mutalisk and hydralisk body plans

### Removed
- Deprecated directives and overlords for old siege and healpoint logic

### Fixed
- Security patches and bugfixes for the `Assimilator`
- Pioneers and claimers should no longer navigate through dangerous source keeper territory
- Fixed an issue in `TaskRecharge` which could cause some creeps, like pioneers, to not harvest from a fully-surrounded source that they were adjacent to, causing gridlock situations
- Added a check to prevent `Overlord.wishlist()` from requesting too many creeps; this was prompted due to a subtle division by zero error in `outpostDefenseOverlord` causing Overmind to crash in the last two BotArena rounds
- Fixed a bug causing excess energy to accumulate in terminals rather than be sold on the market as much as it should
- Fixed an issue causing `CombatZerg` to occasionally load as `Zerg`
- Fixed a bug in `Abathur.getReactionQueue()` which could cause it to ignore market resources on private servers
- Fixed a bug where fillers would try to withdraw from nukes
- Improved drone constructionSite build time
- Fixed a bug where `RoomPlanner` would not properly demolish hostile structures in a newly claimed room
- Extraction directives now remove themselves if colony downgrades below RCL6
- Fixed a bug where low-level min-cut barriers for a bunker placed too close to the edge would not fully enclose the base (#43)
    - This bug has not been fixed for the older two-part base style, which will soon be deprecated



## Overmind [0.5.1] - 2019.1.2

This patch changes the architecture of Overmind to be much more CPU efficient by introducing a cache-friendly `refresh()` phase to the main loop. See [this blog post](https://bencbartlett.wordpress.com/2019/01/02/screeps-6-verifiably-refreshed/) for more details. Additionally, the `Visualizer` system has been rewritten, and prelimiary support for assimilation and swarms has been added.

### Added
- Huge persistence update: much of the Overmind architecture now persists on global between ticks! This saves a ton of CPU that was previously used toward garbage collection.
    - The global `Overmind` object is now rebuilt every 20 ticks; in the meantime, `refresh()` is called
    - Colonies, HiveClusters, Directives, Overlords, and Zerg are also persistent
    - Parsed memory is saved each tick and restored the following tick to avoid `JSON.parse()` costs
    - You can expect massive CPU savings, along with decreased CPU variabiity from this update
- Added caching methods `$.set()` and `$.refresh()`
- Lots of new content added to the `Visualizer`!
    - Overmind logo now gets drawn in upper left corner
        - This was a fun little project to do in Mathematica; I made a curve simplification algorithm to look at an image and give the minimum number of points to describe its perimeter within a given tolerance (those are all the hard-coded arrays in `logos.ts`)
    - CPU, bucket, and GCL meters drawn
    - Updates to colony creep count visuals
    - Displays bar graphs for command center and hatchery statistics
- New `Segmenter` module manages asynchronous memory segments
- Added some under-the-hood content for assimilation
    - Completed the "key exchange protocol" that the assimilator uses to periodically validate codebases
- Preliminary support for formation-based movement and pathfinding using `Swarm`s
    - Added behavioral locks to prevent usage of this feature for non-assimilated codebases

### Changed
- Improvements to `RangedDefenseOverlord` which utilize some of the new combat logic developed for SK mining
- Queens now are prespawned 100 ticks in advance of when they are needed (up from 50) until there are multiple spawns in the room
- Tweaks to bootstrapping
    - Triggers if there is no queen and not enough energy to spawn a new one, regardless of presence of miners
    - Will now reassign a transporter to become a queen if one is available
- CPU improvements
    - `Colony.registerRoomObjects` now uses more caching and is less expensive
    - Improvements to `MiningSite`, `ExtractionSite`, and `UpgradeSite` to make them more CPU friendly
- Separated `Overlord` abstract class into `Overlord` and `CombatOverlord` classes
- Standardized creep setups and role names into a single library for greater consistency and exchangeability
- Boosts are now assigned by overlords in the constructor phase by passing a `boostWishlist` option in the `zerg()` and `combatZerg()` methods
- Improvements to destroyer pairs
- Better timeout functions for terminal state directives
- Changes to flag color codes and directory structure to make directive types more consistent:
    - Changed primary color classifications:
        - Red: offsensive combat (previously all combat)
        - Blue: defensive combat (new)
        - Yellow: resource collection and transport (previously logistics)
        - Brown: terminal state directives (new)
    - Specific color code changes:
        - Guard: red/blue -> blue/blue
        - Invasion defense: orange/red -> blue/purple
        - Evacuate terminal state: yellow/red -> brown/red
        - Emergency terminal state: yellow/orange -> brown/orange
        - Rebuild terminal state: yellow/brown -> brown/yellow
    - New console method will assist in this migration: `removeErrantFlags()` removes all flags which do not match a directive color code
- Colonies now no longer have an `Overseer` property. The Overseer has been moved to the `Overmind` and now handles all directives and overlords for all colonies
    - Overlords are now initialized and run in order of their priority
- Changed routine to deal with critically low CPU bucket. Reaching the critical bucket threshold suspends operation until the entire bucket has replenished. This avoids entering a bucket "limbo state" where extra memory parsing costs are ever-present, increasing the total cost of operations.
- Quick garbage collection is now explicitly called when the Overmind is re-instantiated
- Limits the number of owned rooms you can own on CPU-limited `shard3` to three
    - Adjustable value in `~settings.ts`; will implement a more sophisticated CPU-based limiter in future

### Fixed
- Bugfix with pioneer recharging behavior to include dropped resources in recharging options
- Bugfix for incorrectly initialized terminalNetwork memory not logging transfer costs correctly (#38, thanks @MaggNorway!)
- Various SpawnGroup bugfixes
- Fixed a bug which caused RoomPlanner to still demolish baby ramparts prematurely
- Fixed a bug where I forgot to add container-building capabilities to the new extraction overlords (derp)
- Fixed a bug which broke notification disabling for scouts (#48)
- Fixed a bug where 0.4.x -> 0.5.x version migration could overwrite the default signature on a fresh installation of Overmind, breaking worker behavior
- Replaced all uses of deprecated `Game.map.getTerrainAt` to use new `Game.map.getRoomTerrain` method
- Barriers now placed on center tile in bunkers (#59)
- Fixed an issue in testing assimilation status outside `shard2` (#57)
- Fixed a bug where queens could get idle indefinitely at early RCL if minerals ended up in Hatchery battery

### Removed
- `MiningSite`s and `ExtractionSite`s have been removed; their functionalities have been split among the mining/extraction directives and overlords



## Overmind [0.5.0]: "Evolution" - 2018.8.10

This release adds a huge set of new features to Overmind, described in more detail in [this blog post](https://bencbartlett.wordpress.com/2018/08/11/screeps-5-evolution/). The most notable change is the shift in base layout from the classic "box and flower" design to a much more compact circular bunker. Although this layout is more expensive to maintain, it is much more defensible and features a number of hard-coded optimizations.

This is also the first release capable of fully automatic operation! By default, the operational mode is set to fully automatic; you can change the level of autonomy with the `setMode()` console command. Other added features include a new `Movement` library which allows creeps to fluidly glide past each other even in confined bunker alleys, support for Source Keeper mining, more advanced terminal logic, distributed spawning structures, and a lot of improvements to caching methods.

Important notes as of this release:
- Overmind no longer supports shared-vm. Isolated-vm is now required; you can set this in your account runtime settings.
- The codebase can no longer be deployed using `rollup -c --dest main` or `rollup -c --dest pserver`. Use `npm run push-main` or `npm run push-pserver` instead.

### Added
- Overmind is now capable of fully automatic operation! This patch added functionality to automatically reserve and claim rooms without any user input required. These are turned on by default; you can use the `setMode()` console commands to change the degree of autonomy.
    - Added the `Strategist` module, instantiated as `Overmind.strategist` is bot mode is enabled. Strategist is currently responsible for choosing the next room to colonize, but will contain more high-level decision making functionality in the future.
    - Added the `ExpansionPlanner` module to generate numerical scores for rooms to determine outpost/expansion preferences
    - Added several methods to the `Cartographer` module (formerly `WorldMap`)
- Added the `Assimilator` module, which verifies the integrity of an Overmind codebase. This will be used for the upcoming assimilation patch. The source code for this module is obfuscated; see the obfuscated file comments in `/src/assimilation/Assimilator_obfuscated.js` for details.
    - Added an implementation of sha256 hashing for use by this module
    - Anything marked with `@assimilationLocked` or registered with `Assimilator.validate()` cannot be modified without invalidating assimilated status
- Added the `Movement` library, which replaces Traveler as the default method of moving creeps around in Overmind
    - Added (and improved multiple times) creep pushing behavior that moves idling creeps out of the way
        - Creeps have move priorities, which characterize how important their assignment is. Creeps will yield to other creeps with more important priorities.
    - Added recursive pushing to allow spawns to shove blocking creeps out of the way to make room for a spawning creep.
    - Added methods for pathing around a room while kiting enemies and a `Movement.combatMove()` method which will be used more in the upcoming combat update
- Lots of additions to `CombatIntel` and `CombatTargeting` modules, including predictive damage calculations and automatic siege target calculations. These will be used in the upcoming combat update.
- New `CombatZerg` methods `autoMelee`, `autoHeal`, `autoRanged`, and `autoSkirmish` which provide general-purpose combat routines for small skirmishes
    - Added a `GoalFinder` module to generate lists of `PathFinderGoal`s representing positions and ranges that creeps should approach and avoid
- Added a `SourceKeeperReaper` overlord to facilitate source keeper mining (finally!)
- Added `SpawnGroup`s, which allow for decentralized creep spawning distributed among nearby colonies (work in progress)
- Room planner updates:
    - Room planner will now destroy or dismantle incorrectly-placed structures allowing you to change your room plan after it is built
    - Finished support for bunkers
- New `BunkerQueen` overlord which has a lot of hard-coded optimizations built specifically for the bunker layout
- New `ControllerAttacker` overlord which spawns groups of controller attackers ("infestors") distributed across nearby colonies to attack a room controller. (Thanks @rooklion/@Sarrick for this contribution!)
- Added terminal exception states to account for various abnormal conditions, such as rebuilding a room or evacuating a room which is about to be breached. Terminals that are in an exception state will maintain a small, tightly controlled set of resources in their store and will not engage in normal terminal activity.
- Added a `GlobalCache` module to store expensive calculations yielding RoomObjects on global; this has been integrated in various points in the codebase to improve CPU usage.
    - Renamed `GlobalCache` to `$` ($ -> cash -> cache) for maximum brevity and punnyness

### Changed
- The Overmind object now `try...catch` evaluates `init` and `run` methods for each colony / network. If an exceptions are caught, they are added to a queue and thrown at the end of the tick, preventing a global deadlock from occurring due to a problem in a single colony.
- Zerg are now instantiated in constructor phase by their overlords rather than by the Overmind object.
- All Overlords are now instantiated in a `spawnMoarOverlords()` method, which all `Colonies`, `HiveClusters`, and `Directives` now have. This is primarily in preparation for future restructuring to improve CPU usage.
- Managers are now stationary (CARRY only) at RCL8 in the bunker layout
- Refactored Hatchery spawning code to allow for greater flexibility in spawning creeps, such as requesting a specific spawn (useful for spawning the now-stationary manager)
- Refactored incubation logic to use the new `SpawnGroup` objects. Colonies no longer have `incubator` or `incubatingColonies` properties.
- Logistics network improvements:
    - `LogisticsNetwork.requestOutputAll()` has been replaced by `requestOutput({resourceType: 'all'})` and now generates a single request for the sum amount of all resourceTypes in the target. This improves performance and CPU cost.
    - Added cache invalidation methods to fix an issue where too many transporters could be assigned to the same logistics target during a single tick
    - Dropped resources and tombstones now directly request collection from the logistics network rather than using a logistics directive
    - Changed order of operations in `predictedRequestAmount` to yield more accurate results when near target store/energy capacity
- RoadLogistics now uses about 80% less CPU. Workers now get a chained task object to work more efficiently when repairing remote roads.
- TerminalNetwork now equalizes all base resources (energy, power, all base minerals)
- Workers now include dropped energy in list of objects they can recharge from and pick their recharge target more intelligently, accounting for other targeting workers
- Workers and pioneers now will use energy from available unowned storage structures if available
- Improvements to room planner demolishing behavior:
    - Added some safeguards on destroying misplaced spawns to ensure that there are enough workers to rebuild the spawns
    - Room planner is now better at detecting gridlocked situations and will destroy structures as needed to make room for construction sites
- Reorganized some memory structures, consolidating things into `Memory.settings`
- Various CPU improvements

### Fixed
- Fixed a bug where mining sites could get clogged if invaders died on the container outputs and dropped minerals which would not get withdrawn
- Fixed a bug in approximate path length caculations in `LogisticsNetwork.bufferChoices`
- Room planner now correctly restores flag memories when reopening a session
- Fixed a bug introduced in the last patch that caused workers to ignore the withdraw limit
- Fixed a rare bug in bootstrapping that could prevent a colony from correctly recovering from a crash
- Fixed (?) a really weird bug where Colonies would sometimes incorrectly compute assets. The bug was fixed by adding print statements and I have no idea why.

### Removed
- Removed dependencies for `Traveler`, replacing with in-house `Movement` and `Pathing` libraries
- Deprecated `DirectiveLogisticsRequest`
- Removed `lodash.minBy` dependencies to reduce compiled codebase size



## Overmind [0.4.1] - 2018.6.15

This patch makes Abathur a little smarter in which reactions he chooses and fixes some bugs accidentally introduced by changes in the last release.

### Added
- Initial (incomplete) room planner support for bunkers; this will be finished in a later release
- UpgradeSite inputs now actively request that minerals be removed from them in case they get in there somehow (such as a transporter dying on top of the container)

### Changed
- Abathur now checks to see if a colony can acquire the necessary base ingredients for a reaction queue through terminal transfers or via trading before assigning it to the evolutionChamber
- Renamed `LogisticsNetwork.request()` and `LogisticsNetwork.provide()` to `LogisticsNetwork.requestInput()` and `LogisticsNetwork.requestOutput()` to be less confusing

### Fixed
- Fixed a bug where colony substrings in a flag name could cause a directive to reference the wrong colony, e.g. "E11S12" directs to "E11S1"
- Fixed a bug introduced when CreepSetups were refactored in the last release that could cause bootstrapping directives to fail to run
- Fixed a bug in LogisticsNetwork where predicted carry amounts could exceed carry capacity



## Overmind [0.4.0]: "require('more-minerals')" - 2018.6.14

*"We require more minerals."* Well finally, we now have them! This long-overdue release (the largest update to date by additions/deletions) adds fully automatic mineral mining, processing, trading, and boosting capabilities to Overmind!

Colonies now automatically start mining minerals once an extractor is built. Minerals are stored in the terminal and are transferred between colonies as needed for resource production. Excess minerals are sold on the market and once a player reaches a credit threshold (currently >10k credits), missing base minerals required for resource production are purchased from the market. Labs will automatically cycle through reaction queues to try to build up a stockpile of prioritized resources. When creeps request to get boosted, the necessary resources are transferred to the appropriate colony automatically, or, if the player has sufficient credits (>15k), they will be bought on the market if not present.

Although most of the planned combat features will be implemented in v0.5, this release also introduces a number of (primarily defensive) military improvements. A CombatIntel module has been added, containing methods for combat-related calculations. Ranged and melee defenders (now hydralisks and zerglings, respectively) have been improved and will now request boosts when sufficiently large invasions occur. Additionally, directives (placed automatically) have been added to handle nuke responses, building ramparts over affected structures, and terminal evacuation, transmitting all resources in a terminal to remote colonies just before a room is lost.

Finally, we now have a [feature request](https://github.com/bencbartlett/Overmind/issues/new?template=feature_request.md) template! If you have a suggestion for something you'd like added or changed to Overmind, feel free to submit a request there.

### Added
- Added support for mineral mining and processing (finally)!
    - Reaction cycles planned by the `Abathur` module, which makes decisions related to the global production of resources, guiding the evolution of the swarm
        - Module `Abathur` incompatible with pronouns
    - New hiveCluter to manage boosting and mineral production: `EvolutionChamber`
        - `EvolutionChamber` is run by the colony manager and produces batches of resources as needed to meet a target amount
        - You might not see mineral production for the first few days while your colonies sell resources to gain sufficient market credits
    - New hiveCluster for mineral mining: `ExtractionSite` (based on @rooklion's pull request #12)
- Fully automatic support for creep boosting!
    - Boosts are used when `Overlord.boosts[creepRoleName]` is set to a list of minerals
    - Some overlords, like `RangedDefense`, will automatically boost creeps when needed
    - Boosts will only be used if (1) you have the boosts already, (2) other colonies have a sufficient total amount, or (3) you have >15k credits with which to buy the compounds
- RoomPlanner now includes automatic barrier planning
    - `roomPlanner.barrierPlanner` uses a modified min-cut algorithm to compute the best location to place ramparts
    - Opening and closing the roomPlanner for a colony which already has walls will create duplicate walls. Use `destroyAllBarriers(roomName)` if you wish to get rid of your old barriers.
- New `TraderJoe` module with lots of built in market functions:
    - Labs will attempt to buy resources they need if there are sufficient (>10k) credits
    - Sells excess resources on the market
- New directives, all placed automatically by colony overseer:
    - `DirectiveNukeResponse` will automatically build ramparts using workers to block incoming nuke damage
    - `DirectiveAbandon` will evacuate resources from a terminal if overseer detects that the colony has been breached (also prevents terminal from receiving resources)
- Added flee response to miners in outpost rooms (EDIT: this functionality is still present, but has been disabled while I tune the sensitivity)
    - Miners in colony rooms will also retreat to the safety of the controller if there is a large invasion happening
    - Workers will no longer attempt to work in unsafe remote rooms
- Preliminary DEFCON system to classify colony safety levels; this will be expanded in the next (combat-focused) update
- Room signatures can now be changed via the console command `setSignature('newSignature')`
    - Added a behavioral lock in `Overmind.ts -> Overmind_obfuscated.js` which enforces that controller signatures must contain the string "overmind" (not case-sensitive)
- New melee defense overlord spawns zerglings in rooms with a sufficiently high rampart/walls ratio and defend against melee attacks
- Improvements to the ranged defense overlord, which now spawns hydralisks which have better pathing
- New `combatIntel` module, which contains an assortment of methods related to making combat-related decisions and calculations
- Preliminary `roomIntel` module containing methods for serializing notable room features into memory
- New `VersionMigration` system will automatically perform one-time changes to resolve backward-incompatible changes with new releases (does not work when migrating from versions prior to 0.3.0)
- Added a [feature request template](https://github.com/bencbartlett/Overmind/issues/new?template=feature_request.md) and streamlined the existing issue and pull request templates

### Changed
- Lots of under-the-hood improvements to the logistics system!
    - You should see about a 60% reduction in CPU usage from `LogisticsNetwork` due to better internal caching
    - Tweaks to the predictive functions reduce the chance that transporters occasionally get stuck in an oscillatory pattern
- Refactored `TransportRequestGroup` to be more like `LogisticsNetwork`
    - CommandCenter (and EvolutionChamber) now submit resource requests via a shared `transportRequest` object
- Lots of under-the-hood memory tweaks:
    - You should see about a 30% reduction in overall memory usage!
    - Improved memory footprint of stats collection and shortened hiveCluster names in memory
    - `Mem.wrap()` now initializes new properties to defaults within the target object (previously, would only initialize if target was undefined)
- Rewrote most of the manager overlord to account for the new resource production features
- `TerminalNetwork` now uses an `equalize()` routine to distribute resources between colonies
- Several creep role names have been renamed, resulting in a reduction of the number of unique names. For example, miners and the new mineral miners are now both called "drone"s
- CreepSetups moved to respective overlord; now are constant instances rather than extending classes
- Construction sites now time out after 50000 ticks and are removed
- `LogisticsGroup` renamed to `LogisticsNetwork`
- Lots of file renaming to be more concise
- Colonies now register a shorthand reference on `global` for console use: 'E4S41' and 'e4s41' both refer to `Overmind.colonies.E4S41`
- Updates to the Grafana dashboard:
    - Several new logged statistics, including expansion ranking, miningSite usage/downtime, and energy income per tick by colony
    - Fixed several null datasource issues and made some tweaks to GCL graphs suggested by @coolfeather2

### Fixed
- Fixed a longstanding bug with `RoomObject.targetedBy` returning incorrect results because of faulty cache updating when switching tasks
- Made link allocation less buggy; hiveClusters now claim their link, preventing others from registering the same link
- Fixed a bug where the roadPlanner would plan roads for incomplete paths
- Fixed a bug where roadPlanner would incorrectly plan road networks if sources were not visible at the recalculation tick
- Fixed a bug where workers will occasionally stop working if outpost mining site containers are under construction
- Workers will no longer attempt to build sites for structures over the max amount for current room level (for example, after a controller downgrade)

### Removed
- Removed all contents from `src/deprecated`



## Overmind [0.3.1] - 2018.5.12

### Added
- Workers sign controllers at low RCL

### Fixed
- Bugfix with workers being idle due to being unable to find a valid paving target

### Removed
- Removed `LabMineralType` directive as it is no longer relevant



## Overmind [0.3.0]: "Back to base-ics" - 2018.5.9

This release adds a ton of new automation features to base planning, partially overhauling the old RoomPlanner. Once a room plan is set at RCL1, the RoomPlanner never needs to be reopened. Road networks are now continuously re-computed by the new `RoadPlanner` module, allowing you to dynamically add and remove outposts. UpgradeSites now determine their own optimal placements, and UpgradeSites and MiningSites now automatically build links when appropriate.

The terminal network has been improved as well, and now tracks transfers between locations within the network (Grafana support available in the [updated dashboard](https://github.com/bencbartlett/Overmind/blob/master/assets/Grafana%20Dashboards/Overmind.json).) Colonies now produce more upgraders while near full energy, and have a low-power mode that scales back transporters to save on CPU. Additional resource management assets, including directives for scavenging and for integrating with the logistics system, have been added but will be enabled in a future release.

### Added 
- Lots of new content added to the [Wiki](https://github.com/bencbartlett/Overmind/wiki)!
- TerminalNetwork stat collection, which accumulates all `send()` calls and transfer costs by resourceType between origin and destination
    - Added Grafana dashboard support for new stats (in /assets)
- Lots of automation improvements to the room planner! Now once you create a room plan at RCL 1, you can dynamically add and remove outposts without needing to open/close the planner.
    - Road planning is now done with the RoadPlanner, which is instantiated from a room planner, and provides a much higher degree of automation:
        - Road network is continuously recalculated every 1000 ticks with a heuristic that encourages road merging at minimal expense to path length
        - Roads which become deprecated (no longer in the optimal road plan) are allowed to decay
        - Road routing hints (white/white flags) no longer have any effect. (The new routing algorithm uses a variant of this idea to merge roads more intelligently.)
    - UpgradeSites now automatically calculate input location and no longer need to be placed in room planner
    - MiningSites at outposts now automatically build container outputs without you needing to reboot room planner
    - Automatic link placement
        - MiningSites will replace their containers with links if above 10 path length from storage (prioritizing farthest)
        - UpgradeSites will add a link if above 10 path length from storage if miningSites already have links
            - UpgradeSites now have `link` and `battery` properties which request energy independently
- Added some version migration code in `sandbox.ts` which will reboot the room planner for each colony one at a time to account for the new changes
- Hauling directives and overlords for hauling large amounts of resources long distances (e.g. scavenging from abandoned storage)
- Finished coding LogisticsRequestDirectives: these flags act as requestor or provider targets and have a `store` property
    - `provider == false`: requests energy to be dropped at a positiion
    - `provider == true`: resources dropped at position or in a tombstone to be collected
    - These directives are functional, but their automatic placement has been disabled until a future patch while I continue to improve the logistics system performance
- Preliminary contract module for making deals between players
- `Energetics` module, which will make high-level decisions based on energy distributions
    - Colonies now have a `lowPowerMode` operational state, which scales back production of miners and transporters at RCL8 with full storage/terminal
- New version updater system alerts you when a new release of Overmind is available
    - Currently only available on shard2; shard1 and shard0 support coming soon

### Changed
- Transporters now use a single-sided greedy selection at RCL<4, since stable matching only works well when the transporter carry is a significant fraction of the logisticsRequest target's capacity
- Workers and queens include tombstones in their recharge target list
- `Task.creep` once again points to a `Zerg` object rather than a `Creep` object (Tasks are still hosted on creep prototypes, however)
- `TaskRepair` will now attempt to move to within range 2 if repairing a road; this should fix the move-stop-repair-move-stop-repair behavior of workers repairing remote roads
- TerminalNetwork now sends excess energy to room with least energy rather than non-full room with least send cost overhead
- More upgraders spawn when room is at very high energy capacity
- Changed how `colony.dropoffLinks` is computed
- Disabled stack tracing for all logging except errors; removed some annoying alerts ("transporter chooses request with 0 amount!")

### Removed
- Deprecated `TaskDeposit`; use `TaskTransfer` instead
- `TaskWithdrawResource` has replaced `TaskWithdraw`
- Removed the source for `Overmind.ts` and replaced it with an obfuscated, pre-compiled `Overmind_obfuscated.js`
    - This is in preparation for implementing behavioral locks which will make Overmind more fair to new players
        - See the header in `Overmind_obfuscated.js` for more details

### Fixed 
- Bugfixes with `TaskDrop`, `TaskGoTo`, `TaskGoToRoom`
- Even more bugfixes with `TaskDrop`
- Fixed bug (hopefully) with creeps not approaching to range 1 in `TaskAttack` and `TaskHeal`
- Fixed bugs where claimers and reservers would get stuck trying to sign a room that was perma-signed by Screeps as a future newbie zone
- Fixed a bug where upgradeSites could misidentify their input in some pathological room layouts



## Overmind [0.2.1] - 2018.3.22

### Added
- Memory stat collection and `User` variable (#3 - thanks CoolFeather2!)
- Brief setup instructions for dashboard
- Assets for possible future bunker layout

### Changed
- Added adaptive thresholds to logistics system requests, should slightly improve CPU usage
- Switched dependency to personal fork of `typed-screeps`

### Fixed 
- Bugfixes with rollup and screeps-profiler
- Moved changelog to root



## Overmind [0.2.0]: "Logistics Logic" - 2018.3.15

This release completely overhauls the logistics system in Overmind, replacing haulers, suppliers, and mineralSuppliers, which functioned on a rigid rules-based system, with a more flexible universal "transport" creep. `LogisticsGroup`s employ a stable matching algorithm to efficiently assign resource collection and supply tasks to transporters, seeking to maximize aggregate change in resources per tick.

### Added
- Logistic groups, tranport overlords have now been enabled after being present in the previous few commits
- `RoadLogistics` class more efficiently schedules road maintenance
- `Zerg.actionLog` and `Zerg.canExecute()` functionality for simultaneous execution of creep actions
- Archer defense overlord and directive to defend against boosted room invasions
- `TerminalNetwork`s, `LinkNetwork`s now control terminal, link actions
- Added `screeps-profiler` dependency in favor of `screeps-typescript-profiler`
- Grafana stats reporting (dashboard json in `assets` directory)
- Added this changelog

### Removed
- Haulers, suppliers, and mineralSuppliers have been deprecated in favor of transporters
- `TerminalSettings` deprecated; remaining functionality moved to `TerminalNetwork`
- Removed use of `screeps-typescript-profiler` due to inaccuracies in readout

### Changed
- Modified Bootstrapping logic to fit new transport system
- Tasks now exist on `Creep` prototype, mirrored in `Zerg` properties (in preparation for a future stand-alone 
release of the Task system)



## Overmind [0.1.0]: "GL HF" - 2018.3.2

(This release was initially deployed on 2018.3.2 but was re-versioned on 2018.3.15.)

### Added
- Initial pre-release of Overmind after 190 commits and about 80,000 additions.


[Unreleased]: https://github.com/bencbartlett/Overmind/compare/v0.5.2.1...HEAD
[0.5.2.1]: https://github.com/bencbartlett/Overmind/compare/v0.5.2...v0.5.2.1
[0.5.1]: https://github.com/bencbartlett/Overmind/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/bencbartlett/Overmind/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/bencbartlett/Overmind/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/bencbartlett/Overmind/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/bencbartlett/Overmind/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/bencbartlett/Overmind/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/bencbartlett/Overmind/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/bencbartlett/Overmind/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/bencbartlett/Overmind/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/bencbartlett/Overmind/releases/tag/v0.1.0
