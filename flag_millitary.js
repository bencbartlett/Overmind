var roles = require('roles');

var millitaryFlagActions = {
    guard: function (flag, brain) {
        function handleGuards(flag, brain) {
            let assignedGuards = _.filter(flag.assignedCreeps,
                                          creep => creep.memory.role == 'guard' &&
                                                   creep.ticksToLive > creep.memory.data.replaceAt);
            let numGuards = 1;
            if (flag.memory.amount) {
                numGuards = flag.memory.amount;
            }
            let maxSize = 5;
            if (flag.memory.maxSize) {
                maxSize = flag.memory.maxSize;
            }
            if (assignedGuards.length < numGuards) {
                return roles('guard').create(brain.spawn, {
                    assignment: flag,
                    patternRepetitionLimit: maxSize
                });
            } else {
                return null;
            }
        }

        return handleGuards(flag, brain)
    },


    sieger: function (flag, brain) {
        function handleSiegers(flag, brain) {
            let assignedSiegers = _.filter(flag.assignedCreeps,
                                           creep => creep.memory.role == 'sieger' &&
                                                    creep.ticksToLive > creep.memory.data.replaceAt);
            let numSiegers = 1;
            if (flag.memory.amount) {
                numSiegers = flag.memory.amount;
            }
            let maxSize = Infinity;
            if (flag.memory.maxSize) {
                maxSize = flag.memory.maxSize;
            }
            if (assignedSiegers.length < numSiegers) {
                var siegerBehavior = require('role_sieger');
                let newSieger = siegerBehavior.create(brain.spawn, flag.ref, {
                    healFlag: "Siege2HealPoint", // TODO: brain is hardwired
                    patternRepetitionLimit: maxSize
                });
                return newSieger;
            } else {
                return null;
            }
        }

        return handleSiegers(flag, brain);
    }
};

module.exports = millitaryFlagActions;