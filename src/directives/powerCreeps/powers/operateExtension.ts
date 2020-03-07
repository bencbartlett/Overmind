import {log} from '../../../console/log';
import {profile} from '../../../profiler/decorator';
import {Power} from './genericPower';

export const powerId = PWR_OPERATE_EXTENSION;

/**
 * An abstract class for encapsulating power creep power usage.
 */
@profile
export class OperateExtension extends Power {

	constructor(powerCreep: PowerCreep, target?: RoomObject) {
		super(powerCreep, target);
	}

	operatePower() {
		if (this.powerCreep.carry.ops && this.powerCreep.carry.ops > 2 && this.powerCreep.room
			&& this.powerCreep.room.energyAvailable < this.powerCreep.room.energyCapacityAvailable * 0.5) {
			const terminal = this.powerCreep.room!.storage;
			if (!terminal) {
				log.error(`Ops power creep with no storage`);
			} else {
				this.powerCreep.moveTo(terminal);
				return this.powerCreep.usePower(powerId, terminal);
			}
		}
		return ERR_TIRED;
	}
}
