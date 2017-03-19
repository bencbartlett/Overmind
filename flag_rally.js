var rallyFlagActions = {
    rallyHealer: function (flag, brain) { // TODO: reformat this
        function handleRallyHealers(flag, brain) {
            // if (flag.room && flag.room.find(FIND_MY_STRUCTURES, { // healpoints with towers don't ask for a healer
            //         filter: s => s.structureType == STRUCTURE_TOWER
            //     }).length > 0) {
            //     return null;
            // }
            // let assignedRallyHealers = _.filter(flag.assignedCreeps,
            //                                     creep => creep.memory.role == 'rallyHealer' &&
            //                                              creep.ticksToLive > creep.memory.data.replaceAt);
            // let numRallyHealers = 1;
            // if (flag.memory.amount) {
            //     numRallyHealers = flag.memory.amount;
            // }
            // let maxSize = Infinity;
            // if (flag.memory.maxSize) {
            //     maxSize = flag.memory.maxSize;
            // }
            // if (assignedRallyHealers.length < numRallyHealers) {
            //     var rallyHealerBehavior = require('role_rallyHealer');
            //     return rallyHealerBehavior.create(brain.spawn, flag.ref, {
            //         patternRepetitionLimit: maxSize
            //     });
            // } else {
            //     return null;
            // }
        }

        return handleRallyHealers(flag, brain);
    }
};


profiler.registerObject(rallyFlagActions, 'rallyFlagActions');
module.exports = rallyFlagActions;