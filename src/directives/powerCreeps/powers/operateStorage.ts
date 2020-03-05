import {log} from '../../../console/log';
import {profile} from '../../../profiler/decorator';
import {Power} from './genericPower';

export const powerId = PWR_OPERATE_STORAGE;

/**
 * An abstract class for encapsulating power creep power usage.
 */
@profile
export class OperateStorage extends Power {

	constructor(powerCreep: PowerCreep, target?: RoomObject) {
		super(powerCreep, target);
	}

	operatePower() {
		if (!this.powerCreep.room) {
			return ERR_BUSY;
		}
		const storage = this.powerCreep.room.storage;
		if (!storage) {
			log.error(`Ops power creep with no storage`);
			return ERR_NOT_FOUND;
		}
		if (this.powerCreep.store.ops && this.powerCreep.store.ops < 100 && storage) {
			this.powerCreep.withdraw(storage, RESOURCE_OPS, 1000);
		}
		if (this.powerCreep.store.ops && this.powerCreep.store.ops >= 100 && this.powerCreep.room) {
			this.powerCreep.moveTo(storage);
			return this.powerCreep.usePower(powerId, storage);
		}
		return ERR_TIRED;
	}
}
