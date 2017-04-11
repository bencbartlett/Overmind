// var roles = require('roles.js');

import {RoomBrain} from "../brains/Brain_Room";

export var millitaryFlagActions = {
    guard: function (flag: Flag, brain: RoomBrain) {
        function handleGuards(flag: Flag, brain: RoomBrain) {
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

    destroyer: function (flag: Flag, brain: RoomBrain) {
        function handleDestroyers(flag: Flag, brain: RoomBrain) {
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


    sieger: function (flag: Flag, brain: RoomBrain) {
        function handleSiegers(flag: Flag, brain: RoomBrain) {
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
import profiler = require('../lib/screeps-profiler'); profiler.registerObject(millitaryFlagActions, 'millitaryFlagActions');
