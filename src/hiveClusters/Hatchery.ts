// Hatchery - groups all spawns in a colony

import {AbstractHiveCluster} from './AbstractHiveCluster';
import {log} from '../lib/logger/log';
import {profile} from '../lib/Profiler';
import {HatcheryOverlord} from '../overlords/overlord_hatchery';
import {Priority} from '../config/priorities';
import {ColonyStage} from '../Colony';
import {TransportRequestGroup} from '../resourceRequests/TransportRequestGroup';

@profile
export class Hatchery extends AbstractHiveCluster implements IHatchery {
	memory: HatcheryMemory; 								// Memory.colonies.hatchery
	spawns: Spawn[]; 										// List of spawns in the hatchery
	availableSpawns: Spawn[]; 								// Spawns that are available to make stuff right now
	extensions: StructureExtension[]; 						// List of extensions in the hatchery
	link: StructureLink | undefined; 						// The input link
	towers: StructureTower[]; 								// All towers that aren't in the command center
	battery: StructureContainer | undefined;				// The container to provide an energy buffer
	transportRequests: ITransportRequestGroup;
	overlord: HatcheryOverlord | undefined;
	// overlords: { hatchery: HatcheryOverlord };
	// private objectivePriorities: string[]; 					// Priorities for objectives in the objectiveGroup
	// objectiveGroup: ObjectiveGroup; 						// Objectives for hatchery operation and maintenance
	// private spawnPriorities: { [role: string]: number }; 	// Default priorities for spawning creeps of various roles
	// private emergencyMode: boolean;							// Has the room catastrophically crashed?
	private settings: {										// Settings for hatchery operation
		refillTowersBelow: number,  							// What value to refill towers at?
		linksRequestEnergyBelow: number, 						// What value will links request more energy at?
		supplierSize: number,									// Size of supplier in body pattern units
		numSuppliers: number,									// Number of suppliers to maintain
		queenSize: number,										// Size of queen in body patern repetition units
		numQueens: number,										// Number of queens the Hatchery needs
		renewQueenAt: number,									// Renew idle queens below this ticksRemaining value
	};
	private productionQueue: { [priority: number]: protoCreep[] };  // Priority queue of protocreeps
	// private _queen: Zerg; 										// The supplier working the hatchery
	private _idlePos: RoomPosition; 								// Idling position for the supplier
	private _energyStructures: (StructureSpawn | StructureExtension)[];

	constructor(colony: IColony, headSpawn: StructureSpawn) {
		super(colony, headSpawn, 'hatchery');
		// Set up memory
		// this.memory = colony.memory.hatchery;
		this.initMemory(colony.memory, 'hatchery');
		// Register structure components
		this.spawns = colony.spawns;
		this.availableSpawns = _.filter(this.spawns, (spawn: Spawn) => !spawn.spawning);
		this.extensions = colony.extensions;
		this.link = this.pos.findClosestByLimitedRange(colony.links, 2);
		this.battery = this.pos.findClosestByLimitedRange(this.room.containers, 2);
		// Associate all towers that aren't part of the command center if there is one
		if (colony.commandCenter) {
			this.towers = _.difference(colony.towers, colony.commandCenter.towers);
		} else {
			this.towers = colony.towers;
		}
		// // Objective groups for supplier tasks
		// this.objectivePriorities = [
		// 	'supplyTower',
		// 	'supply',
		// ];
		// this.objectiveGroup = new ObjectiveGroup(this.objectivePriorities);
		// Priorities for the productionQueue
		// this.spawnPriorities = {
		// 	supplier       : 0,
		// 	queen          : 1,
		// 	scout          : 1,
		// 	manager        : 1,
		// 	guard          : 2,
		// 	miner          : 4,
		// 	hauler         : 5,
		// 	worker         : 6,
		// 	reserver       : 6,
		// 	upgrader       : 7,
		// };
		// Emergency mode is off by default; modified by an emergency directive
		// this.emergencyMode = false;
		// Set up production queue in memory so we can inspect it easily
		// this.memory.productionQueue = {}; // cleared every tick; only in memory for inspection purposes
		this.productionQueue = {}; //this.memory.productionQueue; // reference this outside of memory for typing purposes
		this.settings = {
			refillTowersBelow      : 500,
			linksRequestEnergyBelow: 0,
			supplierSize           : _.min([_.ceil(2 * (this.extensions.length + 1) / 5), 8]),
			numSuppliers           : 1,
			queenSize              : _.min([_.ceil(2 * (this.extensions.length + 1) / 5), 8]),
			numQueens              : 1,
			renewQueenAt           : 1000,
		};
		// Register the hatchery overlord
		if (this.colony.stage > ColonyStage.Larva) {
			this.overlord = new HatcheryOverlord(this, Priority.High);
		}
		// Assign a separate request group if hatchery has a dedicated attendant
		if (this.overlord && this.overlord.queens.length > 0) {
			this.transportRequests = new TransportRequestGroup();
		} else {
			this.transportRequests = this.colony.transportRequests;
		}
	}

	// get queen(): Zerg | undefined {
	// 	if (!this._queen) {
	// 		this._queen = this.colony.getCreepsByRole('queen')[0];
	// 	}
	// 	return this._queen;
	// }

	// Objective management ============================================================================================

	/* Request more energy when appropriate either via link or hauler */
	private registerEnergyRequests(): void {
		// Register requests for input into the hatchery (goes on colony request group)
		if (this.link) {
			if (this.link.isEmpty) {
				this.colony.linkRequests.requestReceive(this.link);
			}
		} else {
			if (this.battery && this.battery.energy < 0.25 * this.battery.storeCapacity) {
				this.colony.transportRequests.requestEnergy(this.battery);
			}
		}
		// Register energy transport requests (goes on hatchery request group, which can be colony request group)
		let refillSpawns = _.filter(this.spawns, spawn => spawn.energy < spawn.energyCapacity);
		let refillExtensions = _.filter(this.extensions, extension => extension.energy < extension.energyCapacity);
		let refillTowers = _.filter(this.towers, tower => tower.energy < tower.energyCapacity);
		_.forEach(refillSpawns, spawn => this.transportRequests.requestEnergy(spawn));
		_.forEach(refillExtensions, extension => this.transportRequests.requestEnergy(extension));
		_.forEach(refillTowers, tower => this.transportRequests.requestEnergy(tower));
	}

	// private registerObjectives(): void {
	// 	// Supply all of the hatchery components with energy
	// 	let supplySpawns = _.filter(this.spawns, spawn => !spawn.isFull);
	// 	let supplySpawnObjectives = _.map(supplySpawns, spawn => new ObjectiveSupply(spawn));
	// 	let supplyExtensions = _.filter(this.extensions, extension => !extension.isFull);
	// 	let supplyExtensionObjectives = _.map(supplyExtensions, extension => new ObjectiveSupply(extension));
	// 	let supplyTowers: StructureTower[];
	// 	if (supplySpawnObjectives.length + supplyExtensionObjectives.length > 0) {
	// 		// If there are other things to do, don't worry about filling towers to completely full levels
	// 		supplyTowers = _.filter(this.towers, tower => tower.energy < this.settings.refillTowersBelow);
	// 	} else {
	// 		// If nothing else to do, go ahead and fill up towers
	// 		supplyTowers = _.filter(this.towers, tower => tower.energy < tower.energyCapacity);
	// 	}
	// 	let supplyTowerObjectives = _.map(supplyTowers, tower => new ObjectiveSupplyTower(tower));
	//
	// 	// Register the objectives to the appropriate group
	// 	if (this.queen) { // if the hatchery has a queen, stick objectives in this group
	// 		this.objectiveGroup.registerObjectives(supplySpawnObjectives,
	// 											   supplyExtensionObjectives,
	// 											   supplyTowerObjectives);
	// 	} else { // otherwise, put them in the overseer's objectiveGroup
	// 		this.overlord.objectiveGroup.registerObjectives(supplySpawnObjectives,
	// 														supplyExtensionObjectives,
	// 														supplyTowerObjectives);
	// 	}
	// }


	// Creep queueing and spawning =====================================================================================

	private bodyCost(bodyArray: string[]): number {
		var partCosts: { [type: string]: number } = {
			move         : 50,
			work         : 100,
			carry        : 50,
			attack       : 80,
			ranged_attack: 150,
			heal         : 250,
			claim        : 600,
			tough        : 10,
		};
		var cost = 0;
		for (let part of bodyArray) {
			cost += partCosts[part];
		}
		return cost;
	};

	private generateCreepName(roleName: string): string {
		// generate a creep name based on the role and add a suffix to make it unique
		let i = 0;
		while (Game.creeps[(roleName + '_' + i)]) {
			i++;
		}
		return (roleName + '_' + i);
	};

	private get energyStructures(): (StructureSpawn | StructureExtension)[] {
		if (!this._energyStructures) {
			// Ugly workaround to [].concat() throwing a temper tantrum
			let spawnsAndExtensions: (StructureSpawn | StructureExtension)[] = [];
			spawnsAndExtensions = spawnsAndExtensions.concat(this.spawns, this.extensions);
			this._energyStructures = _.sortBy(spawnsAndExtensions, structure => structure.pos.getRangeTo(this.idlePos));
		}
		return this._energyStructures;
	}

	private spawnCreep(protoCreep: protoCreep): number {
		let spawnToUse = this.availableSpawns.shift(); // get a spawn to use
		if (spawnToUse) { // if there is a spawn, create the creep
			protoCreep.name = this.generateCreepName(protoCreep.name); // modify the creep name to make it unique
			if (protoCreep.memory.colony != this.colony.name) {
				log.info('Spawning ' + protoCreep.name + ' for ' + protoCreep.memory.colony);
			}
			protoCreep.memory.data.origin = spawnToUse.pos.roomName;
			let result = spawnToUse.spawnCreep(protoCreep.body, protoCreep.name, {
				memory          : protoCreep.memory,
				energyStructures: this.energyStructures
			});
			if (result == OK) {
				return result;
			} else {
				this.availableSpawns.unshift(spawnToUse); // return the spawn to the available spawns list
				return result;
			}
		} else { // otherwise, return busy
			return ERR_BUSY;
		}
	}

	enqueue(protoCreep: protoCreep, priority: number): void {
		// let roleName = protoCreep.name; // This depends on creeps being named for their roles (before generateCreepName)
		// let priority = this.spawnPriorities[roleName];
		// if (overridePriority != undefined) {
		// 	priority = overridePriority;
		// }
		// if (priority == undefined) {
		// 	priority = 1000; // some large but finite priority for all the remaining stuff to make
		// }

		// If you are incubating and can't build the requested creep, enqueue it to the incubation hatchery
		// if (this.colony.incubator && this.colony.incubator.hatchery &&
		// 	this.bodyCost(protoCreep.body) > this.room.energyCapacityAvailable) {
		// 	this.colony.incubator.hatchery.enqueue(protoCreep);
		// 	log.info('Requesting ' + roleName + ' from ' + this.colony.incubator.name);
		// } else {
		// 	// Otherwise, queue the creep to yourself
		// 	if (!this.productionQueue[priority]) {
		// 		this.productionQueue[priority] = [];
		// 	}
		// 	this.productionQueue[priority].push(protoCreep);
		// }
		if (!this.productionQueue[priority]) {
			this.productionQueue[priority] = [];
		}
		this.productionQueue[priority].push(protoCreep);
	}

	private spawnHighestPriorityCreep(): number | void {
		let priorities: number[] = _.map(Object.keys(this.productionQueue), key => parseInt(key, 10)).sort();
		for (let priority of priorities) {
			let protocreep = this.productionQueue[priority].shift();
			if (protocreep) {
				let result = this.spawnCreep(protocreep);
				if (result == OK) {
					return result;
				} else {
					this.productionQueue[priority].unshift(protocreep);
					return result;
				}
			}
		}
	}

	// Idle position for suppliers =====================================================================================

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

	/* Find the best position for suppliers to idle at */
	private findIdlePos(): RoomPosition {
		let possiblePositions = this.spawns[0].pos.getAdjacentPositions();
		let proximateStructures = [
			this.spawns[1],
			this.spawns[2],
			this.link,
			this.battery,
		];
		for (let structure of proximateStructures) {
			if (structure) {
				let filteredPositions = _.filter(possiblePositions, p => p.isNearTo(structure!) &&
																		 !p.isEqualTo(structure!));
				if (filteredPositions.length == 0) { // stop when it's impossible to match any more structures
					return possiblePositions[0];
				} else {
					possiblePositions = filteredPositions;
				}
			}
		}
		return possiblePositions[0];
	}

	// private handleQueen(): void {
	// 	// Handle the queen
	// 	let queen = this.queen;
	// 	if (!queen) {
	// 		return;
	// 	}
	// 	// Try to ensure the queen has something to do
	// 	queen.assertValidTask();
	// 	// If there aren't any tasks that need to be done, recharge the battery from link
	// 	if (queen.isIdle) {
	// 		if (this.battery && this.link) { // is there a battery and a link?
	// 			// Can energy be moved from the link to the battery?
	// 			if (!this.battery.isFull && !this.link.isEmpty) { 	// move energy to battery
	// 				if (queen.carry.energy < queen.carryCapacity) {
	// 					queen.task = new TaskWithdraw(this.link);
	// 				} else {
	// 					queen.task = new TaskDeposit(this.battery);
	// 				}
	// 			} else {
	// 				if (queen.carry.energy < queen.carryCapacity) { // make sure you're recharged
	// 					queen.task = new TaskWithdraw(this.link);
	// 				}
	// 			}
	// 		}
	// 	}
	// 	// // If all of the above is done and hatchery is not in emergencyMode, move to the idle point and renew as needed
	// 	// if (!this.emergencyMode && queen.isIdle) {
	// 	// 	if (queen.pos.isEqualTo(this.idlePos)) {
	// 	// 		// If queen is at idle position, renew her as needed
	// 	// 		if (queen.ticksToLive < this.settings.renewQueenAt && this.availableSpawns.length > 0) {
	// 	// 			this.availableSpawns[0].renewCreep(queen.creep);
	// 	// 		}
	// 	// 	} else {
	// 	// 		// Otherwise, travel back to idle position
	// 	// 		queen.travelTo(this.idlePos);
	// 	// 	}
	// 	// }
	// }

	private handleSpawns(): void {
		// Spawn all queued creeps that you can
		while (this.availableSpawns.length > 0) {
			if (this.spawnHighestPriorityCreep() != OK) {
				break;
			}
		}
	}

	// /* Request a new queen if there are structures to deposit into and if there is energy income */
	// protected registerCreepRequests(): void {
	// 	if (!this.queen && this.room.storage) {
	// 		this.enqueue(new QueenSetup().create(this.colony, {
	// 			assignment            : this.room.controller!,
	// 			patternRepetitionLimit: this.settings.queenSize,
	// 		}));
	// 	}
	// 	if (this.room.sinks.length > 0 && this.colony.getCreepsByRole('miner').length > 0) {
	// 		if (this.colony.getCreepsByRole('supplier').length < this.settings.numSuppliers) {
	// 			this.enqueue(new SupplierSetup().create(this.colony, {
	// 				assignment            : this.room.controller!,
	// 				patternRepetitionLimit: this.settings.supplierSize,
	// 			}));
	// 		}
	// 	}
	// }

	// Runtime operation ===============================================================================================
	init(): void {
		// this.registerObjectives();
		this.registerEnergyRequests();
		// this.registerCreepRequests();
	}

	run(): void {
		// this.handleQueen();
		this.handleSpawns();
	}
}

