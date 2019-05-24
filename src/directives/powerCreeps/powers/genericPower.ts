import {profile} from "../../../profiler/decorator";
import {powerId} from "./generateOps";

/**
 * An abstract class for encapsulating power creep power usage.
 */
@profile
export abstract class Power {
	static powerId: PowerConstant;

	_target: { 					// Data for the target the task is directed to:
		ref: string; 				// Target id or name
		_pos: ProtoPos; 			// Target position's coordinates in case vision is lost
	};


	_powerCreep: {
		name: string;
	};

	/**
	 * Dereferences the Task's target
	 */
	get target(): RoomObject | null {
		return deref(this._target.ref);
	}

	canRunPower() {
		const power = this.powerCreep.powers[powerId];
		return power && power.level > 0 && power.cooldown == 0;
	}

	/**
	 * Return the wrapped creep which is executing this task
	 */
	get powerCreep(): PowerCreep { // Get task's own creep by its name
		// Returns zerg wrapper instead of creep to use monkey-patched functions
		return Game.powerCreeps[this._powerCreep.name];
	}

	/**
	 * Set the creep which is executing this task
	 */
	set powerCreep(pc: PowerCreep) {
		this._powerCreep.name = pc.name;
	}

	run() {
		if (this.canRunPower()) {
			this.operatePower()
		}
	}

	operatePower() {

	}
}