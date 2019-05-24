import {CombatPlanner, SiegeAnalysis} from "../../strategy/CombatPlanner";
import {profile} from "../../profiler/decorator";
import {Directive} from "../Directive";
import {log} from "../../console/log";
import {Visualizer} from "../../visuals/Visualizer";
import {Power} from "./powers/genericPower";
import {GenerateOps} from "./powers/generateOps";


interface DirectiveBaseOperatorMemory extends FlagMemory {
	powerPriorities: PowerConstant[]
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

	defaultPowerPriorities: [
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
		if (this.pos.inRangeToPos(powerSource.pos, 1)) {
			return this.powerCreep.renew(powerSource);
		} else {
			return this.powerCreep.moveTo(powerSource);
		}
	}

	enablePower(controller: StructureController) {
		if (this.pos.inRangeToPos(controller.pos, 1)) {
			return this.powerCreep.enableRoom(controller);
		} else {
			return this.powerCreep.moveTo(controller);
		}
	}

	usePower(power: PowerConstant) {
		switch(power) {
			case PWR_GENERATE_OPS: return new GenerateOps();
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
		for (let powerId of priorities) {
			let powerToUse = this.usePower(powerId);
			if (powerToUse && powerToUse.operatePower()) {
				break;
			}
		}
	}


	run(): void {
		if (!this.room) {
			return;
		} else if (this.powerCreep.ticksToLive == undefined && this.powerCreep.spawnCooldownTime !> 0 && this.room && this.room.powerSpawn) {
			// Spawn creep
			this.powerCreep.spawn(this.room.powerSpawn);
		} else if (this.room.controller && !this.room.controller.isPowerEnabled) {
			// Enable power
			this.enablePower(this.room.controller);
		} else if (this.powerCreep && this.powerCreep.ticksToLive && this.powerCreep.ticksToLive < 300 && this.room.powerSpawn) {
			this.renew(this.room.powerSpawn);
		} else {
			this.runPowers();
		}


	}

	visuals(): void {
		Visualizer.marker(this.pos, {color: 'red'});
	}

}