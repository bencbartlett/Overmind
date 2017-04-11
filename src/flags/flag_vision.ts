// var roles = require('roles.js');

import {RoomBrain} from "../brains/Brain_Room";

export var visionFlagActions = {
    stationary: function (flag: Flag, brain: RoomBrain) {
        function handleScouts(flag: Flag, brain: RoomBrain) {
            var role = 'scout';
            flag.requiredCreepAmounts[role] = 1;
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.roomName,
                patternRepetitionLimit: 1
            });
        }

        return handleScouts(flag, brain);
    }
};

// const profiler = require('screeps-profiler');
import profiler = require('../lib/screeps-profiler'); profiler.registerObject(visionFlagActions, 'visionFlagActions');
