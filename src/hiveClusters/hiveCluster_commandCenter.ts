// Mining site class for grouping relevant components

import {HiveCluster} from './HiveCluster';
import {profile} from '../profiler/decorator';
import {CommandCenterOverlord} from '../overlords/hiveCluster/overlord_commandCenter';
import {Colony} from '../Colony';
import {Mem} from '../memory';
import {Visualizer} from '../visuals/Visualizer';
import {TerminalNetwork} from '../logistics/TerminalNetwork';
import {transferTargetType} from '../tasks/task_transfer';
import {Energetics} from '../logistics/Energetics';

@profile
export class CommandCenter extends HiveCluster {
	storage: StructureStorage;								// The colony storage, also the instantiation object
	link: StructureLink | undefined;						// Link closest to storage
	terminal: StructureTerminal | undefined;				// The colony terminal
	terminalNetwork: TerminalNetwork;						// Reference to Overmind.terminalNetwork
	towers: StructureTower[];								// Towers within range 3 of storage are part of cmdCenter
	labs: StructureLab[];									// Colony labs
	powerSpawn: StructurePowerSpawn | undefined;			// Colony Power Spawn
	nuker: StructureNuker | undefined;						// Colony nuker
	observer: StructureObserver | undefined;				// Colony observer
	private _idlePos: RoomPosition;							// Cached idle position
	private _depositStructures: transferTargetType[];		// Deposit to these
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

	constructor(colony: Colony, storage: StructureStorage) {
		super(colony, storage, 'commandCenter');
		// Register physical components
		this.storage = storage;
		this.link = this.pos.findClosestByLimitedRange(colony.links, 2);
		this.terminal = colony.terminal;
		this.terminalNetwork = Overmind.terminalNetwork as TerminalNetwork;
		this.towers = this.pos.findInRange(colony.towers, 3);
		this.labs = colony.labs;
		this.powerSpawn = colony.powerSpawn;
		this.nuker = colony.nuker;
		this.observer = colony.observer;
		this.settings = {
			linksTransmitAt         : LINK_CAPACITY - 100,
			refillTowersBelow       : 500,
			excessEnergyTransferSize: 100000,
			managerSize             : 8,
			unloadStorageBuffer     : 900000,
		};
		if (this.storage.linked) {
			this.overlord = new CommandCenterOverlord(this);
		}
	}

	get memory(): CommandCenterMemory {
		return Mem.wrap(this.colony.memory, 'commandCenter');
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
		let possiblePositions = this.storage.pos.neighbors;
		// Try to match as many other structures as possible
		let proximateStructures: Structure[] = _.compact([
															 this.link!,
															 this.terminal!,
															 this.powerSpawn!,
															 this.nuker!,
															 ...this.towers,
														 ]);
		let numNearbyStructures = (pos: RoomPosition) =>
			_.filter(proximateStructures, s => s.pos.isNearTo(pos) && !s.pos.isEqualTo(pos)).length;
		let nearbyStructuresEachPos = _.map(possiblePositions, pos => numNearbyStructures(pos));
		let maxIndex = _.findIndex(nearbyStructuresEachPos, _.max(nearbyStructuresEachPos));
		return possiblePositions[maxIndex];
	}

	private registerEnergyRequests(): void {
		let refillTowers = _.filter(this.towers, tower => tower.energy < tower.energyCapacity);
		// _.forEach(refillTowers, tower =>
		// 	this.colony.transportRequests.requestEnergy(tower, tower.energy < this.settings.refillTowersBelow ?
		// 													   Priority.High : Priority.Low));
		_.forEach(refillTowers, tower =>
			this.colony.logisticsGroup.request(tower, {
				multiplier: tower.energy < this.settings.refillTowersBelow ? 2 : 0.5
			}));
		let refillLabs = _.filter(this.labs, lab => lab.energy < lab.energyCapacity);
		// _.forEach(refillLabs, lab => this.colony.transportRequests.requestEnergy(lab, Priority.NormalLow));
		_.forEach(refillLabs, lab => this.colony.logisticsGroup.request(lab));
	}


	// Prioritize depositing and withdrawing ===========================================================================

	get depositStructures() {
		if (!this._depositStructures) {
			// Generate a prioritized list of what needs energy
			let depositStructures: transferTargetType[] = [];
			// If the link is empty and can send energy and something needs energy, fill it up
			if (this.link && this.link.energy < 0.9 * this.link.energyCapacity && this.link.cooldown <= 1) {
				if (this.colony.linkNetwork.receive.length > 0) { 	// If something wants energy
					depositStructures.push(this.link);
				}
			}
			for (let tower of this.towers) {
				if (tower.energy < this.settings.refillTowersBelow) { // If towers urgently need energy
					depositStructures.push(tower);
				}
			}
			if (this.terminal && this.terminal.energy < Energetics.settings.terminal.energy.inThreshold) {
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
				if (this.colony.linkNetwork.receive.length == 0) { // nothing needs link to send energy
					withdrawStructures.push(this.link);
				}
			}
			// Withdraw energy from terminal if it has more than equilibrium amount and there is room for it in storage
			if (this.terminal && this.terminal.energy > Energetics.settings.terminal.energy.equilibrium) {
				if (_.sum(this.storage.store) < Energetics.settings.storage.total.cap) {
					withdrawStructures.push(this.terminal);
				}
			}
			this._withdrawStructures = withdrawStructures;
		}
		return this._withdrawStructures;
	}

	/* Register a link transfer request if the link is sufficiently full */
	private registerLinkTransferRequests(): void {
		if (this.link) {
			if (this.link.energy > this.settings.linksTransmitAt) {
				this.colony.linkNetwork.requestTransmit(this.link);
			}
		}
	}


	// Initialization and operation ====================================================================================

	init(): void {
		this.registerLinkTransferRequests();
		this.registerEnergyRequests();
	}

	run(): void {

	}

	visuals() {
		let info = [
			`Energy: ${Math.floor(this.storage.store[RESOURCE_ENERGY] / 1000)} K`,
		];
		Visualizer.showInfo(info, this);
	}
}

