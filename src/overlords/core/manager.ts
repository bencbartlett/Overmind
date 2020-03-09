import {$} from '../../caching/GlobalCache';
import {log} from '../../console/log';
import {Roles, Setups} from '../../creepSetups/setups';
import {StoreStructure} from '../../declarations/typeGuards';
import {TERMINAL_STATE_REBUILD} from '../../directives/terminalState/terminalState_rebuild';
import {CommandCenter} from '../../hiveClusters/commandCenter';
import {SpawnRequestOptions} from '../../hiveClusters/hatchery';
import {Energetics} from '../../logistics/Energetics';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {BASE_RESOURCES} from '../../resources/map_resources';
import {Tasks} from '../../tasks/Tasks';
import {hasMinerals, minBy} from '../../utilities/utils';
import {Zerg} from '../../zerg/Zerg';
import {Overlord} from '../Overlord';
import {WorkerOverlord} from './worker';

/**
 * Command center overlord: spawn and run a dediated commandCenter attendant
 */
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
			const anchor = this.colony.bunker.anchor;
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
		if (this.colony.layout == 'twoPart') {
			setup = Setups.managers.twoPart;
		}
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

	/**
	 * Move anything you are currently holding to deposit location
	 */
	private unloadCarry(manager: Zerg): boolean {
		if (_.sum(manager.carry) > 0) {
			manager.task = Tasks.transferAll(this.depositTarget);
			return true;
		} else {
			return false;
		}
	}

	/**
	 * Handle any supply requests from your transport request group
	 */
	private supplyActions(manager: Zerg): boolean {
		manager.debug('supplyActions');
		const request = this.commandCenter.transportRequests.getPrioritizedClosestRequest(manager.pos, 'supply');
		if (request) {
			const amount = Math.min(request.amount, manager.carryCapacity);
			manager.task = Tasks.transfer(request.target, request.resourceType, amount,
										  {nextPos: this.commandCenter.idlePos});
			if ((manager.carry[request.resourceType] || 0) < amount) {
				// If you are currently carrying other crap, overwrite current task and put junk in terminal/storage
				if (_.sum(manager.carry) > (manager.carry[request.resourceType] || 0)) {
					manager.task = Tasks.transferAll(this.depositTarget);
				}
				// Otherwise withdraw as much as you can hold
				else {
					const withdrawAmount = amount - _.sum(manager.carry);
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
			return true;
		}
		return false;
	}

	/**
	 * Handle any withdrawal requests from your transport request group
	 */
	private withdrawActions(manager: Zerg): boolean {
		manager.debug('withdrawActions');
		if (_.sum(manager.carry) < manager.carryCapacity) {
			const request = this.commandCenter.transportRequests.getPrioritizedClosestRequest(manager.pos, 'withdraw');
			if (request) {
				const amount = Math.min(request.amount, manager.carryCapacity - _.sum(manager.carry));
				manager.task = Tasks.withdraw(request.target, request.resourceType, amount);
				return true;
			}
		} else {
			manager.task = Tasks.transferAll(this.depositTarget);
			return true;
		}
		return false;
	}

	/**
	 * Move energy into terminal if storage is too full and into storage if storage is too empty
	 */
	private equalizeStorageAndTerminal(manager: Zerg): boolean {
		manager.debug('equalizeStorageAndTerminal');
		const storage = this.commandCenter.storage;
		const terminal = this.commandCenter.terminal;
		if (!storage || !terminal) return false;

		const equilibrium = Energetics.settings.terminal.energy.equilibrium;
		const tolerance = Energetics.settings.terminal.energy.tolerance;
		const storageTolerance = Energetics.settings.storage.total.tolerance;
		let storageEnergyCap = Energetics.settings.storage.total.cap;
		const terminalState = this.colony.terminalState;
		// Adjust max energy allowable in storage if there's an exception state happening
		if (terminalState && terminalState.type == 'out') {
			storageEnergyCap = terminalState.amounts[RESOURCE_ENERGY] || 0;
		}

		// Move energy from storage to terminal if there is not enough in terminal or if there's terminal evacuation
		if ((terminal.energy < equilibrium - tolerance || storage.energy > storageEnergyCap + storageTolerance)
			&& storage.energy > 0) {
			if (this.unloadCarry(manager)) return true;
			manager.task = Tasks.withdraw(storage);
			manager.task.parent = Tasks.transfer(terminal);
			return true;
		}

		// Move energy from terminal to storage if there is too much in terminal and there is space in storage
		if (terminal.energy > equilibrium + tolerance && storage.energy < storageEnergyCap) {
			if (this.unloadCarry(manager)) return true;
			manager.task = Tasks.withdraw(terminal);
			manager.task.parent = Tasks.transfer(storage);
			return true;
		}

		// Nothing has happened
		return false;
	}

	/**
	 * Move enough energy from a terminal which needs to be moved into storage to allow you to rebuild the terminal
	 */
	private moveEnergyFromRebuildingTerminal(manager: Zerg): boolean {
		manager.debug('moveEnergyFromRebuildingTerminal');
		const storage = this.commandCenter.storage;
		const terminal = this.commandCenter.terminal;
		if (!storage || !terminal) {
			return false;
		}
		if (storage.energy < Energetics.settings.storage.energy.destroyTerminalThreshold) {
			if (this.unloadCarry(manager)) return true;
			manager.task = Tasks.withdraw(terminal);
			manager.task.parent = Tasks.transfer(storage);
			return true;
		}
		return false;
	}

	private moveMineralsToTerminal(manager: Zerg): boolean {
		const storage = this.commandCenter.storage;
		const terminal = this.commandCenter.terminal;
		if (!storage || !terminal) {
			return false;
		}
		// Don't do this if terminal is critially full
		if (terminal.store.getFreeCapacity() < 1000) {
			return false;
		}
		// Move all non-energy resources from storage to terminal
		for (const [resourceType, amount] of storage.store.contents) {
			if (resourceType != RESOURCE_ENERGY && resourceType != RESOURCE_OPS && amount > 0) {
				if (this.unloadCarry(manager)) return true;
				manager.task = Tasks.withdraw(storage, resourceType);
				manager.task.parent = Tasks.transfer(terminal, resourceType);
				return true;
			}
		}
		return false;
	}

	/**
	 * Pickup resources dropped on manager position or in tombstones from last manager
	 */
	private pickupActions(manager: Zerg, tombstonesOnly = true): boolean {
		manager.debug('pickupActions');
		// Look for tombstones at position
		const tombstones = manager.pos.lookFor(LOOK_TOMBSTONES);
		if (tombstones.length > 0) {
			manager.task = Tasks.transferAll(this.depositTarget).fork(Tasks.withdrawAll(tombstones[0]));
			return true;
		}
		if (tombstonesOnly) {
			return false; // skip next bit if only looking at tombstones
		}
		// Pickup any resources that happen to be dropped where you are
		const resources = manager.pos.lookFor(LOOK_RESOURCES);
		if (resources.length > 0) {
			manager.task = Tasks.transferAll(this.depositTarget).fork(Tasks.pickup(resources[0]));
			return true;
		}
		return false;
	}

	/**
	 * When storage + terminal are critically full, start dumping the least useful stuff on the ground.
	 * This should rarely be run; added in Feb 2020 to fix a critical issue where I hadn't added factory code and all
	 * my terminals and storage filled up with crap.
	 */
	private emergencyDumpingActions(manager: Zerg): boolean {
		manager.debug('emergencyDumpingActions');
		const storage = this.commandCenter.storage;
		const terminal = this.commandCenter.terminal;
		if (!storage && !terminal) {
			return false;
		}
		const storageCapacity = storage ? storage.store.getFreeCapacity() : 0;
		const terminalCapacity = terminal ? terminal.store.getFreeCapacity() : 0;
		const storageEnergy = storage ? storage.store.energy : 0;
		const terminalEnergy = terminal ? terminal.store.energy : 0;
		// const freeCapacity = (storage ? storage.store.getFreeCapacity() : 0) +
		// 					 (terminal ? terminal.store.getFreeCapacity() : 0);
		// const energy = (storage ? storage.store.energy : 0) +
		// 			   (terminal ? terminal.store.energy : 0);
		// if (energy >= 5000) {
		// 	return false;
		// }
		const DUMP_THRESHOLD = 5000;
		if (terminal && terminalCapacity < DUMP_THRESHOLD && terminalEnergy < DUMP_THRESHOLD) {
			return this.dumpFrom(manager, terminal);
		}
		if (storage && storageCapacity < DUMP_THRESHOLD && storageEnergy < DUMP_THRESHOLD) {
			return this.dumpFrom(manager, storage);
		}
		return false;
	}

	/**
	 * Dump resources on ground from a target that is critically full
	 */
	private dumpFrom(manager: Zerg, target: StructureTerminal | StructureStorage): boolean {
		manager.say('Dump!');
		// Start dumping least valuable shit on the ground
		const toDump = _.sortBy(BASE_RESOURCES, resource => (target.store[resource] || 0) * -1);
		const toDumpInCarry = _.first(_.filter(toDump, res => manager.carry[res] > 0));
		// Drop anything you have in carry that is dumpable
		if (toDumpInCarry) {
			manager.drop(toDumpInCarry);
			return true;
		}
		// Take out stuff to dump
		for (const resource of toDump) {
			if (target.store[resource] > 0) {
				manager.task = Tasks.drop(manager.pos, resource).fork(Tasks.withdraw(target, resource));
				return true;
			}
		}
		log.warning('No shit to drop! Shouldn\'t reach here!');
		return false;
	}

	/**
	 * Suicide once you get old and make sure you don't drop and waste any resources
	 */
	private deathActions(manager: Zerg): boolean {
		manager.debug('deathActions');
		const nearbyManagers = _.filter(this.managers, manager => manager.pos.inRangeTo(this.commandCenter.pos, 3));
		if (nearbyManagers.length > 1) {
			if (_.sum(manager.carry) == 0) {
				const nearbySpawn = _.first(manager.pos.findInRange(manager.room.spawns, 1));
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

	private preventTerminalFlooding(manager: Zerg): boolean {
		// Prevent terminal flooding
		if (this.room && this.room.terminal && this.room.storage && _.sum(this.room.terminal.store)
			> this.room.terminal.storeCapacity*.98) {
			let max = 0;
			let resType: ResourceConstant = RESOURCE_ENERGY;
			for (const res in this.room.terminal.store) {
				const amount = this.room.terminal.store[<ResourceConstant>res];
				if (amount && amount > max && res !== RESOURCE_ENERGY) {
					max = amount;
					resType = <ResourceConstant>res;
				}
			}

			manager.task = Tasks.transferAll(this.room.storage).fork(Tasks.withdraw(this.room.terminal, resType));
			return true;
		}
		return false;
	}

	private handleManager(manager: Zerg): void {
		// Handle switching to next manager
		if (manager.ticksToLive! < 150) {
			if (this.deathActions(manager)) return;
		}
		if (this.preventTerminalFlooding(manager)) return;
		// Emergency dumping actions for critically clogged terminals and storages
		// if (this.emergencyDumpingActions(manager)) return;
		// Pick up any dropped resources on ground
		if (this.pickupActions(manager)) return;
		// Move minerals from storage to terminal if needed
		if (hasMinerals(this.commandCenter.storage.store)) {
			if (this.moveMineralsToTerminal(manager)) return;
		}
		// Fill up storage before you destroy terminal if rebuilding room
		if (this.colony.terminalState == TERMINAL_STATE_REBUILD) {
			if (this.moveEnergyFromRebuildingTerminal(manager)) return;
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

	/**
	 * Handle idle actions if the manager has nothing to do
	 */
	private idleActions(manager: Zerg): void {
		manager.debug('idleActions');
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
		for (const manager of this.managers) {
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
