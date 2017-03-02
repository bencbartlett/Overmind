var roles = require('roles');

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
                return roles('reserver').create(brain.spawn, {
                    assignment: flag,
                    patternRepetitionLimit: Infinity // build the biggest reserver you can so you don't need to do often
                });
            } else {
                return null;
            }
        }

        return handleReservers(flag, brain);
    }
};

module.exports = territoryFlagActions;