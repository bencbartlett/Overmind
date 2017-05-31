import profiler = require('../lib/screeps-profiler');
import {ScoutSetup} from '../roles/scout';


export var visionFlagActions = {
	stationary: function (flag: Flag): void {
		function handleScouts(flag: Flag): void {
			var role = new ScoutSetup();
			flag.requiredCreepAmounts[role.name] = 1;
			flag.requestCreepIfNeeded(role, {patternRepetitionLimit: 1});
		}

		handleScouts(flag);
	},
};

profiler.registerObject(visionFlagActions, 'visionFlagActions');

