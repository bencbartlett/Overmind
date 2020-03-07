import {log} from '../../../console/log';
import {profile} from '../../../profiler/decorator';
import {Power} from './genericPower';

export const powerId = PWR_GENERATE_OPS;

/**
 * An abstract class for encapsulating power creep power usage.
 */
@profile
export class GenerateOps extends Power {

	constructor(powerCreep: PowerCreep, target?: RoomObject) {
		super(powerCreep, target);
	}

	operatePower() {
		if (this.powerCreep.carry.ops && this.powerCreep.carry.ops > (this.powerCreep.carryCapacity * 0.9)) {
			const storage = this.powerCreep.room!.storage;
			if (!storage) {
				log.error(`Ops power creep with no storage`);
			} else {
				this.powerCreep.moveTo(storage);
				this.powerCreep.transfer(storage, RESOURCE_OPS, this.powerCreep.carry.ops);
			}
		} else {
			return this.powerCreep.usePower(powerId);
		}
		return ERR_TIRED;
	}
}
