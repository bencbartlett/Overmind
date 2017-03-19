var roles = require('roles');

var millitaryFlagActions = {
    guard: function (flag, brain) {
        function handleGuards(flag, brain) {
            var role = 'guard';
            if (flag.memory.amount) {
                flag.requiredCreepAmounts[role] = flag.memory.amount;
            } else {
                if (flag.memory.alwaysUp || !flag.room || flag.room.hostiles.length > 0) { // spawn guard if hostiles or no vision
                    flag.requiredCreepAmounts[role] = 1;
                } else {
                    flag.requiredCreepAmounts[role] = 0;
                }
            }
            let maxSize = 9;
            if (flag.memory.maxSize) {
                maxSize = flag.memory.maxSize;
            }
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.roomName,
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
            let maxSize = Infinity;
            if (flag.memory.maxSize) {
                maxSize = flag.memory.maxSize;
            }
            let creep = flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.roomName,
                patternRepetitionLimit: maxSize
            });
            return creep;
        }

        return handleDestroyers(flag, brain)
    },


    sieger: function (flag, brain) {
        function handleSiegers(flag, brain) {
            var role = 'sieger';
            if (flag.memory.amount) {
                flag.requiredCreepAmounts[role] = flag.memory.amount;
            } else {
                flag.requiredCreepAmounts[role] = 1;
            }
            let maxSize = Infinity;
            if (flag.memory.maxSize) {
                maxSize = flag.memory.maxSize;
            }
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.roomName,
                patternRepetitionLimit: maxSize
            });
        }

        return handleSiegers(flag, brain);
    }
};

// const profiler = require('screeps-profiler');
profiler.registerObject(millitaryFlagActions, 'millitaryFlagActions');

module.exports = millitaryFlagActions;