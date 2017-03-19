var roles = require('roles');

var territoryFlagActions = {
    reserve: function (flag, brain) {
        // Spawn a reserver bot that will reserve the site
        function handleReservers(flag, brain) {
            let role = 'reserver';
            let reserveAgain = false;
            if (flag.room) {
                reserveAgain = !(flag.room.controller.level > 0) && // can't reserved owned rooms
                               (!flag.room.controller.reservation || // reserve if there's no reservation
                                (flag.room.reservedByMe && // or if there is one by me and it's about to end
                                 flag.room.controller.reservation.ticksToEnd < brain.settings.reserveBuffer));
            }
            if (reserveAgain) {
                flag.requiredCreepAmounts[role] = 1;
            } else {
                flag.requiredCreepAmounts[role] = 0;
            }
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.roomName,
                patternRepetitionLimit: 4
            });
        }

        // If there are sites in need of construction and containers have been set up, send in some number of workers
        function handleRemoteWorkers(flag, brain) {
            var role = 'worker';
            if (!flag.room) { // requires vision of room
                return null;
            }
            var numContainers = flag.room.storageUnits.length;
            // Only spawn workers once containers are up, spawn a max of 2 per source
            var workerRequirements = 0;
            var workerSize;
            if (flag.room.remainingConstructionProgress > 0) { // set up remaining construction
                workerRequirements = 1;
                workerSize = 10; // bigger worker for doing construction work
            } else if (flag.room.brain.getTasks('repair').length > 0) { // repair whatever needs repairing
                workerRequirements = 1;
                workerSize = 5; // repair jobs don't need as much
            }
            if (numContainers == 0) {
                flag.requiredCreepAmounts[role] = 0;
            } else {
                flag.requiredCreepAmounts[role] = workerRequirements;
            }
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.roomName,
                patternRepetitionLimit: workerSize
            });
        }

        return handleReservers(flag, brain) || handleRemoteWorkers(flag, brain);
    },

    claimAndIncubate: function (flag, brain) {
        // Spawn a reserver bot that will reserve the site
        function handleClaimers(flag, brain) {
            let role = 'claimer';
            let reserveAgain = false;
            if (!(flag.room && flag.room.controller.my)) {
                flag.requiredCreepAmounts[role] = 1;
            } else {
                flag.requiredCreepAmounts[role] = 0;
            }
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.roomName,
                patternRepetitionLimit: 1
            });
        }

        return handleClaimers(flag, brain);
    },

    reserveAndHarvest: function (flag, brain) { // remotely setup and mine an outpost
        // function handleRemoteMiners(flag, brain) {
        //     var role = 'miner';
        //     if (!flag.room) { // requires vision of room
        //         return null;
        //     }
        //     let numSources = flag.room.find(FIND_SOURCES).length;
        //     flag.requiredCreepAmounts[role] = numSources * brain.settings.minersPerSource;
        //     return flag.requestCreepIfNeeded(brain, role, {
        //         assignment: flag,
        //         workRoom: flag.roomName
        //     });
        // }
        //
        // // If there are sites in need of construction and containers have been set up, send in some number of workers
        // function handleRemoteWorkers(flag, brain) {
        //     var role = 'worker';
        //     if (!flag.room) { // requires vision of room
        //         return null;
        //     }
        //     var numContainers = flag.room.find(FIND_STRUCTURES, {
        //         filter: structure => (structure.structureType == STRUCTURE_CONTAINER ||
        //                               structure.structureType == STRUCTURE_STORAGE)
        //     }).length;
        //     var remainingConstruction = flag.room.remainingConstructionProgress;
        //     // Only spawn workers once containers are up, spawn a max of 2 per source
        //     var workerRequirements = Math.min(Math.ceil(Math.sqrt(remainingConstruction) / 50), 2);
        //     if (numContainers == 0) {
        //         flag.requiredCreepAmounts[role] = 0;
        //     } else {
        //         flag.requiredCreepAmounts[role] = workerRequirements;
        //     }
        //     return flag.requestCreepIfNeeded(brain, role, {
        //         assignment: flag,
        //         workRoom: flag.roomName,
        //         patternRepetitionLimit: 5
        //     });
        // }
        //
        // function handleRemoteHaulers(flag, brain) {
        //     var role = 'hauler';
        //     // remote haulers should only be spawned for nearly complete (reserved) rooms
        //     if (!flag.room) { // need vision of the room to build haulers
        //         return null;
        //     }
        //     // let numConstructionSites = flag.room.find(FIND_MY_CONSTRUCTION_SITES).length;
        //     var numHarvestableContainers = flag.pos.findInRange(FIND_STRUCTURES, 2, {
        //         filter: structure => structure.structureType == STRUCTURE_CONTAINER
        //     }).length;
        //     var [haulerSize, numHaulers] = brain.calculateHaulerRequirements(flag, true);
        //     if (numHarvestableContainers == 0 || !brain.room.storage) {
        //         flag.requiredCreepAmounts[role] = 0;
        //     } else {
        //         flag.requiredCreepAmounts[role] = numHaulers; // haulers are only built once a room has storage
        //     }
        //     return flag.requestCreepIfNeeded(brain, role, {
        //         assignment: flag,
        //         workRoom: brain.room.name,
        //         patternRepetitionLimit: haulerSize
        //     });
        // }

        // return this.reserve(flag, brain) ||
        //        handleRemoteMiners(flag, brain) ||
        //        handleRemoteWorkers(flag, brain) ||
        //        handleRemoteHaulers(flag, brain);
    }
};

// const profiler = require('screeps-profiler');
profiler.registerObject(territoryFlagActions, 'territoryFlagActions');

module.exports = territoryFlagActions;