import {Overlord} from './Overlord';
import {Priority} from '../config/priorities';
import {ManagerSetup} from '../creepSetup/defaultSetups';
import {TaskDeposit} from '../tasks/task_deposit';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {CommandCenter} from '../hiveClusters/hiveCluster_commandCenter';
import {Zerg} from '../Zerg';


// Command center overlord: spawn and run a dediated commandCenter attendant
export class CommandCenterOverlord extends Overlord {

	managers: Zerg[];
	commandCenter: CommandCenter;

	constructor(commandCenter: CommandCenter, priority = Priority.High) {
		super(commandCenter, 'manager', priority);
		this.commandCenter = commandCenter;
		this.managers = this.creeps('manager');
	}

	spawn() {
		this.wishlist(1, new ManagerSetup());
	}

	init() {
		this.spawn();
	}

	// private remainingSpace(structure: StructureStorage | StructureTerminal) {
	// 	return structure.storeCapacity - _.sum(structure.store);
	// }

	private depositActions(manager: Zerg) {
		// If you have energy, deposit it to the best location
		if (this.commandCenter.depositStructures.length > 0) {
			// If something needs energy, put it there
			manager.task = new TaskDeposit(this.commandCenter.depositStructures[0]);
		} else {
			// Otherwise put to storage or terminal
			if (_.sum(this.commandCenter.storage.store) < this.commandCenter.settings.unloadStorageBuffer) {
				manager.task = new TaskDeposit(this.commandCenter.storage);
			} else if (this.commandCenter.terminal) {
				manager.task = new TaskDeposit(this.commandCenter.terminal);
			}
		}
	}

	private withdrawActions(manager: Zerg) {
		// If you're out of energy and there are strucutres that need energy deposited or withdrawn, then fill up
		// (Otherwise, stay empty to accept incoming link transmissions)
		if (this.commandCenter.depositStructures.length > 0 || this.commandCenter.withdrawStructures.length > 0) {
			if (this.commandCenter.withdrawStructures.length > 0) {
				// Try to withdraw from something actively reqeusting a withdrawal
				manager.task = new TaskWithdraw(this.commandCenter.withdrawStructures[0]);
			} else {
				// Otherwise, just default to withdrawing from storage
				manager.task = new TaskWithdraw(this.commandCenter.storage);
			}
		}
	}

	private handleManager(manager: Zerg): void {
		// Handle manager deposit and withdrawal of energy
		if (manager.carry.energy > 0) {
			this.depositActions(manager);
		} else {
			this.withdrawActions(manager);
		}
		// If you still have nothing to do, go to the idle point
		if (manager.isIdle) {
			if (!manager.pos.isEqualTo(this.commandCenter.idlePos)) {
				manager.travelTo(this.commandCenter.idlePos);
			}
		}
	}

	run() {
		for (let manager of this.managers) {
			this.handleManager(manager);
		}
		// Delete extraneous managers in the case there are multiple
		if (this.managers.length > 1) {
			let nearbyManagers = _.filter(this.managers, manager => manager.pos.inRangeTo(this.commandCenter.pos, 3));
			let managerToSuicide = _.first(_.sortBy(nearbyManagers, manager => manager.ticksToLive));
			if (managerToSuicide) {
				managerToSuicide.suicide();
			}
		}
	}
}