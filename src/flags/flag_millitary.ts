// var roles = require('roles.js');
import profiler = require('../lib/screeps-profiler');
import {roleGuard} from "../roles/role_guard";
import {roleDestroyer} from "../roles/role_destroyer";
import {roleSieger} from "../roles/role_sieger";
import {RoomBrain} from "../brains/Brain_Room";

export var millitaryFlagActions = {
    guard: function (flag: Flag, brain: RoomBrain) {
        function handleGuards(flag: Flag, brain: RoomBrain) {
            var role = new roleGuard();
            if (flag.memory.amount) {
                flag.requiredCreepAmounts[role.name] = flag.memory.amount;
            } else {
                if (flag.memory.alwaysUp || !flag.room || flag.room.hostiles.length > 0) { // spawn guard if hostiles or no vision
                    flag.requiredCreepAmounts[role.name] = 1;
                } else {
                    flag.requiredCreepAmounts[role.name] = 0;
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
            var role = new roleDestroyer();
            if (flag.memory.amount) {
                flag.requiredCreepAmounts[role.name] = flag.memory.amount;
            } else {
                flag.requiredCreepAmounts[role.name] = 1;
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
            var role = new roleSieger();
            if (flag.memory.amount) {
                flag.requiredCreepAmounts[role.name] = flag.memory.amount;
            } else {
                flag.requiredCreepAmounts[role.name] = 1;
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

profiler.registerObject(millitaryFlagActions, 'millitaryFlagActions');
