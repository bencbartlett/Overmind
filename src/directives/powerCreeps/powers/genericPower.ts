import {profile} from "../../../profiler/decorator";
import {powerId} from "./generateOps";

/**
 * An abstract class for encapsulating power creep power usage.
 */
@profile
export abstract class Power {
	static powerId: PowerConstant;

	canRunPower(pc: PowerCreep) {
		const power = pc.powers[powerId];
		return power && power.level > 0 && power.cooldown == 0;
	}

	run() {}
}