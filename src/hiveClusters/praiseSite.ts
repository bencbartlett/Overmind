// // Command center: groups many RCL8 components, storge, lab, terminal, and some towers
//
// import {HiveCluster} from './HiveCluster';
// import {profile} from '../profiler/decorator';
// import {CommandCenterOverlord} from '../overlords/hiveCluster/commandCenter';
// import {Colony} from '../Colony';
// import {Mem} from '../memory';
// import {Visualizer} from '../visuals/Visualizer';
// import {TerminalNetwork} from '../logistics/TerminalNetwork';
// import {transferTargetType} from '../tasks/instances/transfer';
// import {Energetics} from '../logistics/Energetics';
//
// interface PraiseSiteMemory {
//
// }
//
// @profile
// export class PraiseSite extends HiveCluster {
// 	controller: StructureController;						// The controller for the site
// 	batterySite: ConstructionSite | undefined;
// 	battery: StructureContainer | undefined; 				// The container to provide an energy buffer
// 	storage: StructureStorage | undefined;					// The colony storage, also the instantiation object
// 	spawn: StructureSpawn | undefined;						// The renewing spawn structure
// 	lab: StructureLab | undefined;							// Colony labs
// 	terminal: StructureTerminal | undefined;				// The colony terminal
// 	terminalNetwork: TerminalNetwork;						// Reference to Overmind.terminalNetwork
// 	towers: StructureTower[];								// Towers within range 3 of storage are part of cmdCenter
//
// 	private _idlePos: RoomPosition;							// Cached idle position
// 	private _depositStructures: transferTargetType[];		// Deposit to these
// 	private _withdrawStructures: (							// Withdraw from these
// 		StructureLink |
// 		StructureTerminal)[];
// 	settings: {												// Settings for cluster operation
// 		refillTowersBelow: number;  							// What value to refill towers at?
// 		managerSize: number;									// Size of manager in body pattern repetition units
// 	};
//
// 	constructor(colony: Colony, controller: StructureController) {
// 		super(colony, controller, 'praiseSite');
// 		// Register physical components
// 		this.controller = controller;
// 		this.storage = this.room.storage;
// 		this.terminal = this.room.terminal;
// 		this.terminalNetwork = Overmind.terminalNetwork as TerminalNetwork;
// 		this.towers = this.room.towers;
// 		this.lab = _.first(this.room.labs);
// 		this.settings = {
// 			refillTowersBelow       : 500,
// 			managerSize             : 8,
// 		};
//
// 	}
//
// 	get memory(): PraiseSite {
// 		return Mem.wrap(this.colony.memory, 'praiseSite');
// 	}
//
// 	// Idle position
// 	get idlePos(): RoomPosition {
// 		if (!this.memory.idlePos || Game.time % 25 == 0) {
// 			this.memory.idlePos = this.findIdlePos();
// 		}
// 		return derefRoomPosition(this.memory.idlePos);
// 	}
//
// 	/* Find the best idle position */
// 	private findIdlePos(): RoomPosition {
// 		// Try to match as many other structures as possible
// 		let proximateStructures: Structure[] = _.compact([this.link!,
// 														  this.terminal!,
// 														  this.powerSpawn!,
// 														  this.nuker!,
// 														  ...this.towers]);
// 		let numNearbyStructures = (pos: RoomPosition) =>
// 			_.filter(proximateStructures, s => s.pos.isNearTo(pos) && !s.pos.isEqualTo(pos)).length;
// 		return _.last(_.sortBy(this.storage.pos.neighbors, pos => numNearbyStructures(pos)));
// 	}
//
// 	private registerEnergyRequests(): void {
// 		let refillTowers = _.filter(this.towers, tower => tower.energy < tower.energyCapacity);
// 		// _.forEach(refillTowers, tower =>
// 		// 	this.colony.transportRequests.requestEnergy(tower, tower.energy < this.settings.refillTowersBelow ?
// 		// 													   Priority.High : Priority.Low));
// 		_.forEach(refillTowers, tower =>
// 			this.colony.logisticsNetwork.request(tower, {
// 				multiplier: tower.energy < this.settings.refillTowersBelow ? 2 : 0.5
// 			}));
// 		let refillLabs = _.filter(this.labs, lab => lab.energy < lab.energyCapacity);
// 		// _.forEach(refillLabs, lab => this.colony.transportRequests.requestEnergy(lab, Priority.NormalLow));
// 		_.forEach(refillLabs, lab => this.colony.logisticsNetwork.request(lab));
// 	}
//
//
// 	// Prioritize depositing and withdrawing ===========================================================================
//
// 	get depositStructures() {
// 		if (!this._depositStructures) {
// 			// Generate a prioritized list of what needs energy
// 			let depositStructures: transferTargetType[] = [];
// 			// If the link is empty and can send energy and something needs energy, fill it up
// 			if (this.link && this.link.energy < 0.9 * this.link.energyCapacity && this.link.cooldown <= 1) {
// 				if (this.colony.linkNetwork.receive.length > 0) { 	// If something wants energy
// 					depositStructures.push(this.link);
// 				}
// 			}
// 			for (let tower of this.towers) {
// 				if (tower.energy < this.settings.refillTowersBelow) { // If towers urgently need energy
// 					depositStructures.push(tower);
// 				}
// 			}
// 			if (this.terminal && this.terminal.energy < Energetics.settings.terminal.energy.inThreshold) {
// 				depositStructures.push(this.terminal);
// 			}
// 			if (this.nuker && this.nuker.energy < this.nuker.energyCapacity) {
// 				depositStructures.push(this.nuker);
// 			}
// 			if (this.powerSpawn && this.powerSpawn.energy < this.powerSpawn.energyCapacity) {
// 				depositStructures.push(this.powerSpawn);
// 			}
// 			for (let lab of this.labs) {
// 				if (lab.energy < lab.energyCapacity) {
// 					depositStructures.push(lab);
// 				}
// 			}
// 			// If nothing else needs depositing, fill up towers completely
// 			if (depositStructures.length == 0) {
// 				for (let tower of this.towers) {
// 					if (tower.energy < tower.energyCapacity) {
// 						depositStructures.push(tower);
// 					}
// 				}
// 			}
// 			this._depositStructures = depositStructures;
// 		}
// 		return this._depositStructures;
// 	}
//
// 	get withdrawStructures() {
// 		if (!this._withdrawStructures) {
// 			// Generate a prioritized list of things that need energy withdrawn
// 			let withdrawStructures: (StructureLink | StructureTerminal)[] = [];
// 			// If the link has energy and nothing needs it, empty it
// 			if (this.link && this.link.energy > 0) {
// 				if (this.colony.linkNetwork.receive.length == 0) { // nothing needs link to send energy
// 					withdrawStructures.push(this.link);
// 				}
// 			}
// 			// Withdraw energy from terminal if it has more than equilibrium amount and there is room for it in storage
// 			if (this.terminal && this.terminal.energy > Energetics.settings.terminal.energy.equilibrium) {
// 				if (_.sum(this.storage.store) < Energetics.settings.storage.total.cap) {
// 					withdrawStructures.push(this.terminal);
// 				}
// 			}
// 			this._withdrawStructures = withdrawStructures;
// 		}
// 		return this._withdrawStructures;
// 	}
//
// 	/* Register a link transfer store if the link is sufficiently full */
// 	private registerLinkTransferRequests(): void {
// 		if (this.link) {
// 			if (this.link.energy > this.settings.linksTransmitAt) {
// 				this.colony.linkNetwork.requestTransmit(this.link);
// 			}
// 		}
// 	}
//
//
// 	// Initialization and operation ====================================================================================
//
// 	init(): void {
// 		this.registerLinkTransferRequests();
// 		this.registerEnergyRequests();
// 	}
//
// 	run(): void {
//
// 	}
//
// 	visuals() {
// 		let info = [
// 			`Energy: ${Math.floor(this.storage.store[RESOURCE_ENERGY] / 1000)} K`,
// 		];
// 		Visualizer.showInfo(info, this);
// 	}
// }
//
