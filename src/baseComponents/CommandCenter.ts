// Mining site class for grouping relevant components

import {TaskWithdraw} from '../tasks/task_withdraw';
import {TaskDeposit} from '../tasks/task_deposit';
import {BaseComponent} from './BaseComponent';

export class CommandCenter extends BaseComponent implements ICommandCenter {
	memory: any;
	storage: StructureStorage;
	link: StructureLink;
	terminal: StructureTerminal;
	towers: StructureTower[];
	labs: StructureLab[];
	powerSpawn: StructurePowerSpawn;
	nuker: StructureNuker;
	observer: StructureObserver;
	private _manager: ICreep;
	private _idlePos: RoomPosition;
	private _depositStructures: (Link | Tower | Terminal | StructureNuker | PowerSpawn | Lab)[];
	private _withdrawStructures: (Link | Terminal)[];
	settings: {												// Settings for hatchery operation
		refillTowersBelow: number,  							// What value to refill towers at?
	};

	constructor(colony: IColony, storage: StructureStorage) {
		super(colony, storage, 'commandCenter');
		// Set up command center, register colony and memory
		this.memory = colony.memory.commandCenter;
		this.storage = colony.storage;
		this.link = this.pos.findClosestByLimitedRange(colony.links, 2);
		this.terminal = colony.terminal;
		this.towers = this.pos.findInRange(colony.towers, 3); // my layout has non-labs in a 4x3 rectangle
		this.labs = colony.labs;
		this.powerSpawn = colony.powerSpawn;
		this.nuker = colony.nuker;
		this.observer = colony.observer;
		this.settings = {
			refillTowersBelow: 200,
		};
	}

	get manager(): ICreep {
		if (!this._manager) {
			this._manager = this.storage.getAssignedCreeps('manager')[0];
		}
		return this._manager;
	}

	get depositStructures() {
		if (!this._depositStructures) {
			// Generate a prioritized list of what needs energy
			let depositStructures: (Link | Tower | Terminal | StructureNuker | PowerSpawn | Lab)[] = [];
			if (this.link && this.link.energy < 0.9 * this.link.energyCapacity) { 	// If link is not almost full
				if (this.overlord.resourceRequests.resourceIn.link.length > 0) { 	// If link should send energy
					depositStructures.push(this.link);
				}
			}
			for (let tower of this.towers) {
				if (tower.energy < this.settings.refillTowersBelow) { // If towers urgently need energy
					depositStructures.push(tower);
				}
			}
			if (this.terminal && this.terminal.energy < this.terminal.brain.energyBuffer) {
				depositStructures.push(this.terminal);
			}
			if (this.nuker && this.nuker.energy < this.nuker.energyCapacity) {
				depositStructures.push(this.nuker);
			}
			if (this.powerSpawn && this.powerSpawn.energy < this.powerSpawn.energyCapacity) {
				depositStructures.push(this.powerSpawn);
			}
			for (let lab of this.labs) {
				if (lab.energy < lab.energyCapacity) {
					depositStructures.push(lab);
				}
			}
			// If nothing else needs depositing, fill up towers completely
			if (depositStructures.length == 0) {
				for (let tower of this.towers) {
					if (tower.energy < tower.energyCapacity) {
						depositStructures.push(tower);
					}
				}
			}
			this._depositStructures = depositStructures;
		}
		return this._depositStructures;
	}

	get withdrawStructures() {
		if (!this._withdrawStructures) {
			// Generate a prioritized list of things that need energy withdrawn
			let withdrawStructures: (Link | Terminal)[] = [];
			if (this.link && this.link.energy > 0) {
				if (this.overlord.resourceRequests.resourceIn.link.length == 0) { // nothing needs link to send energy
					withdrawStructures.push(this.link);
				}
			}
			if (this.terminal && this.terminal.energy > this.terminal.brain.energyBuffer + 10000) {
				withdrawStructures.push(this.terminal);
			}
			this._withdrawStructures = withdrawStructures;
		}
		return this._withdrawStructures;
	}

	// Objective management ============================================================================================

	get idlePos(): RoomPosition {
		if (this.memory.idlePos && Game.time % 100 != 0) {
			let memPos = this.memory.idlePos;
			this._idlePos = new RoomPosition(memPos.x, memPos.y, memPos.roomName);
		} else {
			this._idlePos = this.findIdlePos();
			this.memory.idlePos = this._idlePos;
		}
		return this._idlePos;
	}

	/* Find the best idle position for this creep. */
	findIdlePos(): RoomPosition {
		// Get the adjacent squares to storage
		let possiblePositions = this.storage.pos.getAdjacentPositions();
		// Try to match as many other structures as possible
		let proximateStructures = [
			this.link,
			this.terminal,
			this.powerSpawn,
			this.nuker,
		];
		for (let structure of proximateStructures) {
			if (structure) {
				let filteredPositions = _.filter(possiblePositions, p => p.isNearTo(structure) &&
																		 !p.isEqualTo(structure));
				if (filteredPositions.length == 0) { // stop when it's impossible to match any more structures
					return possiblePositions[0];
				} else {
					possiblePositions = filteredPositions;
				}
			}
		}
		return possiblePositions[0];
	}

	/* Handle the manager of the command center. Because of the rapid load/unload cycle, the command center doesn't
	 * use an objectiveGroup; instead it directly manipulates the manager's tasks. */
	handleManager(): void {
		let manager = this.manager;
		if (!manager) {
			return;
		}
		// Handle manager deposit and withdrawal of energy
		if (manager.carry.energy > 0) {
			// If you have energy, deposit it to the best location
			if (this.depositStructures.length > 0) {
				manager.task = new TaskDeposit(this.depositStructures[0]); 	// deposit here if something needs energy
			} else {
				manager.task = new TaskDeposit(this.storage); 				// else deposit to storage
			}
		} else {
			// If you're out of energy and there are strucutres that need energy deposited or withdrawn, do so
			if (this.depositStructures.length > 0 || this.withdrawStructures.length > 0) {
				if (this.withdrawStructures.length > 0) { // if something actively needs withdrawing
					manager.task = new TaskWithdraw(this.withdrawStructures[0]);
				} else {
					manager.task = new TaskWithdraw(this.storage);
				}
			}
		}
		// If you still have nothing to do, go to the idle point
		if (manager.isIdle && !manager.pos.isEqualTo(this.idlePos)) {
			manager.travelTo(this.idlePos);
		}
	}

	handleLink(): void {
		if (!this.link) {
			return;
		}
		if (this.overlord.resourceRequests.resourceIn.link.length > 0 &&
			this.link.energy >= 0.9 * this.link.energyCapacity) {
			let targetLink = this.overlord.resourceRequests.resourceIn.link[0].target as Link;
			this.link.transferEnergy(targetLink);
		}
	}

	init(): void {
		return;
	}

	run(): void {
		this.handleManager();
		this.handleLink();
	}
}

