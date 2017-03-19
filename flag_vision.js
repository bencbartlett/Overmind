var roles = require('roles');

var visionFlagActions = {
    stationary: function (flag, brain) {
        function handleScouts(flag, brain) {
            var role = 'scout';
            flag.requiredCreepAmounts[role] = 1;
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.roomName,
                patternRepetitionLimit: 1
            });
            // let assignedScouts = _.filter(flag.assignedCreeps,
            //                               creep => creep.memory.role == 'scout' &&
            //                                        creep.ticksToLive > creep.memory.data.replaceAt);
            // if (assignedScouts.length < 1) {
            //     return roles('scout').create(brain.spawn, {assignment: flag});
            // } else {
            //     return null;
            // }
        }

        return handleScouts(flag, brain);
    }
};

// const profiler = require('screeps-profiler');
profiler.registerObject(visionFlagActions, 'visionFlagActions');

module.exports = visionFlagActions;