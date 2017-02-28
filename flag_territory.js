var territoryFlagActions = {
    reserve: function (flag, brain) {
        // Spawn a reserver bot that will reserve the site
        function handleReservers(flag, brain) {
            let assignedReservers = _.filter(flag.assignedCreeps,
                                             creep => creep.memory.role == 'reserver' &&
                                                      creep.ticksToLive > creep.memory.data.replaceAt);
            let reserveAgain = false;
            if (flag.room) {
                reserveAgain = !flag.room.controller.reservation ||
                               flag.room.controller.reservation.ticksToEnd < brain.settings.reserveBuffer;
            }
            if (assignedReservers.length < 1 && reserveAgain) {
                var reserverBehavior = require('role_reserver');
                return reserverBehavior.create(brain.spawn, flag.ref);
            } else {
                return null;
            }
        }

        // If there are sites in need of construction and containers have been set up, send in some number of workers
        function handleRemoteWorkers(flag, brain) {
            if (!flag.room) { // requires vision of room
                return null;
            }
            var numWorkers = _.filter(Game.creeps,
                                      creep => creep.memory.role == 'worker' &&
                                               creep.workRoom == this.room).length;
            var numContainers = flag.room.find(FIND_STRUCTURES, {
                filter: structure => (structure.structureType == STRUCTURE_CONTAINER ||
                                      structure.structureType == STRUCTURE_STORAGE)
            }).length;
            var remainingConstruction = flag.room.remainingConstructionProgress;
            // Only spawn workers once containers are up
            var workerRequirements = Math.min(Math.ceil(Math.sqrt(remainingConstruction) / 30), 5);
            if (workerRequirements && numWorkers < workerRequirements && numContainers > 0) {
                var workerBehavior = require('role_worker');
                return workerBehavior.create(brain.spawn, {
                    workRoom: flag.room.name,
                    patternRepetitionLimit: 5,
                    remote: true
                });
            } else {
                return null;
            }
        }

        return handleReservers(flag, brain) || handleRemoteWorkers(flag, brain);
    }
};

module.exports = territoryFlagActions;