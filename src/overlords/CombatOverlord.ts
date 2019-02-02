import {Overlord} from './Overlord';
import {CombatZerg} from '../zerg/CombatZerg';
import {SpawnGroup} from '../logistics/SpawnGroup';
import {profile} from '../profiler/decorator';
import {Directive} from '../directives/Directive';


export interface CombatOverlordOptions {

}

@profile
export abstract class CombatOverlord extends Overlord {

	directive: Directive;
	spawnGroup: SpawnGroup;
	requiredRCL: number; // default required RCL

	constructor(directive: Directive, name: string, priority: number, requiredRCL: number) {
		super(directive, name, priority);
		this.directive = directive;
		this.requiredRCL = requiredRCL;
		this.spawnGroup = new SpawnGroup(this, {requiredRCL: this.requiredRCL});
	}

	// Standard sequence of actions for running combat creeps
	autoRun(roleCreeps: CombatZerg[], creepHandler: (creep: CombatZerg) => void) {
		for (let creep of roleCreeps) {
			if (creep.hasValidTask) {
				creep.run();
			} else {
				if (this.shouldBoost(creep)) {
					this.handleBoosting(creep);
				} else {
					creepHandler(creep);
				}
			}
		}
	}

}

