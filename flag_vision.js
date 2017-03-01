var roles = require('roles');

var visionFlagActions = {
    stationary: function (flag, brain) {
        function handleScouts(flag, brain) {
            let assignedScouts = _.filter(flag.assignedCreeps,
                                          creep => creep.memory.role == 'scout' &&
                                                   creep.ticksToLive > creep.memory.data.replaceAt);
            if (assignedScouts.length < 1) {
                return roles('scout').create(brain.spawn, {assignment: flag});
            } else {
                return null;
            }
        }

        return handleScouts(flag, brain);
    }
};

module.exports = visionFlagActions;