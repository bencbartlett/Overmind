// Hatchery - groups all spawns in a colony

import {HiveCluster} from './HiveCluster';
import {profile} from '../profiler/decorator';
import {HatcheryOverlord} from '../overlords/hiveCluster/overlord_hatchery';
import {Priority} from '../settings/priorities';
import {Colony} from '../Colony';
import {TransportRequestGroup} from '../logistics/TransportRequestGroup';
import {CreepSetup} from '../creepSetup/CreepSetup';
import {Overlord} from '../overlords/Overlord';
import {Mem} from '../memory';
import {Visualizer} from '../visuals/Visualizer';
import {Stats} from '../stats/stats';

@profile
export class Hatchery extends HiveCluster {
	spawns: StructureSpawn[]; 								// List of spawns in the hatchery
	availableSpawns: StructureSpawn[]; 						// Spawns that are available to make stuff right now
	extensions: StructureExtension[]; 						// List of extensions in the hatchery
	link: StructureLink | undefined; 						// The input link
	towers: StructureTower[]; 								// All towers that aren't in the command center
	battery: StructureContainer | undefined;				// The container to provide an energy buffer
	transportRequests: TransportRequestGroup;				// Box for energy requests
	overlord: HatcheryOverlord | undefined;					// Hatchery overlord if past larva stage
	private settings: {										// Settings for hatchery operation
		refillTowersBelow: number,  							// What value to refill towers at?
		linksRequestEnergyBelow: number, 						// What value will links request more energy at?
		supplierSize: number,									// Size of supplier in body pattern units
		numSuppliers: number,									// Number of suppliers to maintain
		queenSize: number,										// Size of queen in body patern repetition units
		numQueens: number,										// Number of queens the Hatchery needs
		renewQueenAt: number,									// Renew idle queens below this ticksRemaining value
	};
	private productionPriorities: number[];
	private productionQueue: { [priority: number]: protoCreep[] };  // Priority queue of protocreeps
	private _idlePos: RoomPosition; 								// Idling position for the supplier
	private _energyStructures: (StructureSpawn | StructureExtension)[];

	constructor(colony: Colony, headSpawn: StructureSpawn) {
		super(colony, headSpawn, 'hatchery');
		// Register structure components
		this.spawns = colony.spawns;
		this.availableSpawns = _.filter(this.spawns, (spawn: StructureSpawn) => !spawn.spawning);
		this.extensions = colony.extensions;
		this.link = this.pos.findClosestByLimitedRange(colony.links, 2);
		this.battery = this.pos.findClosestByLimitedRange(this.room.containers, 2);
		// Associate all towers that aren't part of the command center if there is one
		if (colony.commandCenter) { // TODO: make this not order-dependent
			this.towers = _.difference(colony.towers, colony.commandCenter.towers);
		} else {
			this.towers = colony.towers;
		}
		this.productionPriorities = [];
		this.productionQueue = {};
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
		this.overlord = new HatcheryOverlord(this);
		// Assign a separate request group if hatchery has a dedicated attendant
		this.transportRequests = new TransportRequestGroup();
		this.memory.stats = this.getStats();
	}

	get memory(): HatcheryMemory {
		return Mem.wrap(this.colony.memory, 'hatchery');
	}

	private getStats() {
		// Compute uptime
		let spawnUsageThisTick = _.filter(this.spawns, spawn => spawn.spawning).length / this.spawns.length;
		let uptime: number;
		if (this.memory.stats && this.memory.stats.uptime) {
			uptime = (this.memory.stats.uptime * (CREEP_LIFE_TIME - 1) + spawnUsageThisTick) / CREEP_LIFE_TIME;
		} else {
			uptime = spawnUsageThisTick;
		}
		Stats.log(`colonies.${this.colony.name}.hatchery.uptime`, uptime);
		return {
			uptime: uptime,
		};
	}

	/* Request more energy when appropriate either via link or hauler */
	private registerEnergyRequests(): void {
		// Register requests for input into the hatchery (goes on colony request group)
		if (this.link && this.link.isEmpty) {
			this.colony.linkNetwork.requestReceive(this.link);
		}
		if (this.battery) {
			if (this.battery.energy < 0.25 * this.battery.storeCapacity) {
				// this.colony.transportRequests.requestEnergy(this.battery);
				// this.colony.logisticsNetwork.request(this.battery);
				this.colony.logisticsGroup.request(this.battery);
			}
		}
		// Register energy transport requests (goes on hatchery request group, which can be colony request group)
		let refillSpawns = _.filter(this.spawns, spawn => spawn.energy < spawn.energyCapacity);
		let refillExtensions = _.filter(this.extensions, extension => extension.energy < extension.energyCapacity);
		let refillTowers = _.filter(this.towers, tower => tower.energy < tower.energyCapacity);
		_.forEach(refillSpawns, spawn => this.transportRequests.requestEnergy(spawn, Priority.NormalHigh));
		_.forEach(refillExtensions, extension => this.transportRequests.requestEnergy(extension, Priority.NormalHigh));
		_.forEach(refillTowers, tower =>
			this.transportRequests.requestEnergy(tower, tower.energy < this.settings.refillTowersBelow ?
														Priority.High : Priority.Low));
	}

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
		// Generate a creep name based on the role and add a suffix to make it unique
		let i = 0;
		while (Game.creeps[(roleName + '_' + i)]) {
			i++;
		}
		return (roleName + '_' + i);
	};

	/* Generate (but not spawn) the largest creep possible, returns the protoCreep as an object */
	generateProtoCreep(setup: CreepSetup, overlord: Overlord): protoCreep {
		// Generate the creep body
		let creepBody: BodyPartConstant[];
		if (this.colony.incubator) { // if you're being incubated, build as big a creep as you want
			creepBody = setup.generateBody(this.colony.incubator.room.energyCapacityAvailable);
		} else { // otherwise limit yourself to actual energy constraints
			creepBody = setup.generateBody(this.colony.room.energyCapacityAvailable);
		}
		// Generate the creep memory
		let creepMemory: CreepMemory = {
			colony  : overlord.colony.name, 						// name of the colony the creep is assigned to
			overlord: overlord.ref,								// name of the overseer running this creep
			role    : setup.role,								// role of the creep
			task    : null, 									// task the creep is performing
			data    : { 										// rarely-changed data about the creep
				origin   : '',										// where it was spawned, filled in at spawn time
				replaceAt: 0, 										// when it should be replaced
				boosts   : {} 										// keeps track of what boosts creep has/needs
			},
			_trav   : null,
		};
		// Create the protocreep and return it
		let protoCreep: protoCreep = { 							// object to add to spawner queue
			body  : creepBody, 										// body array
			name  : setup.role, 									// name of the creep - gets modified by hatchery
			memory: creepMemory,									// memory to initialize with
		};
		return protoCreep;
	}

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
			// if (protoCreep.memory.colony != this.colony.name) {
			// 	log.info('Spawning ' + protoCreep.name + ' for ' + protoCreep.memory.colony);
			// }
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
		if (this.colony.incubator && this.colony.incubator.hatchery &&
			this.bodyCost(protoCreep.body) > this.room.energyCapacityAvailable) {
			this.colony.incubator.hatchery.enqueue(protoCreep, priority);
			// log.info('Requesting ' + protoCreep.name + ' from ' + this.colony.incubator.name);
		} else {
			// Otherwise, queue the creep to yourself
			if (!this.productionQueue[priority]) {
				this.productionQueue[priority] = [];
				this.productionPriorities.push(priority);
			}
			this.productionQueue[priority].push(protoCreep);
		}
	}

	private spawnHighestPriorityCreep(): number | void {
		let sortedKeys = _.sortBy(this.productionPriorities);
		for (let priority of sortedKeys) {
			let protoCreep = this.productionQueue[priority].shift();
			if (protoCreep) {
				let result = this.spawnCreep(protoCreep);
				if (result == OK) {
					// log.info(`${this.colony.name}: spawning ${protoCreep.name} for ${protoCreep.memory.colony}`);
					return result;
				} else {
					this.productionQueue[priority].unshift(protoCreep);
					return result;
				}
			}
		}
	}

	// Idle position for suppliers
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
		if (this.battery) {
			return this.battery.pos;
		} else {
			let possiblePositions = this.spawns[0].pos.neighbors;
			let proximateStructures: Structure[] = _.compact([...this.spawns,
															  this.link!,
															  this.battery!,]);
			let numNearbyStructures = (pos: RoomPosition) =>
				_.filter(proximateStructures, s => s.pos.isNearTo(pos) && !s.pos.isEqualTo(pos)).length;
			let nearbyStructuresEachPos = _.map(possiblePositions, pos => numNearbyStructures(pos));
			let maxIndex = _.findIndex(nearbyStructuresEachPos, _.max(nearbyStructuresEachPos));
			return possiblePositions[maxIndex];
		}
		// for (let structure of proximateStructures) {
		// 	if (structure) {
		// 		let filteredPositions = _.filter(possiblePositions, p => p.isNearTo(structure!) &&
		// 																 !p.isEqualTo(structure!));
		// 		if (filteredPositions.length == 0) { // stop when it's impossible to match any more structures
		// 			return possiblePositions[0];
		// 		} else {
		// 			possiblePositions = filteredPositions;
		// 		}
		// 	}
		// }
		// return possiblePositions[0];
	}

	private handleSpawns(): void {
		// Spawn all queued creeps that you can
		while (this.availableSpawns.length > 0) {
			if (this.spawnHighestPriorityCreep() != OK) {
				break;
			}
		}
	}

	// Runtime operation ===============================================================================================
	init(): void {
		this.registerEnergyRequests();
	}

	run(): void {
		this.handleSpawns();
	}

	visuals() {
		let spawnInfo = '';
		_.forEach(this.spawns, function (spawn) {
			if (spawn.spawning) {
				spawnInfo += ' ' + spawn.spawning.name.split('_')[0];
			}
		});
		let info = [
			`Energy: ${this.room.energyAvailable} / ${this.room.energyCapacityAvailable}`,
			`Status: ${spawnInfo != '' ? 'spawning' + ' ' + spawnInfo : 'idle' }`,
			`Uptime: ${Number(this.memory.stats.uptime).toFixed(2)}`
		];
		Visualizer.showInfo(info, this);
	}
}

