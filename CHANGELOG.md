# Changelog
All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added the `Movement` library, which will replace Traveler as the default method of moving creeps around in Overmind
- Room planner updates:
    - Room planner will now destroy or dismantle incorrectly-placed structures allowing you to change your room plan after it is built
    - Finished support for bunkers

### Changed
- Logistics network improvements:
    - `LogisticsNetwork.requestOutputAll()` has been replaced by `requestOutput({resourceType: 'all'})` and now generates a single request for the sum amount of all resourceTypes in the target. This improves performance and CPU cost.
    - Added cache invalidation methods to fix an issue where too many transporters could be assigned to the same logistics target during a single tick
    - Dropped resources and tombstones now directly request collection from the logistics network rather than using a logistics directive
    - Changed order of operations in `predictedRequestAmount` to yield more accurate results when near target store/energy capacity
- Workers now include dropped energy in list of objects they can recharge from and pick their recharge target more intelligently, accounting for other targeting workers

### Fixed
- Fixed a bug where mining sites could get clogged if invaders died on the container outputs and dropped minerals which would not get withdrawn
- Fixed a bug in approximate path length caculations in `LogisticsNetwork.bufferChoices`
- Room planner now correctly restores flag memories when reopening a session

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
This release was initially deployed on 2018.3.2 but was re-versioned on 2018.3.15.
### Added
- Initial pre-release of Overmind after 190 commits and about 80,000 additions.


[Unreleased]: https://github.com/bencbartlett/Overmind/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/bencbartlett/Overmind/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/bencbartlett/Overmind/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/bencbartlett/Overmind/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/bencbartlett/Overmind/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/bencbartlett/Overmind/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/bencbartlett/Overmind/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/bencbartlett/Overmind/releases/tag/v0.1.0
