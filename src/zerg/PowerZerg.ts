import {profile} from '../profiler/decorator';
import {AnyZerg} from './AnyZerg';

interface CombatZergMemory extends CreepMemory {
	recovering: boolean;
	lastInDanger: number;
	partner?: string;
	swarm?: string;
}

export const DEFAULT_PARTNER_TICK_DIFFERENCE = 650;
export const DEFAULT_SWARM_TICK_DIFFERENCE = 500;

/**
 * CombatZerg is an extension of the Zerg class which contains additional combat-related methods
 */
@profile
export class PowerZerg extends AnyZerg {

	creep: PowerCreep;
	memory: CombatZergMemory;
	isPowerZerg: true;

	constructor(creep: PowerCreep, notifyWhenAttacked = true) {
		super(creep, notifyWhenAttacked);
		this.isPowerZerg = true;
		_.defaults(this.memory, {
			recovering  : false,
			lastInDanger: 0,
			targets     : {}
		});
	}

	static fatigue() {
		return 0;
	}

	static body() {
		return [MOVE];
	}

	static attack(target: Creep | Structure<StructureConstant>): 0 | -1 | -4 | -7 | -9 | -12 | -11 {
		return ERR_TIRED;
	}


}
