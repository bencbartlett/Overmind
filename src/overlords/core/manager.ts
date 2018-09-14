// Command center overlord: spawn and run a dediated commandCenter attendant
import {Overlord} from '../Overlord';
import {CommandCenter} from '../../hiveClusters/commandCenter';
import {Zerg} from '../../zerg/Zerg';
import {Tasks} from '../../tasks/Tasks';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {StoreStructure} from '../../declarations/typeGuards';
import {Energetics} from '../../logistics/Energetics';
import {SpawnRequestOptions} from '../../hiveClusters/hatchery';
import {hasMinerals, minBy} from '../../utilities/utils';
import {$} from '../../caching/GlobalCache';
import {WorkerOverlord} from './worker';
import {Roles, Setups} from '../../creepSetups/setups';

@profile
export class CommandCenterOverlord extends Overlord {

	mode: 'twoPart' | 'bunker';
	managers: Zerg[];
	commandCenter: CommandCenter;
	depositTarget: StructureTerminal | StructureStorage;
	managerRepairTarget: StructureRampart | StructureWall | undefined;

	constructor(commandCenter: CommandCenter, priority = OverlordPriority.core.manager) {
		super(commandCenter, 'manager', priority);
		this.commandCenter = commandCenter;
		this.mode = this.colony.layout;
		this.managers = this.zerg(Roles.manager);
		if (this.commandCenter.terminal && _.sum(this.commandCenter.terminal.store) < TERMINAL_CAPACITY - 1000) {
			this.depositTarget = this.commandCenter.terminal;
		} else {
			this.depositTarget = this.commandCenter.storage;
		}
		if (this.colony.bunker) {
			let anchor = this.colony.bunker.anchor;
			$.set(this, 'managerRepairTarget',
				  () => minBy(_.filter(anchor.findInRange(anchor.room!.barriers, 3),
									   b => b.hits < WorkerOverlord.settings.barrierHits[this.colony.level]),
							  b => b.hits));
		}
	}

	refresh() {
		super.refresh();
		$.refresh(this, 'depositTarget', 'managerRepairTarget');
	}

	init() {
		let setup = Setups.managers.default;
		let spawnRequestOptions: SpawnRequestOptions = {};
		if (this.colony.bunker && this.colony.bunker.coreSpawn && this.colony.level == 8
			&& !this.colony.roomPlanner.memory.relocating) {
			setup = Setups.managers.stationary;
			if (this.managerRepairTarget && this.colony.assets.energy > WorkerOverlord.settings.fortifyDutyThreshold) {
				setup = Setups.managers.stationary_work; // use working manager body if you have something to repair
			}
			spawnRequestOptions = {
				spawn     : this.colony.bunker.coreSpawn,
				directions: [this.colony.bunker.coreSpawn.pos.getDirectionTo(this.colony.bunker.anchor)]
			};
		}
		this.wishlist(1, setup, {options: spawnRequestOptions});
	}

	private unloadCarry(manager: Zerg): boolean {
		// Move anything you are currently holding to deposit location
		if (_.sum(manager.carry) > 0) {
			manager.task = Tasks.transferAll(this.depositTarget);
			return true;
		} else {
			return false;
		}
	}

	private supplyActions(manager: Zerg) {
		let request = this.commandCenter.transportRequests.getPrioritizedClosestRequest(manager.pos, 'supply');
		if (request) {
			let amount = Math.min(request.amount, manager.carryCapacity);
			manager.task = Tasks.transfer(request.target, request.resourceType, amount,
										  {nextPos: this.commandCenter.idlePos});
			if ((manager.carry[request.resourceType] || 0) < amount) {
				// If you are currently carrying other crap, overwrite current task and put junk in terminal/storage
				if (_.sum(manager.carry) > (manager.carry[request.resourceType] || 0)) {
					manager.task = Tasks.transferAll(this.depositTarget);
				}
				// Otherwise withdraw as much as you can hold
				else {
					let withdrawAmount = amount - _.sum(manager.carry);
					let withdrawFrom: StoreStructure = this.commandCenter.storage;
					if (this.commandCenter.terminal
						&& (request.resourceType != RESOURCE_ENERGY
							|| (withdrawFrom.store[request.resourceType] || 0) < withdrawAmount
							|| this.commandCenter.terminal.energy > Energetics.settings.terminal.energy.equilibrium)) {
						withdrawFrom = this.commandCenter.terminal;
					}
					manager.task.fork(Tasks.withdraw(withdrawFrom, request.resourceType, withdrawAmount,
													 {nextPos: request.target.pos}));
				}
			}
		}
	}

	private withdrawActions(manager: Zerg): boolean {
		if (_.sum(manager.carry) < manager.carryCapacity) {
			let request = this.commandCenter.transportRequests.getPrioritizedClosestRequest(manager.pos, 'withdraw');
			if (request) {
				let amount = Math.min(request.amount, manager.carryCapacity - _.sum(manager.carry));
				manager.task = Tasks.withdraw(request.target, request.resourceType, amount);
				return true;
			}
		} else {
			manager.task = Tasks.transferAll(this.depositTarget);
			return true;
		}
		return false;
	}

	private equalizeStorageAndTerminal(manager: Zerg): boolean {
		const storage = this.commandCenter.storage;
		const terminal = this.commandCenter.terminal;
		if (!storage || !terminal) return false;

		const tolerance = Energetics.settings.terminal.energy.tolerance;
		let storageEnergyCap = Energetics.settings.storage.total.cap;
		let terminalState = this.colony.terminalState;
		// Adjust max energy allowable in storage if there's an exception state happening
		if (terminalState && terminalState.type == 'out') {
			storageEnergyCap = terminalState.amounts[RESOURCE_ENERGY] || 0;
		}
		// Move energy from storage to terminal if there is not enough in terminal or if there's terminal evacuation
		if (terminal.energy < Energetics.settings.terminal.energy.equilibrium - tolerance
			|| storage.energy > storageEnergyCap) {
			if (this.unloadCarry(manager)) return true;
			manager.task = Tasks.withdraw(storage);
			manager.task.parent = Tasks.transfer(terminal);
			return true;
		}
		// Move energy from terminal to storage if there is too much in terminal and there is space in storage
		if (terminal.energy > Energetics.settings.terminal.energy.equilibrium + tolerance
			&& _.sum(storage.store) < storageEnergyCap) {
			if (this.unloadCarry(manager)) return true;
			manager.task = Tasks.withdraw(terminal);
			manager.task.parent = Tasks.transfer(storage);
			return true;
		}
		// Nothing has happened
		return false;
	}

	private moveMineralsToTerminal(manager: Zerg): boolean {
		const storage = this.commandCenter.storage;
		const terminal = this.commandCenter.terminal;
		if (!storage || !terminal) {
			return false;
		}
		// Move all non-energy resources from storage to terminal
		for (let resourceType in storage.store) {
			if (resourceType != RESOURCE_ENERGY && storage.store[<ResourceConstant>resourceType]! > 0) {
				if (this.unloadCarry(manager)) return true;
				manager.task = Tasks.withdraw(storage, <ResourceConstant>resourceType);
				manager.task.parent = Tasks.transfer(terminal, <ResourceConstant>resourceType);
				return true;
			}
		}
		return false;
	}

	private pickupActions(manager: Zerg): boolean {
		// Pickup any resources that happen to be dropped where you are
		let resources = manager.pos.lookFor(LOOK_RESOURCES);
		if (resources.length > 0) {
			manager.task = Tasks.transferAll(this.depositTarget).fork(Tasks.pickup(resources[0]));
			return true;
		}
		// Look for tombstones at position
		let tombstones = manager.pos.lookFor(LOOK_TOMBSTONES);
		if (tombstones.length > 0) {
			manager.task = Tasks.transferAll(this.depositTarget).fork(Tasks.withdrawAll(tombstones[0]));
			return true;
		}
		return false;
	}

	// Suicide once you get old and make sure you don't drop and waste any resources
	private deathActions(manager: Zerg): boolean {
		let nearbyManagers = _.filter(this.managers, manager => manager.pos.inRangeTo(this.commandCenter.pos, 3));
		if (nearbyManagers.length > 1) {
			if (_.sum(manager.carry) == 0) {
				let nearbySpawn = _.first(manager.pos.findInRange(manager.room.spawns, 1));
				if (nearbySpawn) {
					nearbySpawn.recycleCreep(manager.creep);
				} else {
					manager.suicide();
				}
			} else {
				manager.task = Tasks.transferAll(this.depositTarget);
			}
			return true;
		}
		return false;
	}

	private handleManager(manager: Zerg): void {
		// Handle switching to next manager
		if (manager.ticksToLive! < 150) {
			if (this.deathActions(manager)) return;
		}
		// Pick up any dropped resources on ground
		if (this.pickupActions(manager)) return;
		// Move minerals from storage to terminal if needed
		if (hasMinerals(this.commandCenter.storage.store)) {
			if (this.moveMineralsToTerminal(manager)) return;
		}
		// Moving energy to terminal gets priority if evacuating room
		if (this.colony.terminalState && this.colony.terminalState.type == 'out') {
			if (this.equalizeStorageAndTerminal(manager)) return;
		}
		// Fulfill withdraw requests
		if (this.commandCenter.transportRequests.needsWithdrawing) {
			if (this.withdrawActions(manager)) return;
		}
		// Fulfill supply requests
		if (this.commandCenter.transportRequests.needsSupplying) {
			if (this.supplyActions(manager)) return;
		}
		// Move energy between storage and terminal if needed
		this.equalizeStorageAndTerminal(manager);
	}

	private idleActions(manager: Zerg): void {
		if (this.mode == 'bunker' && this.managerRepairTarget && manager.getActiveBodyparts(WORK) > 0) {
			// Repair ramparts when idle
			if (manager.carry.energy > 0) {
				manager.repair(this.managerRepairTarget);
			} else {
				manager.withdraw(this.depositTarget);
			}
		}
		if (!manager.pos.isEqualTo(this.commandCenter.idlePos)) {
			manager.goTo(this.commandCenter.idlePos);
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
				this.idleActions(manager);
			}
		}
	}
}
