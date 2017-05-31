// // Linker - transfers energy from link to storage
//
// import {taskWithdraw} from '../tasks/task_withdraw';
// import {taskDeposit} from '../tasks/task_deposit';
// import {taskGoTo} from '../tasks/task_goTo';
// import {AbstractCreep, AbstractSetup} from './Abstract';
//
// export class LinkerSetup extends AbstractSetup {
// 	constructor() {
// 		super('linker');
// 		// Role-specific settings
// 		this.settings.bodyPattern = [CARRY, CARRY, MOVE];
// 		this.settings.consoleQuiet = true;
// 		this.settings.sayQuiet = true;
// 		this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(MOVE) > 1 &&
// 												  creep.getActiveBodyparts(CARRY) > 1;
// 	}
//
// 	onCreate(creep: protoCreep): protoCreep {
// 		let colonyRoom = Game.rooms[creep.memory.colony];
// 		let idleFlag = _.filter(colonyRoom.flags,
// 								flag => flagCodes.rally.idlePoint.filter(flag) &&
// 										(flag.memory.role == this.name || flag.name.includes(this.name)))[0];
// 		if (idleFlag) {
// 			creep.memory.data.idleFlag = idleFlag.name;
// 		}
// 		return creep;
// 	}
// }
//
//
// export class LinkerCreep extends AbstractCreep {
//
// 	constructor(creep: Creep) {
// 		super(creep);
// 	}
//
// 	collect() {
// 		var target: Link | StructureStorage | Terminal;
// 		let storage = this.colony.storage;
// 		if (!storage) {
// 			return '';
// 		}
// 		if (storage.links[0].energy > 0) {
// 			// try targeting non-empty input links
// 			this.task = new taskWithdraw(storage.links[0]);
// 		} else if (_.sum(storage.store) > this.colony.overlord.settings.unloadStorageBuffer) {
// 			// else try unloading from storage into terminal if there is too much energy
// 			this.task = new taskWithdraw(storage);
// 		} else if (this.colony.terminal && this.colony.terminal.energy >
// 										   this.colony.terminal.brain.settings.resourceAmounts[RESOURCE_ENERGY]
// 										   + this.colony.terminal.brain.settings.excessTransferAmount) {
// 			// if there is not too much energy in storage and there is too much in terminal, collect from terminal
// 			this.task = new taskWithdraw(this.colony.terminal);
// 		}
// 	}
//
// 	deposit() {
// 		let storage = this.colony.storage;
// 		var target;
// 		// deposit to storage
// 		if (storage && _.sum(storage.store) < this.colony.overlord.settings.unloadStorageBuffer) {
// 			target = storage;
// 		}
// 		// overwrite and deposit to terminal if not enough energy in terminal and sufficient energy in storage
// 		let terminal = this.colony.terminal;
// 		if (terminal &&
// 			terminal.energy < terminal.brain.settings.resourceAmounts[RESOURCE_ENERGY] &&
// 			storage && storage.creepCanWithdrawEnergy(this)) {
// 			target = terminal;
// 		} else if (terminal && storage &&
// 				   storage.energy >= this.colony.overlord.settings.unloadStorageBuffer) {
// 			target = terminal;
// 		}
// 		if (target) {
// 			this.task = new taskDeposit(target);
// 		}
// 	}
//
// 	newTask(): void {
// 		this.task = null;
// 		let idleFlag = Game.flags[this.memory.data.idleFlag];
// 		if (idleFlag && !this.pos.inRangeTo(idleFlag, 1)) {
// 			this.task = new taskGoTo(idleFlag);
// 		} else {
// 			if (this.carry.energy == 0) {
// 				this.collect();
// 			} else {
// 				this.deposit();
// 			}
// 		}
// 	}
// }
