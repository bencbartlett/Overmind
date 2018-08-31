import {Overlord, OverlordInitializer} from './Overlord';
import {CombatZerg} from '../zerg/CombatZerg';
import {SpawnGroup} from '../logistics/SpawnGroup';


export abstract class CombatOverlord extends Overlord {

	spawnGroup: SpawnGroup;
	private requiredRCL: number; // default required RCL

	constructor(initializer: OverlordInitializer, name: string, priority: number, requiredRCL: number) {
		super(initializer, name, priority);
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
					this.requestBoostsForCreep(creep);
					this.handleBoosting(creep);
				} else {
					creepHandler(creep);
				}
			}
		}
	}

}

