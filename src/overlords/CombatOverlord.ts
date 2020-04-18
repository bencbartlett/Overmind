import {Directive} from '../directives/Directive';
import {SpawnGroup} from '../logistics/SpawnGroup';
import {profile} from '../profiler/decorator';
import {CombatZerg} from '../zerg/CombatZerg';
import {Overlord, OverlordMemory} from './Overlord';


export interface CombatOverlordMemory extends OverlordMemory {
	[MEM.TICK]: number;
}

export interface CombatOverlordOptions {

}

/**
 * CombatOverlords extend the base Overlord class to provide additional combat-specific behavior
 */
@profile
export abstract class CombatOverlord extends Overlord {

	memory: CombatOverlordMemory;
	directive: Directive;
	spawnGroup: SpawnGroup;
	requiredRCL: number; // default required RCL

	constructor(directive: Directive, name: string, priority: number, requiredRCL: number, maxPathDistance?: number) {
		super(directive, name, priority);
		this.directive = directive;
		this.requiredRCL = requiredRCL;
		this.spawnGroup = new SpawnGroup(this, {requiredRCL: this.requiredRCL, maxPathDistance: maxPathDistance});
		if (!this.memory[MEM.TICK]) {
			this.memory[MEM.TICK] = Game.time;
		}
	}

	get age(): number {
		return Game.time - this.memory[MEM.TICK];
	}

	// Standard sequence of actions for running combat creeps
	autoRun(roleCreeps: CombatZerg[], creepHandler: (creep: CombatZerg) => void) {
		for (const creep of roleCreeps) {
			if (creep.spawning) {
				return;
			}
			if (creep.hasValidTask) {
				creep.run();
			} else {
				if (creep.needsBoosts) {
					this.handleBoosting(creep);
				} else {
					creepHandler(creep);
				}
			}
		}
	}

}

