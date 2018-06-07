// Command center overlord: spawn and run a dediated commandCenter attendant
import {Overlord} from '../Overlord';
import {CommandCenter} from '../../hiveClusters/commandCenter';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CreepSetup} from '../CreepSetup';
import {EvolutionChamber} from '../../hiveClusters/evolutionChamber';
import {StoreStructure} from '../../declarations/typeGuards';
import {TransportRequestGroup} from '../../logistics/TransportRequestGroup';
import {Energetics} from '../../logistics/Energetics';

export const ManagerSetup = new CreepSetup('manager', {
	pattern  : [CARRY, CARRY, MOVE],
	sizeLimit: 8,
});

@profile
export class CommandCenterOverlord extends Overlord {

	managers: Zerg[];
	commandCenter: CommandCenter;
	evolutionChamber: EvolutionChamber | undefined;
	transportRequests: TransportRequestGroup;

	constructor(commandCenter: CommandCenter, priority = OverlordPriority.spawning.commandCenter) {
		super(commandCenter, 'manager', priority);
		this.commandCenter = commandCenter;
		this.transportRequests = this.commandCenter.transportRequests;
		this.evolutionChamber = undefined; // This gets filled in during init()
		this.managers = this.creeps('manager');
	}

	init() {
		this.evolutionChamber = this.colony.evolutionChamber;
		this.wishlist(1, ManagerSetup);
	}

	private supplyActions(manager: Zerg) {
		let request = this.transportRequests.getPrioritizedClosestRequest(manager.pos, 'supply');
		if (request) {
			let amount = Math.min(request.amount, manager.carryCapacity);
			manager.task = Tasks.transfer(request.target, request.resourceType, amount);
			if ((manager.carry[request.resourceType] || 0) < amount) {
				// If you are currently carrying other crap, overwrite current task and put junk in terminal/storage
				if (_.sum(manager.carry) > (manager.carry[request.resourceType] || 0)) {
					manager.task = Tasks.transferAll(this.commandCenter.terminal || this.commandCenter.storage);
				}
				// Otherwise withdraw as much as you can hold
				else {
					let withdrawFrom: StoreStructure = this.commandCenter.storage;
					if (request.resourceType != RESOURCE_ENERGY && this.commandCenter.terminal) {
						withdrawFrom = this.commandCenter.terminal;
					}
					let withdrawAmount = amount - _.sum(manager.carry);
					manager.task.fork(Tasks.withdraw(withdrawFrom, request.resourceType, withdrawAmount));
				}
			}
		}
		// else {
		// 	// Otherwise put to storage or terminal
		// 	if (_.sum(this.commandCenter.storage.store) < this.commandCenter.settings.unloadStorageBuffer) {
		// 		manager.task = Tasks.transfer(this.commandCenter.storage);
		// 	} else if (this.commandCenter.terminal) {
		// 		manager.task = Tasks.transfer(this.commandCenter.terminal);
		// 	}
		// }
	}

	private withdrawActions(manager: Zerg) {
		let request = this.transportRequests.getPrioritizedClosestRequest(manager.pos, 'withdraw');
		if (request) {
			let amount = Math.min(request.amount, manager.carryCapacity - _.sum(manager.carry));
			manager.task = Tasks.withdraw(request.target, request.resourceType, amount);
		}
		// // If you're out of energy and there are strucutres that need energy deposited or withdrawn, then fill up
		// // (Otherwise, stay empty to accept incoming link transmissions)
		// if (this.commandCenter.depositStructures.length > 0 || this.commandCenter.withdrawStructures.length > 0) {
		// 	if (this.commandCenter.withdrawStructures.length > 0) {
		// 		// Try to withdraw from something actively reqeusting a withdrawal
		// 		manager.task = Tasks.withdraw(this.commandCenter.withdrawStructures[0]);
		// 	} else {
		// 		// Otherwise, just default to withdrawing from storage
		// 		manager.task = Tasks.withdraw(this.commandCenter.storage);
		// 	}
		// }
	}

	private equalizeStorageAndTerminal(manager: Zerg) {
		let storage = this.commandCenter.storage;
		let terminal = this.commandCenter.terminal;
		if (!storage || !terminal) {
			return;
		}
		// Move energy from terminal to storage if there is too much in terminal and there is space in storage
		if (terminal.energy > Energetics.settings.terminal.energy.equilibrium) {
			if (_.sum(storage.store) < Energetics.settings.storage.total.cap) {
				manager.task = Tasks.withdraw(terminal);
				manager.task.parent = Tasks.transfer(storage);
				return;
			}
		}
		// Move energy from storage to terminal if there is not enough in terminal
		if (terminal.energy < Energetics.settings.terminal.energy.inThreshold) {
			manager.task = Tasks.withdraw(storage);
			manager.task.parent = Tasks.transfer(terminal);
			return;
		}
		// Move all non-energy resources from storage to terminal
		for (let resourceType in storage.store) {
			if (resourceType != RESOURCE_ENERGY && storage.store[<ResourceConstant>resourceType]! > 0) {
				manager.task = Tasks.withdraw(storage, <ResourceConstant>resourceType);
				manager.task.parent = Tasks.transfer(terminal, <ResourceConstant>resourceType);
				return;
			}
		}
	}

	// Suicide once you get old and make sure you don't drop and waste any resources
	private handleManagerDeath(manager: Zerg) {
		if (_.sum(manager.carry) == 0 && this.managers.length > 0) {
			manager.suicide();
		} else {
			manager.task = Tasks.transferAll(this.commandCenter.terminal || this.commandCenter.storage);
		}
	}

	private handleManager(manager: Zerg): void {
		// // Handle manager deposit and withdrawal of energy
		// if (manager.carry.energy > 0) {
		// 	this.supplyActions(manager);
		// } else {
		// 	this.withdrawActions(manager);
		// }
		if (manager.ticksToLive! < 50) {
			let nearbyManagers = _.filter(this.managers, manager => manager.pos.inRangeTo(this.commandCenter.pos, 3));
			if (nearbyManagers.length > 1) {
				this.handleManagerDeath(manager);
				return;
			}
		}
		if (this.transportRequests.needsWithdrawing) {
			if (_.sum(manager.carry) < manager.carryCapacity) {
				this.withdrawActions(manager);
			} else {
				manager.task = Tasks.transferAll(this.commandCenter.terminal || this.commandCenter.storage);
			}
		} else if (this.transportRequests.needsSupplying) {
			this.supplyActions(manager);
		} else {
			this.equalizeStorageAndTerminal(manager);
		}
	}

	run() {
		for (let manager of this.managers) {
			// Get a task if needed
			if (manager.isIdle) {
				this.handleManager(manager);
			}
			// If you have a valid task, run it; else go to idle pos
			if (manager.hasValidTask) {
				manager.run();
			} else {
				if (!manager.pos.isEqualTo(this.commandCenter.idlePos)) {
					manager.travelTo(this.commandCenter.idlePos);
				}
			}
		}
		// // Delete extraneous managers in the case there are multiple
		// if (this.managers.length > 1) {
		// 	let nearbyManagers = _.filter(this.managers, manager => manager.pos.inRangeTo(this.commandCenter.pos, 3));
		// 	let managerToSuicide = _.first(_.sortBy(nearbyManagers, manager => manager.ticksToLive));
		// 	if (managerToSuicide) managerToSuicide.suicide();
		// }
	}
}