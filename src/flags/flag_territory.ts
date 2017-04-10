// var roles = require('roles.js');

export var territoryFlagActions = {
    reserve: function (flag: Flag, brain: any) {
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

    claimAndIncubate: function (flag: Flag, brain: any) {
        // Spawn a reserver bot that will reserve the site
        function handleClaimers(flag, brain) {
            let role = 'claimer';
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
};

// const profiler = require('screeps-profiler');
import profiler = require('../lib/screeps-profiler'); profiler.registerObject(territoryFlagActions, 'territoryFlagActions');
