var roles = require('roles');

var millitaryFlagActions = {
    guard: function (flag, brain) {
        function handleGuards(flag, brain) {
            var role = 'guard';
            if (flag.memory.amount) {
                flag.requiredCreepAmounts[role] = flag.memory.amount;
            } else {
                flag.requiredCreepAmounts[role] = 1;
            }
            let maxSize = 8;
            if (flag.memory.maxSize) {
                maxSize = flag.memory.maxSize;
            }
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.workRoom,
                patternRepetitionLimit: maxSize
            });
        }

        return handleGuards(flag, brain)
    },

    destroyer: function (flag, brain) {
        function handleDestroyers(flag, brain) {
            var role = 'destroyer';
            if (flag.memory.amount) {
                flag.requiredCreepAmounts[role] = flag.memory.amount;
            } else {
                flag.requiredCreepAmounts[role] = 1;
            }
            let maxSize = 8;
            if (flag.memory.maxSize) {
                maxSize = flag.memory.maxSize;
            }
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.workRoom,
                patternRepetitionLimit: maxSize
            });
        }

        return handleDestroyers(flag, brain)
    },


    sieger: function (flag, brain) {
        function handleSiegers(flag, brain) { // TODO: reformat this one
            // let numSiegers = 1;
            // if (flag.memory.amount) {
            //     numSiegers = flag.memory.amount;
            // }
            // let maxSize = Infinity;
            // if (flag.memory.maxSize) {
            //     maxSize = flag.memory.maxSize;
            // }
            // if (flag.getAssignedCreeps('sieger') < numSiegers) {
            //     var siegerBehavior = require('role_sieger');
            //     let newSieger = siegerBehavior.create(brain.spawn, flag.ref, {
            //         healFlag: "Siege2HealPoint", // TODO: brain is hardwired
            //         patternRepetitionLimit: maxSize
            //     });
            //     return newSieger;
            // } else {
            //     return null;
            // }
        }

        return handleSiegers(flag, brain);
    }
};

module.exports = millitaryFlagActions;