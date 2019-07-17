import {CombatPlanner, SiegeAnalysis} from "../../strategy/CombatPlanner";
import {profile} from "../../profiler/decorator";
import {Directive} from "../Directive";
import {log} from "../../console/log";
import {Visualizer} from "../../visuals/Visualizer";
import {Power} from "./powers/genericPower";
import {GenerateOps} from "./powers/generateOps";


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
	powerCreep: PowerCreep;

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
		this.powerCreep = Game.powerCreeps[flag.name];
		if (!this.powerCreep) {
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

	renew(powerSource: StructurePowerBank | StructurePowerSpawn) {
		if (this.powerCreep.pos.inRangeToPos(powerSource.pos, 1)) {
			return this.powerCreep.renew(powerSource);
		} else {
			return this.powerCreep.moveTo(powerSource, {ignoreRoads: true, range: 1, swampCost: 1, reusePath: 0, visualizePathStyle: {lineStyle: "dashed", fill: 'yellow'}});
		}
	}

	enablePower(controller: StructureController) {
		log.alert(`Trying to enable power for ${controller} with `);
		if (this.powerCreep.pos.inRangeToPos(controller.pos, 1)) {
			return this.powerCreep.enableRoom(controller);
		} else {
			//let path = this.powerCreep.pos.findPathTo(controller, {ignoreRoads: true, range: 1, swampCost: 1});
			//log.alert(`Trying to enable power for ${controller} with ${JSON.stringify(path)}`);
			//return this.powerCreep.moveByPath(path);
			return this.powerCreep.moveTo(controller.pos, {ignoreRoads: true, range: 1, swampCost: 1, reusePath: 0, visualizePathStyle: {lineStyle: "solid"}});
		}
	}

	usePower(power: PowerConstant) {
		console.log(`The power constant is ${power}`)
		switch(power) {
			case PWR_GENERATE_OPS: return new GenerateOps(this.powerCreep);
//			case PWR_OPERATE_SPAWN: return this.operateSpawn();
		}

	}
	//
	// /**
	//  * Generate 1/2/4/6/8 ops resource units. Cooldown 50 ticks. Required creep level: 0/2/7/14/22.
	//  */
	// generateOps() {
	// 	if (this.powerCreep.powers[PWR_GENERATE_OPS].cooldown !> 0) {
	// 		return this.powerCreep.usePower(PWR_GENERATE_OPS);
	// 	}
	// 	return ERR_TIRED;
	// }
	//
	// operateSpawn(spawn?: StructureSpawn) {
	// 	// if (this.powerCreep.powers[PWR_oper])
	// 	// if (!spawn) {
	// 	// 	spawn = _.first(this.room!.spawns.filter(spawn => spawn.effects.length == 0));
	// 	// 	if (!spawn) {
	// 	// 		return ERR;
	// 	// 	}
	// 	// }
	// 	if (this.pos.inRangeToPos(spawn.pos, 1)) {
	// 		return this.powerCreep.usePower(PWR_OPERATE_SPAWN, spawn);
	// 	} else {
	// 		return this.powerCreep.moveTo(spawn);
	// 	}
	// }
	//
	// operateTower(tower: StructureTower) {
	// 	if (this.pos.inRangeToPos(tower.pos, POWER_INFO[PWR_OPERATE_TOWER].range)) {
	// 		return this.powerCreep.usePower(PWR_OPERATE_TOWER, tower);
	// 	} else {
	// 		return this.powerCreep.moveTo(tower);
	// 	}
	// }
	//
	// operateStorage(storage: StructureStorage) {
	// 	if (this.pos.inRangeToPos(storage.pos, POWER_INFO[PWR_OPERATE_STORAGE].range)) {
	// 		return this.powerCreep.usePower(PWR_OPERATE_STORAGE, storage);
	// 	} else {
	// 		return this.powerCreep.moveTo(storage);
	// 	}
	// }
	//
	// operateExtensions(container: StructureStorage | StructureTerminal | StructureContainer) {
	// 	if (this.pos.inRangeToPos(container.pos, POWER_INFO[PWR_OPERATE_EXTENSION].range)) {
	// 		return this.powerCreep.usePower(PWR_OPERATE_EXTENSION, container);
	// 	} else {
	// 		return this.powerCreep.moveTo(container);
	// 	}
	// }
	//
	// operateObserver(observer: StructureObserver) {
	// 	if (this.pos.inRangeToPos(observer.pos, POWER_INFO[PWR_OPERATE_OBSERVER].range)) {
	// 		return this.powerCreep.usePower(PWR_OPERATE_OBSERVER, observer);
	// 	} else {
	// 		return this.powerCreep.moveTo(observer);
	// 	}
	// }
	//
	// operateTerminal(terminal: StructureTerminal) {
	// 	if (this.pos.inRangeToPos(terminal.pos, POWER_INFO[PWR_OPERATE_TERMINAL].range)) {
	// 		return this.powerCreep.usePower(PWR_OPERATE_TERMINAL, terminal);
	// 	} else {
	// 		return this.powerCreep.moveTo(terminal);
	// 	}
	// }
	//
	// operatePower(power: StructurePowerSpawn) {
	// 	if (this.pos.inRangeToPos(power.pos, POWER_INFO[PWR_OPERATE_POWER].range)) {
	// 		return this.powerCreep.usePower(PWR_OPERATE_POWER, power);
	// 	} else {
	// 		return this.powerCreep.moveTo(power);
	// 	}
	// }
	//
	// operateController(controller: StructureController) {
	// 	if (this.pos.inRangeToPos(controller.pos, POWER_INFO[PWR_OPERATE_CONTROLLER].range)) {
	// 		return this.powerCreep.usePower(PWR_OPERATE_CONTROLLER, controller);
	// 	} else {
	// 		return this.powerCreep.moveTo(controller);
	// 	}
	// }
	//
	// // operateFactory(factory: StructureFactory) {
	// // 	if (this.pos.inRangeToPos(factory.pos, POWER_INFO[PWR_OPERATE_FACTORY].range)) {
	// // 		return this.powerCreep.usePower(PWR_OPERATE_FACTORY, factory);
	// // 	} else {
	// // 		return this.moveTo(factory);
	// // 	}
	// // }
	//
	// shield() {
	// 	if (this.powerCreep.powers[PWR_SHIELD].cooldown !> 0) {
	// 		return this.powerCreep.usePower(PWR_SHIELD);
	// 	}
	// 	return ERR_TIRED;
	// }
	//
	// regenSource(source : Source) {
	// 	if (this.pos.inRangeToPos(source.pos, POWER_INFO[PWR_REGEN_SOURCE].range)) {
	// 		return this.powerCreep.usePower(PWR_REGEN_SOURCE, source);
	// 	} else {
	// 		return this.powerCreep.moveTo(source);
	// 	}
	// }
	//
	// regenMineral(mineral: Mineral) {
	// 	if (this.pos.inRangeToPos(mineral.pos, POWER_INFO[PWR_REGEN_MINERAL].range)) {
	// 		return this.powerCreep.usePower(PWR_REGEN_MINERAL, mineral);
	// 	} else {
	// 		return this.powerCreep.moveTo(mineral);
	// 	}
	// }
	//
	// fortify(rampart: StructureRampart) {
	// 	if (this.pos.inRangeToPos(rampart.pos, POWER_INFO[PWR_FORTIFY].range)) {
	// 		return this.powerCreep.usePower(PWR_FORTIFY, rampart);
	// 	} else {
	// 		return this.powerCreep.moveTo(rampart);
	// 	}
	// }
	//
	// operateLab(lab: StructureLab) {
	// 	if (this.pos.inRangeToPos(lab.pos, POWER_INFO[PWR_OPERATE_LAB].range)) {
	// 		return this.powerCreep.usePower(PWR_OPERATE_LAB, lab);
	// 	} else {
	// 		return this.powerCreep.moveTo(lab);
	// 	}
	// }


	runPowers() {
		const priorities = this.memory.powerPriorities;
		console.log(`Powerid of priority list of ${priorities}`);
		for (let powerId in priorities) {
			console.log(`Powerid of ${powerId} and list of ${priorities}`);
			let powerToUse = this.usePower(priorities[powerId]);
			if (powerToUse && powerToUse.operatePower()) {
				break;
			}
		}
	}


	run(): void {

		// For the power creeps that just sit on power spawn
		const isStationary = this.powerCreep.name.toLowerCase().indexOf(types.basedefender.toString());

		console.log(`Running power creep ${JSON.stringify(this.powerCreep)} with ttl ${this.powerCreep.ticksToLive} with ${this.room!.powerSpawn}`);
		if (!this.room) {
			return;
		} else if (!this.powerCreep.ticksToLive && this.room && this.room.powerSpawn) {
			// Spawn creep
			let res = this.powerCreep.spawn(this.room.powerSpawn);
			log.alert(`Running ${this.powerCreep} with spawn of ${res}`);
		} else if (this.room.controller && !this.room.controller.isPowerEnabled && !isStationary) {
			// Enable power
			let res = this.enablePower(this.room.controller);
			log.alert(`Running ${this.powerCreep} with enable power of ${res}`);
		} else if (this.powerCreep && this.powerCreep.ticksToLive && this.powerCreep.ticksToLive < 900 && this.room.powerSpawn) {
			let res = this.renew(this.room.powerSpawn);
			log.alert(`Running ${this.powerCreep} with renew of ${res}`);
		} else {
			let res = this.runPowers();
			log.alert(`Running ${this.powerCreep} with power of ${res}`);
		}


	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
	}

}