import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Visualizer} from '../../visuals/Visualizer';
import {Directive} from '../Directive';
import {DirectiveNukeResponse} from '../situational/nukeResponse';
import {GenerateOps} from './powers/generateOps';
import {OperateExtension} from './powers/operateExtension';


interface DirectiveBaseOperatorMemory extends FlagMemory {
	powerPriorities: PowerConstant[];
}

export enum types {
	opgen,
	baseoperator,
	basedefender
}

/**
 * Simple directive to run a power creep where the flag name is the power creep name
 */
@profile
export class DirectiveBaseOperator extends Directive {

	static directiveName = 'BaseOperator';
	static color = COLOR_CYAN;
	static secondaryColor = COLOR_PURPLE;

	memory: DirectiveBaseOperatorMemory;

	// Power Creep Hack
	// powerCreep: PowerCreep;
	powerCreepName: string;

	defaultPowerPriorities: PowerConstant[] = [
		PWR_GENERATE_OPS,
		PWR_REGEN_SOURCE,
		PWR_OPERATE_TOWER,
		PWR_OPERATE_STORAGE,
		PWR_OPERATE_LAB,
		PWR_OPERATE_SPAWN,
		PWR_OPERATE_EXTENSION,
		PWR_REGEN_MINERAL];

	constructor(flag: Flag) {
		super(flag);
		const powerCreep = Game.powerCreeps[flag.name];
		if (!powerCreep) {
			log.error(`Power Creep not found for ${this.print}, deleting directive`);
			this.remove();
		}
		this.memory.powerPriorities = this.memory.powerPriorities || this.defaultPowerPriorities;
	}

	spawnMoarOverlords() {
	}

	init(): void {

	}


	// Wrapped powerCreep methods ==================================================================================

	renew(powerCreep: PowerCreep, powerSource: StructurePowerBank | StructurePowerSpawn) {
		if (powerCreep.pos.inRangeToPos(powerSource.pos, 1)) {
			return powerCreep.renew(powerSource);
		} else {
			return powerCreep.moveTo(powerSource, {
				ignoreRoads       : true, range: 1, swampCost: 1, reusePath: 0,
				visualizePathStyle: {lineStyle: 'dashed', fill: 'yellow'}
			});
		}
	}

	enablePower(powerCreep: PowerCreep, controller: StructureController) {
		log.alert(`Trying to enable power for ${controller} with `);
		if (powerCreep.pos.inRangeToPos(controller.pos, 1)) {
			return powerCreep.enableRoom(controller);
		} else {
			// let path = powerCreep.pos.findPathTo(controller, {ignoreRoads: true, range: 1, swampCost: 1});
			// log.alert(`Trying to enable power for ${controller} with ${JSON.stringify(path)}`);
			// return powerCreep.moveByPath(path);
			return powerCreep.moveTo(controller.pos, {
				ignoreRoads: true, range: 1, swampCost: 1,
				reusePath  : 0, visualizePathStyle: {lineStyle: 'solid'}
			});
		}
	}

	usePower(powerCreep: PowerCreep, power: PowerConstant) {
		// console.log(`The power constant is ${power}`)
		switch (power) {
			case PWR_GENERATE_OPS:
				return new GenerateOps(powerCreep);
			case PWR_OPERATE_EXTENSION:
				return new OperateExtension(powerCreep);
		}

	}

	runPowers(powerCreep: PowerCreep) {
		const priorities = this.memory.powerPriorities;
		for (const powerId in priorities) {
			const powerToUse = this.usePower(powerCreep, priorities[powerId]);
			if (powerToUse && powerToUse.operatePower()) {
				break;
			}
		}
	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
	}

	run(): void {
		const powerCreep = Game.powerCreeps[this.flag.name];
		if (!powerCreep || Game.cpu.bucket < 5000 && (!powerCreep.ticksToLive || powerCreep.ticksToLive > 500)) {
			this.powerCreepName = this.flag.name;
			// console.log('Not running power creep because not defined or bucket is low');
			return;
		}

		if (powerCreep.name == 'BaseDefender' && powerCreep.room && powerCreep.room.terminal) {
			powerCreep.usePower(PWR_OPERATE_TERMINAL, powerCreep.room.terminal);
		}

		// For the power creeps that just sit on power spawn
		const isStationary = powerCreep.name.toLowerCase().indexOf(types.basedefender.toString());
		if (powerCreep.name == 'activate') {
			console.log('Power creep move is ' + JSON.stringify(powerCreep.memory));
		}

		// console.log(`Running power creep ${JSON.stringify(powerCreep)}
		// with ttl ${powerCreep.ticksToLive} with ${this.room!.powerSpawn}`);
		if (!this.room) {
			return;
		} else if (!powerCreep.ticksToLive && this.room && this.room.powerSpawn) {
			// Spawn creep
			const res = powerCreep.spawn(this.room.powerSpawn);
			log.alert(`Running ${powerCreep} with spawn of ${res}`);
		} else if (this.room.controller && !this.room.controller.isPowerEnabled) {
			// Enable power
			const res = this.enablePower(powerCreep, this.room.controller);
			log.alert(`Running ${powerCreep} with enable power of ${res}`);
		} else if (powerCreep && powerCreep.ticksToLive && powerCreep.ticksToLive < 900 && this.room.powerSpawn) {
			const res = this.renew(powerCreep, this.room.powerSpawn);
			log.alert(`Running ${powerCreep} with renew of ${res}`);
		} else {
			const res = this.runPowers(powerCreep);
			// log.alert(`Running ${powerCreep} with power of ${res}`);
		}

		if (this.room.hostiles.length > 2 || (powerCreep.pos && DirectiveNukeResponse.isPresent(powerCreep.pos.roomName))) {
			const towersToBoost = this.colony.towers.filter(tower => !tower.effects || tower.effects.length == 0);
			if (towersToBoost.length > 0) {
				powerCreep.usePower(PWR_OPERATE_TOWER, towersToBoost[0]);
			}
			if ((!powerCreep.carry.ops || powerCreep.carry.ops < 20) && this.room.storage && this.room.storage.store.ops
				&& this.room.storage.store.ops > 100) {
				powerCreep.withdraw(this.room.storage, RESOURCE_OPS, 100);
			}
		}
	}

}
