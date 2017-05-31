// var roles = require('roles.js');
import profiler = require('../lib/screeps-profiler');
import {GuardSetup} from '../roles/guard';
import {DestroyerSetup} from '../roles/destroyer';
import {SiegerSetup} from '../roles/sieger';

export var millitaryFlagActions = {
	guard: function (flag: Flag): void {
		function handleGuards(flag: Flag): void {
			var role = new GuardSetup();
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
			flag.requestCreepIfNeeded(role, {patternRepetitionLimit: maxSize});
		}

		handleGuards(flag);
	},

	destroyer: function (flag: Flag): void {
		function handleDestroyers(flag: Flag): void {
			var role = new DestroyerSetup();
			if (flag.memory.amount) {
				flag.requiredCreepAmounts[role.name] = flag.memory.amount;
			} else {
				flag.requiredCreepAmounts[role.name] = 1;
			}
			let maxSize = Infinity;
			if (flag.memory.maxSize) {
				maxSize = flag.memory.maxSize;
			}
			flag.requestCreepIfNeeded(role, {patternRepetitionLimit: maxSize});
		}

		handleDestroyers(flag);
	},


	sieger: function (flag: Flag): void {
		function handleSiegers(flag: Flag): void {
			var role = new SiegerSetup();
			if (flag.memory.amount) {
				flag.requiredCreepAmounts[role.name] = flag.memory.amount;
			} else {
				flag.requiredCreepAmounts[role.name] = 1;
			}
			let maxSize = Infinity;
			if (flag.memory.maxSize) {
				maxSize = flag.memory.maxSize;
			}
			flag.requestCreepIfNeeded(role, {patternRepetitionLimit: maxSize});
		}

		handleSiegers(flag);
	},
};

profiler.registerObject(millitaryFlagActions, 'millitaryFlagActions');
