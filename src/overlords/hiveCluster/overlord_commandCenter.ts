// Command center overlord: spawn and run a dediated commandCenter attendant
import {Overlord} from '../Overlord';
import {ManagerSetup} from '../../creepSetup/defaultSetups';
import {CommandCenter} from '../../hiveClusters/hiveCluster_commandCenter';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../priorities_overlords';
import {profile} from '../../profiler/decorator';

@profile
export class CommandCenterOverlord extends Overlord {

	managers: Zerg[];
	commandCenter: CommandCenter;

	constructor(commandCenter: CommandCenter, priority = OverlordPriority.spawning.commandCenter) {
		super(commandCenter, 'manager', priority);
		this.commandCenter = commandCenter;
		this.managers = this.creeps('manager');
	}

	init() {
		this.wishlist(1, new ManagerSetup());
	}

	private depositActions(manager: Zerg) {
		// If you have energy, deposit it to the best location
		if (this.commandCenter.depositStructures.length > 0) {
			// If something needs energy, put it there
			manager.task = Tasks.transfer(this.commandCenter.depositStructures[0]);
		} else {
			// Otherwise put to storage or terminal
			if (_.sum(this.commandCenter.storage.store) < this.commandCenter.settings.unloadStorageBuffer) {
				manager.task = Tasks.transfer(this.commandCenter.storage);
			} else if (this.commandCenter.terminal) {
				manager.task = Tasks.transfer(this.commandCenter.terminal);
			}
		}
	}

	private withdrawActions(manager: Zerg) {
		// If you're out of energy and there are strucutres that need energy deposited or withdrawn, then fill up
		// (Otherwise, stay empty to accept incoming link transmissions)
		if (this.commandCenter.depositStructures.length > 0 || this.commandCenter.withdrawStructures.length > 0) {
			if (this.commandCenter.withdrawStructures.length > 0) {
				// Try to withdraw from something actively reqeusting a withdrawal
				manager.task = Tasks.withdraw(this.commandCenter.withdrawStructures[0]);
			} else {
				// Otherwise, just default to withdrawing from storage
				manager.task = Tasks.withdraw(this.commandCenter.storage);
			}
		}
	}

	private handleManager(manager: Zerg): void {
		// Manager should initially go to idlePos before doing anything else
		if ((manager.ticksToLive || 0) >= CREEP_LIFE_TIME - 1) {
			manager.task = Tasks.goTo(this.commandCenter.idlePos, {travelToOptions: {range: 0}});
		}
		// Handle manager deposit and withdrawal of energy
		if (manager.carry.energy > 0) {
			this.depositActions(manager);
		} else {
			this.withdrawActions(manager);
		}
	}

	run() {
		for (let manager of this.managers) {
			// Get a task
			this.handleManager(manager);
			// If you have a valid task, run it; else go to idle pos
			if (manager.hasValidTask) {
				manager.run();
			} else {
				if (!manager.pos.isEqualTo(this.commandCenter.idlePos)) {
					manager.travelTo(this.commandCenter.idlePos);
				}
			}
		}
		// Delete extraneous managers in the case there are multiple
		if (this.managers.length > 1) {
			let nearbyManagers = _.filter(this.managers, manager => manager.pos.inRangeTo(this.commandCenter.pos, 3));
			let managerToSuicide = _.first(_.sortBy(nearbyManagers, manager => manager.ticksToLive));
			if (managerToSuicide) managerToSuicide.suicide();
		}
	}
}