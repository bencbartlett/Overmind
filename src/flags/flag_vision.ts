import profiler = require('../lib/screeps-profiler');
import {roleScout} from "../roles/role_scout";
import {RoomBrain} from "../brains/Brain_Room";

export var visionFlagActions = {
    stationary: function (flag: Flag, brain: RoomBrain) {
        function handleScouts(flag: Flag, brain: RoomBrain) {
            var role = new roleScout();
            flag.requiredCreepAmounts[role.name] = 1;
            return flag.requestCreepIfNeeded(brain, role, {
                assignment: flag,
                workRoom: flag.roomName,
                patternRepetitionLimit: 1
            });
        }

        return handleScouts(flag, brain);
    }
};

profiler.registerObject(visionFlagActions, 'visionFlagActions');