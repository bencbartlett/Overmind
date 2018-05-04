# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/) 
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added 
- Lots of new content added to the [Wiki](https://github.com/bencbartlett/Overmind/wiki)!
- TerminalNetwork stat collection, which accumulates all `send()` calls and transfer costs by resourceType between origin and destination
    - Added Grafana dashboard support for new stats (in /assets)
- Hauling directives and overlords for hauling large amounts of resources long distances (e.g. scavenging from abandoned storage)
- Finished integrating LogisticsRequestDirectives: these act as requestor or provider objects at a position
    - Requestor: requests energy to be dropped at a positiion
    - Provider: resources dropped at position or in a tombstone should be collected
- Preliminary contract module for making deals between players
- Added `Energetics` module, which will make high-level decisions based on energy distributions
- Colonies now have a `lowPowerMode` operational state, which scales back production of miners and transporters at RCL8 with full storage/terminal

### Changed
- `Task.creep` once again points to a `Zerg` object rather than a `Creep` object (Tasks are still hosted on creep prototypes, however)
- `TaskRepair` will now attempt to move to within range 2 if repairing a road; this should fix the move-stop-repair-move-stop-repair behavior of workers repairing remote roads
- TerminalNetwork now sends excess energy to room with least energy rather than non-full room with least send cost overhead
- More upgraders spawn when room is at very high energy capacity
- Removed stack tracing for all logging except errors; removed some annoying alerts ("transporter chooses request with 0 amount!")

### Removed
- Deprecated `TaskDeposit`; use `TaskTransfer` instead
- `TaskWithdrawResource` has replaced `TaskWithdraw`

### Fixed 
- Bugfixes with `TaskDrop`, `TaskGoTo`, `TaskGoToRoom`
- Even more bugfixes with `TaskDrop`
- Fixed bug (hopefully) with creeps not approaching to range 1 in `TaskAttack` and `TaskHeal`

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

[Unreleased]: https://github.com/bencbartlett/Overmind/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/bencbartlett/Overmind/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/bencbartlett/Overmind/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/bencbartlett/Overmind/releases/tag/v0.1.0
