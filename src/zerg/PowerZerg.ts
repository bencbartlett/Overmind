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

	memory: PowerZergMemory;

	isPowerZerg: true;
	isSpawned: boolean;

	creep: PowerCreep;
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
		this.isSpawned = !!this.shard && !!this.ticksToLive;
		// PowerZerg room is casted to its overlord's colony's room if it is not spawned in
		if (this.room == undefined && this.overlord) {
			this.room = this.overlord.colony.room;
		}
		if (this.pos == undefined && this.overlord) {
			this.pos = this.overlord.colony.powerSpawn ? this.overlord.colony.powerSpawn.pos
													   : this.overlord.colony.pos;
		}
		Overmind.powerZerg[this.name] = this;
	}

	refresh(): void {
		// super.refresh(); // doesn't call super.refresh()
		const powerCreep = Game.powerCreeps[this.name] as PowerCreep | undefined;
		if (powerCreep) {
			this.creep = powerCreep;
			this.pos = powerCreep.pos;
			this.nextPos = powerCreep.pos;
			this.carry = powerCreep.carry;
			this.store = powerCreep.store;
			this.carryCapacity = powerCreep.carryCapacity;
			this.hits = powerCreep.hits;
			this.memory = powerCreep.memory;
			this.room = powerCreep.room as Room; // not actually as Room
			this.saying = powerCreep.saying;
			this.ticksToLive = powerCreep.ticksToLive;
			this.actionLog = {};
			this.blockMovement = false;
			this.deleteTime = powerCreep.deleteTime;
			this.level = powerCreep.level;
			this.powers = powerCreep.powers;
			this.shard = powerCreep.shard;
			this.spawnCooldownTime = powerCreep.spawnCooldownTime;
			this.isSpawned = !!this.shard && !!this.ticksToLive;
			if (this.room == undefined && this.overlord) {
				this.room = this.overlord.colony.room;
			}
			if (this.pos == undefined && this.overlord) {
				this.pos = this.overlord.colony.powerSpawn ? this.overlord.colony.powerSpawn.pos
														   : this.overlord.colony.pos;
			}
		} else {
			log.debug(`Deleting ${this.print} from global`);
			delete Overmind.powerZerg[this.name];
			delete global[this.name];
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
	enableRoom(controller: StructureController): ScreepsReturnCode {
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
	renew(target: StructurePowerBank | StructurePowerSpawn): ScreepsReturnCode {
		return this.creep.renew(target);
	}

	spawn(powerSpawn: StructurePowerSpawn): ScreepsReturnCode {
		return this.creep.spawn(powerSpawn);
	}

	/**
	 * Upgrade the creep, adding a new power ability to it or increasing the level of the existing power.
	 * You need one free Power Level in your account to perform this action.
	 */
	upgrade(power: PowerConstant): ScreepsReturnCode {
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
