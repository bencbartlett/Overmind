// Mining site class for grouping relevant components

import {depositTargetType} from '../tasks/task_deposit';
import {AbstractHiveCluster} from './AbstractHiveCluster';
import {reserveCredits} from '../settings/settings_user';
import {terminalSettings} from '../settings/settings_terminal';
import {log} from '../lib/logger/log';
import {profile} from '../lib/Profiler';
import {CommandCenterOverlord} from '../overlords/overlord_commandCenter';
import {Priority} from '../config/priorities';
import {Colony} from '../Colony';

@profile
export class CommandCenter extends AbstractHiveCluster implements ICommandCenter {
	memory: CommandCenterMemory;							// Memory.colonies.commandCenter
	storage: StructureStorage;								// The colony storage, also the instantiation object
	link: StructureLink | undefined;						// Link closest to storage
	terminal: StructureTerminal | undefined;				// The colony terminal
	towers: StructureTower[];								// Towers within range 3 of storage are part of cmdCenter
	labs: StructureLab[];									// Colony labs
	powerSpawn: StructurePowerSpawn | undefined;			// Colony Power Spawn
	nuker: StructureNuker | undefined;						// Colony nuker
	observer: StructureObserver | undefined;				// Colony observer
	private _idlePos: RoomPosition;							// Cached idle position
	private _depositStructures: depositTargetType[];		// Deposit to these
	private _withdrawStructures: (							// Withdraw from these
		StructureLink |
		StructureTerminal)[];
	settings: {												// Settings for cluster operation
		linksTransmitAt: number;
		refillTowersBelow: number;  							// What value to refill towers at?
		excessEnergyTransferSize: number; 						// How much excess energy does a terminal send at once
		managerSize: number;									// Size of manager in body pattern repetition units
		unloadStorageBuffer: number;							// Start sending energy to other rooms past this amount
	};
	private terminalSettings: {								// Settings for terminal operation
		resourceAmounts: { [resourceType: string]: number };	// Desired equilibrium levels of resources
		maxBuyPrice: { [resourceType: string]: number }; 		// Maximum price to buy resources on market at
		avgPrice: { [resourceType: string]: number };			// Effective market prices
	};

	constructor(colony: Colony, storage: StructureStorage) {
		super(colony, storage, 'commandCenter');
		// Set up command center, register colony and memory
		this.initMemory(colony.memory, 'commandCenter');
		// Register physical components
		this.storage = storage;
		this.link = this.pos.findClosestByLimitedRange(colony.links, 2);
		this.terminal = colony.terminal;
		this.towers = this.pos.findInRange(colony.towers, 3);
		this.labs = colony.labs;
		this.powerSpawn = colony.powerSpawn;
		this.nuker = colony.nuker;
		this.observer = colony.observer;
		this.settings = {
			linksTransmitAt         : LINK_CAPACITY - 100,
			refillTowersBelow       : 200,
			excessEnergyTransferSize: 100000,
			managerSize             : 8,
			unloadStorageBuffer     : 900000,
		};
		this.terminalSettings = terminalSettings;
		if (this.storage.linked) {
			this.overlord = new CommandCenterOverlord(this, Priority.High);
		}
	}

	// Idle position
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

	/* Find the best idle position */
	private findIdlePos(): RoomPosition {
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
				let filteredPositions = _.filter(possiblePositions,
												 p => p.isNearTo(structure!) && !p.isEqualTo(structure!));
				if (filteredPositions.length == 0) { // stop when it's impossible to match any more structures
					return possiblePositions[0];
				} else {
					possiblePositions = filteredPositions;
				}
			}
		}
		return possiblePositions[0];
	}


	// Terminal logic ==================================================================================================

	/* Cost per unit including transfer price with energy converted to credits */
	private effectivePricePerUnit(order: Order): number {
		if (order.roomName) {
			let transferCost = Game.market.calcTransactionCost(1000, this.room.name, order.roomName) / 1000;
			return order.price + transferCost;
		} else {
			return Infinity;
		}
	}

	/* Calculate what needs buying */
	private calculateShortages(): { [mineralType: string]: number } {
		if (Game.market.credits < reserveCredits || !this.terminal) {
			return {};
		}
		let toBuy: { [mineral: string]: number } = {};
		for (let mineral in this.terminalSettings.resourceAmounts) {
			let amount = this.terminal.store[<ResourceConstant>mineral] || 0;
			if (mineral != RESOURCE_ENERGY && amount < this.terminalSettings.resourceAmounts[mineral]) {
				toBuy[mineral] = this.terminalSettings.resourceAmounts[mineral] - amount;
			}
		}
		return toBuy;
	}

	/* Buy needed resources for the best available price on market */
	private buyShortages(): void {
		var toBuy = this.calculateShortages();
		if (toBuy != {}) { // nothing to buy
			for (let mineral in toBuy!) {
				if (mineral == RESOURCE_ENERGY) {
					continue;
				}
				let relevantOrders = Game.market.getAllOrders(order => order.type == ORDER_SELL &&
																	   order.resourceType == mineral &&
																	   order.remainingAmount > 100);
				let bestOrder = null;
				let bestCost = Infinity;
				for (let order of relevantOrders) {
					let cost = this.effectivePricePerUnit(order);
					if (cost < bestCost) {
						bestOrder = order;
						bestCost = cost;
					}
				}
				if (bestOrder && bestOrder.roomName &&
					this.effectivePricePerUnit(bestOrder) < this.terminalSettings.maxBuyPrice[mineral]) {
					let amount = Math.min(bestOrder.remainingAmount, toBuy![mineral]);
					let response = Game.market.deal(bestOrder.id, amount, this.room.name);
					console.log(this.name + ': bought', amount, mineral, 'from', bestOrder.roomName,
														'for', bestOrder.price * amount, 'credits and',
														Game.market.calcTransactionCost(amount, this.room.name, bestOrder.roomName), 'energy',
														'reponse:', response);
				}
			}
		}
	}

	private sendExtraEnergy(): void {
		if (!this.terminal) {
			return;
		}
		// calculate best room to send energy to
		var minCost = Infinity;
		var minRoom = null;
		for (let name in Game.rooms) {
			let room = Game.rooms[name];
			if (room.my && room.terminal &&
				room.storage && room.storage.energy < this.settings.unloadStorageBuffer) {
				let cost = Game.market.calcTransactionCost(this.settings.excessEnergyTransferSize,
														   this.room.name, room.name);
				if (cost < minCost) {
					minCost = cost;
					minRoom = room.name;
				}
			}
		}
		// if you have sufficient energy in terminal
		if (minRoom && this.terminal.energy > this.settings.excessEnergyTransferSize + minCost) {
			let res = this.terminal.send(RESOURCE_ENERGY, this.settings.excessEnergyTransferSize, minRoom,
										 'Excess energy transfer');
			log.info(`Sent ${this.settings.excessEnergyTransferSize} excess energy to ${minRoom}. Response: ${res}.`);
		}
	}

	// Prioritize depositing and withdrawing ===========================================================================

	get depositStructures() {
		if (!this._depositStructures) {
			// Generate a prioritized list of what needs energy
			let depositStructures: depositTargetType[] = [];
			// If the link is empty and can send energy and something needs energy, fill it up
			if (this.link && this.link.energy < 0.9 * this.link.energyCapacity && this.link.cooldown <= 1) {
				if (this.colony.linkRequests.receive.length > 0) { 	// If something wants energy
					depositStructures.push(this.link);
				}
			}
			for (let tower of this.towers) {
				if (tower.energy < this.settings.refillTowersBelow) { // If towers urgently need energy
					depositStructures.push(tower);
				}
			}
			if (this.terminal && this.terminal.energy < this.terminalSettings.resourceAmounts[RESOURCE_ENERGY]) {
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
			let withdrawStructures: (StructureLink | StructureTerminal)[] = [];
			// If the link has energy and nothing needs it, empty it
			if (this.link && this.link.energy > 0) {
				if (this.colony.linkRequests.receive.length == 0) { // nothing needs link to send energy
					withdrawStructures.push(this.link);
				}
			}
			if (this.terminal &&
				this.terminal.energy > this.terminalSettings.resourceAmounts[RESOURCE_ENERGY] + 10000) {
				withdrawStructures.push(this.terminal);
			}
			this._withdrawStructures = withdrawStructures;
		}
		return this._withdrawStructures;
	}

	/* Register a link transfer request if the link is sufficiently full */
	private registerLinkTransferRequests(): void {
		if (this.link) {
			if (this.link.energy > this.settings.linksTransmitAt) {
				this.colony.transportRequests.requestWithdrawal(this.link);
			}
		}
	}

	private handleTerminal(): void {
		if (!this.terminal) {
			return;
		}
		// send excess energy if terminal and storage both have too much energy
		if (this.terminal.energy > this.terminalSettings.resourceAmounts[RESOURCE_ENERGY]
								   + this.settings.excessEnergyTransferSize &&
			this.room.storage && this.room.storage.energy > this.settings.unloadStorageBuffer) {
			this.sendExtraEnergy();
		}
		// buy shortages only if there's enough energy; avoids excessive CPU usage
		if (this.terminal.energy > 0.9 * this.terminalSettings.resourceAmounts[RESOURCE_ENERGY]) {
			this.buyShortages();
		}
	}

	// Initialization and operation ====================================================================================

	init(): void {
		this.registerLinkTransferRequests();
	}

	run(): void {
		this.handleTerminal();
	}
}

