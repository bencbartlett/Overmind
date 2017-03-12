var roles = require('roles');

var industryFlagActions = {
    remoteMine: function (flag, brain) { // remotely setup and mine an outpost
        function handleRemoteMiners(flag, brain) {
            var role = 'miner';
            flag.requiredCreepAmounts[role] = brain.settings.minersPerSource;
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.roomName
            });
        }

        // // If there are sites in need of construction and containers have been set up, send in some number of workers
        // function handleRemoteWorkers(flag, brain) {
        //     var role = 'worker';
        //     if (!flag.room) { // requires vision of room
        //         return null;
        //     }
        //     var numContainers = flag.room.storageUnits.length;
        //     // Only spawn workers once containers are up, spawn a max of 2 per source
        //     var workerRequirements = 0;
        //     if (flag.room.remainingConstructionProgress > 0 || room.brain.getTasks('repair').length > 0) {
        //         workerRequirements = 1;
        //     }
        //     if (numContainers == 0) {
        //         flag.requiredCreepAmounts[role] = 0;
        //     } else {
        //         flag.requiredCreepAmounts[role] = workerRequirements;
        //     }
        //     return flag.requestCreepIfNeeded(brain, role, {
        //         assignment: flag,
        //         workRoom: flag.roomName,
        //         patternRepetitionLimit: 10
        //     });
        // }

        function handleRemoteHaulers(flag, brain) {
            var role = 'hauler';
            // remote haulers should only be spawned for nearly complete (reserved) rooms
            if (!flag.room) { // need vision of the room to build haulers
                return null;
            }
            // let numConstructionSites = flag.room.find(FIND_MY_CONSTRUCTION_SITES).length;
            var numHarvestableContainers = flag.pos.findInRange(FIND_STRUCTURES, 2, {
                filter: structure => structure.structureType == STRUCTURE_CONTAINER
            }).length;
            var [haulerSize, numHaulers] = brain.calculateHaulerRequirements(flag, true);
            if (numHarvestableContainers == 0 || !brain.room.storage) {
                flag.requiredCreepAmounts[role] = 0;
            } else {
                flag.requiredCreepAmounts[role] = numHaulers; // haulers are only built once a room has storage
            }
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: brain.room.name,
                patternRepetitionLimit: haulerSize
            });
        }

        return handleRemoteMiners(flag, brain) || handleRemoteHaulers(flag, brain);
    }
};

const profiler = require('screeps-profiler');
profiler.registerObject(industryFlagActions, 'industryFlagActions');

module.exports = industryFlagActions;