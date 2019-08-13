import {CombatPlanner, SiegeAnalysis} from "../../strategy/CombatPlanner";
import {profile} from "../../profiler/decorator";
import {Directive} from "../Directive";
import {log} from "../../console/log";
import {Visualizer} from "../../visuals/Visualizer";
import {Power} from "./powers/genericPower";
import {GenerateOps} from "./powers/generateOps";
import {DirectiveNukeResponse} from "../situational/nukeResponse";
import {OperateExtension} from "./powers/operateExtension";


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
	//powerCreep: PowerCreep;
	powerCreepName: string;

	defaultPowerPriorities: PowerConstant[] = [
		PWR_GENERATE_OPS,
		PWR_REGEN_SOURCE,
		PWR_OPERATE_TOWER,
		PWR_OPERATE_LAB,
		PWR_OPERATE_SPAWN,
		PWR_OPERATE_EXTENSION,
		PWR_REGEN_MINERAL];

	// overlords: {
	// 	scout?: StationaryScoutOverlord;
	// 	destroy?: SwarmDestroyerOverlord | PairDestroyerOverlord;
	// 	guard?: OutpostDefenseOverlord;
	// 	controllerAttack?: ControllerAttackerOverlord;
	// };

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


	// Wrapped powerCreep methods ===========================================================================================

	renew(powerCreep: PowerCreep, powerSource: StructurePowerBank | StructurePowerSpawn) {
		if (powerCreep.pos.inRangeToPos(powerSource.pos, 1)) {
			return powerCreep.renew(powerSource);
		} else {
			return powerCreep.moveTo(powerSource, {ignoreRoads: true, range: 1, swampCost: 1, reusePath: 0, visualizePathStyle: {lineStyle: "dashed", fill: 'yellow'}});
		}
	}

	enablePower(powerCreep: PowerCreep, controller: StructureController) {
		log.alert(`Trying to enable power for ${controller} with `);
		if (powerCreep.pos.inRangeToPos(controller.pos, 1)) {
			return powerCreep.enableRoom(controller);
		} else {
			//let path = powerCreep.pos.findPathTo(controller, {ignoreRoads: true, range: 1, swampCost: 1});
			//log.alert(`Trying to enable power for ${controller} with ${JSON.stringify(path)}`);
			//return powerCreep.moveByPath(path);
			return powerCreep.moveTo(controller.pos, {ignoreRoads: true, range: 1, swampCost: 1, reusePath: 0, visualizePathStyle: {lineStyle: "solid"}});
		}
	}

	usePower(powerCreep: PowerCreep, power: PowerConstant) {
		console.log(`The power constant is ${power}`)
		switch(power) {
			case PWR_GENERATE_OPS: return new GenerateOps(powerCreep);
			case PWR_OPERATE_EXTENSION: return new OperateExtension(powerCreep);
//			case PWR_OPERATE_SPAWN: return this.operateSpawn();
		}

	}
	//
	// /**
	//  * Generate 1/2/4/6/8 ops resource units. Cooldown 50 ticks. Required creep level: 0/2/7/14/22.
	//  */
	// generateOps() {
	// 	if (powerCreep.powers[PWR_GENERATE_OPS].cooldown !> 0) {
	// 		return powerCreep.usePower(PWR_GENERATE_OPS);
	// 	}
	// 	return ERR_TIRED;
	// }
	//
	// operateSpawn(spawn?: StructureSpawn) {
	// 	// if (powerCreep.powers[PWR_oper])
	// 	// if (!spawn) {
	// 	// 	spawn = _.first(this.room!.spawns.filter(spawn => spawn.effects.length == 0));
	// 	// 	if (!spawn) {
	// 	// 		return ERR;
	// 	// 	}
	// 	// }
	// 	if (this.pos.inRangeToPos(spawn.pos, 1)) {
	// 		return powerCreep.usePower(PWR_OPERATE_SPAWN, spawn);
	// 	} else {
	// 		return powerCreep.moveTo(spawn);
	// 	}
	// }
	//
	// operateTower(tower: StructureTower) {
	// 	if (this.pos.inRangeToPos(tower.pos, POWER_INFO[PWR_OPERATE_TOWER].range)) {
	// 		return powerCreep.usePower(PWR_OPERATE_TOWER, tower);
	// 	} else {
	// 		return powerCreep.moveTo(tower);
	// 	}
	// }
	//
	// operateStorage(storage: StructureStorage) {
	// 	if (this.pos.inRangeToPos(storage.pos, POWER_INFO[PWR_OPERATE_STORAGE].range)) {
	// 		return powerCreep.usePower(PWR_OPERATE_STORAGE, storage);
	// 	} else {
	// 		return powerCreep.moveTo(storage);
	// 	}
	// }
	//
	// operateExtensions(container: StructureStorage | StructureTerminal | StructureContainer) {
	// 	if (this.pos.inRangeToPos(container.pos, POWER_INFO[PWR_OPERATE_EXTENSION].range)) {
	// 		return powerCreep.usePower(PWR_OPERATE_EXTENSION, container);
	// 	} else {
	// 		return powerCreep.moveTo(container);
	// 	}
	// }
	//
	// operateObserver(observer: StructureObserver) {
	// 	if (this.pos.inRangeToPos(observer.pos, POWER_INFO[PWR_OPERATE_OBSERVER].range)) {
	// 		return powerCreep.usePower(PWR_OPERATE_OBSERVER, observer);
	// 	} else {
	// 		return powerCreep.moveTo(observer);
	// 	}
	// }
	//
	// operateTerminal(terminal: StructureTerminal) {
	// 	if (this.pos.inRangeToPos(terminal.pos, POWER_INFO[PWR_OPERATE_TERMINAL].range)) {
	// 		return powerCreep.usePower(PWR_OPERATE_TERMINAL, terminal);
	// 	} else {
	// 		return powerCreep.moveTo(terminal);
	// 	}
	// }
	//
	// operatePower(power: StructurePowerSpawn) {
	// 	if (this.pos.inRangeToPos(power.pos, POWER_INFO[PWR_OPERATE_POWER].range)) {
	// 		return powerCreep.usePower(PWR_OPERATE_POWER, power);
	// 	} else {
	// 		return powerCreep.moveTo(power);
	// 	}
	// }
	//
	// operateController(controller: StructureController) {
	// 	if (this.pos.inRangeToPos(controller.pos, POWER_INFO[PWR_OPERATE_CONTROLLER].range)) {
	// 		return powerCreep.usePower(PWR_OPERATE_CONTROLLER, controller);
	// 	} else {
	// 		return powerCreep.moveTo(controller);
	// 	}
	// }
	//
	// // operateFactory(factory: StructureFactory) {
	// // 	if (this.pos.inRangeToPos(factory.pos, POWER_INFO[PWR_OPERATE_FACTORY].range)) {
	// // 		return powerCreep.usePower(PWR_OPERATE_FACTORY, factory);
	// // 	} else {
	// // 		return this.moveTo(factory);
	// // 	}
	// // }
	//
	// shield() {
	// 	if (powerCreep.powers[PWR_SHIELD].cooldown !> 0) {
	// 		return powerCreep.usePower(PWR_SHIELD);
	// 	}
	// 	return ERR_TIRED;
	// }
	//
	// regenSource(source : Source) {
	// 	if (this.pos.inRangeToPos(source.pos, POWER_INFO[PWR_REGEN_SOURCE].range)) {
	// 		return powerCreep.usePower(PWR_REGEN_SOURCE, source);
	// 	} else {
	// 		return powerCreep.moveTo(source);
	// 	}
	// }
	//
	// regenMineral(mineral: Mineral) {
	// 	if (this.pos.inRangeToPos(mineral.pos, POWER_INFO[PWR_REGEN_MINERAL].range)) {
	// 		return powerCreep.usePower(PWR_REGEN_MINERAL, mineral);
	// 	} else {
	// 		return powerCreep.moveTo(mineral);
	// 	}
	// }
	//
	// fortify(rampart: StructureRampart) {
	// 	if (this.pos.inRangeToPos(rampart.pos, POWER_INFO[PWR_FORTIFY].range)) {
	// 		return powerCreep.usePower(PWR_FORTIFY, rampart);
	// 	} else {
	// 		return powerCreep.moveTo(rampart);
	// 	}
	// }
	//
	// operateLab(lab: StructureLab) {
	// 	if (this.pos.inRangeToPos(lab.pos, POWER_INFO[PWR_OPERATE_LAB].range)) {
	// 		return powerCreep.usePower(PWR_OPERATE_LAB, lab);
	// 	} else {
	// 		return powerCreep.moveTo(lab);
	// 	}
	// }


	runPowers(powerCreep: PowerCreep) {
		const priorities = this.memory.powerPriorities;
		console.log(`Powerid of priority list of ${priorities}`);
		for (let powerId in priorities) {
			console.log(`Powerid of ${powerId} and list of ${priorities}`);
			let powerToUse = this.usePower(powerCreep, priorities[powerId]);
			if (powerToUse && powerToUse.operatePower()) {
				break;
			}
		}
	}


	run(): void {
		const powerCreep = Game.powerCreeps[this.powerCreepName];

		// For the power creeps that just sit on power spawn
		const isStationary = powerCreep.name.toLowerCase().indexOf(types.basedefender.toString());

		console.log(`Running power creep ${JSON.stringify(powerCreep)} with ttl ${powerCreep.ticksToLive} with ${this.room!.powerSpawn}`);
		if (!this.room) {
			return;
		} else if (!powerCreep.ticksToLive && this.room && this.room.powerSpawn) {
			// Spawn creep
			let res = powerCreep.spawn(this.room.powerSpawn);
			log.alert(`Running ${powerCreep} with spawn of ${res}`);
		} else if (this.room.controller && !this.room.controller.isPowerEnabled && !isStationary) {
			// Enable power
			let res = this.enablePower(powerCreep, this.room.controller);
			log.alert(`Running ${powerCreep} with enable power of ${res}`);
		} else if (powerCreep && powerCreep.ticksToLive && powerCreep.ticksToLive < 900 && this.room.powerSpawn) {
			let res = this.renew(powerCreep, this.room.powerSpawn);
			log.alert(`Running ${powerCreep} with renew of ${res}`);
		} else {
			let res = this.runPowers(powerCreep);
			log.alert(`Running ${powerCreep} with power of ${res}`);
		}

		if (this.room.hostiles.length > 2 || (powerCreep.pos && DirectiveNukeResponse.isPresent(powerCreep.pos, 'room'))) {
			const towersToBoost = this.colony.towers.filter(tower => !tower.effects || tower.effects.length == 0);
			if (towersToBoost.length > 0) {
				powerCreep.usePower(PWR_OPERATE_TOWER, towersToBoost[0])
			}
			if ((!powerCreep.carry.ops || powerCreep.carry.ops < 20) && this.room.storage && this.room.storage.store.ops && this.room.storage.store.ops > 100) {
				powerCreep.withdraw(this.room.storage, RESOURCE_OPS, 100);
			}
		}


	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
	}

}