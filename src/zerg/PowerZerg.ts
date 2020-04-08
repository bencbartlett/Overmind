import {log} from '../console/log';
import {profile} from '../profiler/decorator';
import {AnyZerg} from './AnyZerg';

interface PowerZergMemory extends CreepMemory {

}

/**
 * Base class for all PowerCreeps. Note that PowerZerg will only wrap a power creep which is actively spawned in the
 * world since Power Creeps are always present in Game.powerCreeps, regardless if they are spawned in.
 */
@profile
export abstract class PowerZerg extends AnyZerg {

	isPowerZerg: true;
	creep: PowerCreep;
	memory: PowerZergMemory;
	className: PowerClassConstant;
	deleteTime: number | undefined;
	level: number;
	powers: PowerCreepPowers;
	shard: string | undefined;
	spawnCooldownTime: number | undefined;

	constructor(powerCreep: PowerCreep, notifyWhenAttacked = true) {
		super(powerCreep, notifyWhenAttacked);
		this.isPowerZerg = true;
		// Copy all power creep properties which are not contained in AnyZerg
		this.className = powerCreep.className;
		this.deleteTime = powerCreep.deleteTime;
		this.level = powerCreep.level;
		this.powers = powerCreep.powers;
		this.shard = powerCreep.shard;
		this.spawnCooldownTime = powerCreep.spawnCooldownTime;
		if (!(this.shard && this.room)) {
			// We're not spawned in the world
			log.error(`Trying to instantiate power creep ${this.print} while not spawned in!`);
		}
	}

	refresh(): void {
		super.refresh();
		const powerCreep = Game.powerCreeps[this.name];
		if (powerCreep && powerCreep.room && powerCreep.shard) {
			this.deleteTime = powerCreep.deleteTime;
			this.level = powerCreep.level;
			this.powers = powerCreep.powers;
			this.shard = powerCreep.shard;
			this.spawnCooldownTime = powerCreep.spawnCooldownTime;
		} else {
			log.info(`${this.print} has despawned or been deleted; deleting from global and Overmind.powerZerg!`);
			delete Overmind.powerZerg[this.name];
		}
	}

	/**
	 * Delete the power creep permanently from your account. It should NOT be spawned in the world. The creep is not
	 * deleted immediately, but a 24-hour delete time is started (see `deleteTime`).
	 * You can cancel deletion by calling `delete(true)`.
	 */
	delete(cancel?: boolean): OK | ERR_NOT_OWNER | ERR_BUSY {
		return this.creep.delete(cancel);
	}

	/**
	 * Enable power usage in this room. The room controller should be at adjacent tile.
	 */
	enableRoom(controller: StructureController): OK | ERR_NOT_OWNER | ERR_INVALID_TARGET | ERR_NOT_IN_RANGE {
		return this.creep.enableRoom(controller);
	}

	// /**
	//  * Rename the power creep. It must not be spawned in the world.
	//  */
	// rename(name: string): OK | ERR_NOT_OWNER | ERR_NAME_EXISTS | ERR_BUSY {
	// 	return this.creep.rename(name);
	// }


	/**
	 * Instantly restore time to live to the maximum using a Power Spawn or a Power Bank nearby.
	 */
	renew(target: StructurePowerBank | StructurePowerSpawn):
		OK | ERR_NOT_OWNER | ERR_BUSY | ERR_INVALID_TARGET | ERR_NOT_IN_RANGE {
		return this.creep.renew(target);
	}

	// spawn(powerSpawn: StructurePowerSpawn):
	// 	OK | ERR_NOT_OWNER | ERR_BUSY | ERR_INVALID_TARGET | ERR_TIRED | ERR_RCL_NOT_ENOUGH {
	//
	// }

	/**
	 * Upgrade the creep, adding a new power ability to it or increasing the level of the existing power.
	 * You need one free Power Level in your account to perform this action.
	 */
	upgrade(power: PowerConstant): OK | ERR_NOT_OWNER | ERR_NOT_ENOUGH_RESOURCES | ERR_FULL | ERR_INVALID_ARGS {
		return this.creep.upgrade(power);
	}

	// /**
	//  * Apply one of the creep's powers on the specified target.
	//  */
	// protected usePower(power: PowerConstant, target?: RoomObject): ScreepsReturnCode {
	// 	return this.creep.usePower(power, target);
	// }

	/**
	 * Generate 1/2/4/6/8 ops resource units. Cooldown 50 ticks. Required creep level: 0/2/7/14/22.
	 * (I assume this method will be common to all power creep classes.)
	 */
	generateOps(): ScreepsReturnCode {
		return this.creep.usePower(PWR_GENERATE_OPS);
	}

}
