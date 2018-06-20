// Hatchery - groups all spawns and extensions in a colony

import {HiveCluster} from './_HiveCluster';
import {profile} from '../profiler/decorator';
import {HatcheryOverlord} from '../overlords/core/queen';
import {Priority} from '../priorities/priorities';
import {Colony, ColonyStage} from '../Colony';
import {TransportRequestGroup} from '../logistics/TransportRequestGroup';
import {bodyCost} from '../overlords/CreepSetup';
import {Mem} from '../Memory';
import {Visualizer} from '../visuals/Visualizer';
import {Stats} from '../stats/stats';
import {Zerg} from '../Zerg';
import {log} from '../console/log';

const ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH = -10;

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
	settings: {												// Settings for hatchery operation
		refillTowersBelow: number,  							// What value to refill towers at?
		linksRequestEnergyBelow: number, 						// What value will links store more energy at?
		supplierSize: number,									// Size of supplier in body pattern units
		numSuppliers: number,									// Number of suppliers to maintain
		queenSize: number,										// Size of queen in body patern repetition units
		numQueens: number,										// Number of queens the Hatchery needs
		renewQueenAt: number,									// Renew idle queens below this ticksRemaining value
		suppressSpawning: boolean,             					// Prevents the hatchery from spawning this tick
	};
	private productionPriorities: number[];
	private productionQueue: { [priority: number]: protoCreep[] };  // Priority queue of protocreeps
	private _energyStructures: (StructureSpawn | StructureExtension)[];
	static restrictedRange = 6;								// Don't stand idly within this range of hatchery

	constructor(colony: Colony, headSpawn: StructureSpawn) {
		super(colony, headSpawn, 'hatchery');
		// Register structure components
		if (this.colony.layout == 'twoPart') this.colony.destinations.push(this.pos);
		this.spawns = colony.spawns;
		this.availableSpawns = _.filter(this.spawns, (spawn: StructureSpawn) => !spawn.spawning);
		this.extensions = colony.extensions;
		this.link = this.pos.findClosestByLimitedRange(colony.availableLinks, 2);
		this.colony.linkNetwork.claimLink(this.link);
		this.battery = this.pos.findClosestByLimitedRange(this.room.containers, 2);
		this.colony.obstacles.push(this.idlePos);
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
			suppressSpawning       : false,
		};
		// Register the hatchery overlord
		this.overlord = new HatcheryOverlord(this);
		// Assign a separate store group if hatchery has a dedicated attendant
		this.transportRequests = new TransportRequestGroup();
		this.memory.stats = this.getStats();
	}

	get memory(): HatcheryMemory {
		return Mem.wrap(this.colony.memory, 'hatchery');
	}

	// Idle position for queen
	get idlePos(): RoomPosition {
		if (this.battery) {
			return this.battery.pos;
		} else {
			return this.spawns[0].pos.availableNeighbors(true)[0];
		}
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
		// Register requests for input into the hatchery (goes on colony store group)
		if (this.link && this.link.isEmpty) {
			this.colony.linkNetwork.requestReceive(this.link);
		}
		if (this.battery) {
			let threshold = this.colony.stage == ColonyStage.Larva ? 0.75 : 0.5;
			if (this.battery.energy < threshold * this.battery.storeCapacity) {
				this.colony.logisticsNetwork.requestInput(this.battery, {multiplier: 1.5});
			}
		}
		// Register energy transport requests (goes on hatchery store group, which can be colony store group)
		let refillSpawns = _.filter(this.spawns, spawn => spawn.energy < spawn.energyCapacity);
		let refillExtensions = _.filter(this.extensions, extension => extension.energy < extension.energyCapacity);
		let refillTowers = _.filter(this.towers, tower => tower.energy < tower.energyCapacity);
		_.forEach(refillSpawns, spawn => this.transportRequests.requestInput(spawn, Priority.NormalHigh));
		_.forEach(refillExtensions, extension => this.transportRequests.requestInput(extension, Priority.NormalHigh));
		_.forEach(refillTowers, tower =>
			this.transportRequests.requestInput(tower, tower.energy < this.settings.refillTowersBelow ?
													   Priority.Low : Priority.Low)); // TODO: made change here
	}

	// Creep queueing and spawning =====================================================================================

	private generateCreepName(roleName: string): string {
		// Generate a creep name based on the role and add a suffix to make it unique
		let i = 0;
		while (Game.creeps[(roleName + '_' + i)]) {
			i++;
		}
		return (roleName + '_' + i);
	};

	// /* Generate (but not spawn) the largest creep possible, returns the protoCreep as an object */
	// generateProtoCreep(setup: CreepSetup, overlord: Overlord, bootstrap = false): protoCreep {
	// 	// Generate the creep body
	// 	let creepBody: BodyPartConstant[];
	// 	if (this.colony.incubator) { // if you're being incubated, build as big a creep as you want
	// 		creepBody = setup.generateBody(this.colony.incubator.room.energyCapacityAvailable);
	// 	} else { // otherwise limit yourself to actual energy constraints
	// 		creepBody = setup.generateBody(this.colony.room.energyCapacityAvailable);
	// 	}
	// 	if (bootstrap) {
	// 		creepBody = setup.generateBody(this.colony.room.energyAvailable);
	// 	}
	// 	// Generate the creep memory
	// 	let creepMemory: CreepMemory = {
	// 		colony  : overlord.colony.name, 						// name of the colony the creep is assigned to
	// 		overlord: overlord.ref,								// name of the overseer running this creep
	// 		role    : setup.role,								// role of the creep
	// 		task    : null, 									// task the creep is performing
	// 		data    : { 										// rarely-changed data about the creep
	// 			origin: '',										// where it was spawned, filled in at spawn time
	// 		},
	// 		_trav   : null,
	// 	};
	// 	// Create the protocreep and return it
	// 	let protoCreep: protoCreep = { 							// object to add to spawner queue
	// 		body  : creepBody, 										// body array
	// 		name  : setup.role, 									// name of the creep - gets modified by hatchery
	// 		memory: creepMemory,									// memory to initialize with
	// 	};
	// 	return protoCreep;
	// }

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
			if (bodyCost(protoCreep.body) > this.room.energyCapacityAvailable) {
				return ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH;
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

	canSpawn(body: BodyPartConstant[]): boolean {
		return bodyCost(body) <= this.room.energyCapacityAvailable;
	}

	canSpawnZerg(zerg: Zerg): boolean {
		return this.canSpawn(_.map(zerg.body, part => part.type));
	}

	enqueue(protoCreep: protoCreep, priority: number): void {
		if (this.canSpawn(protoCreep.body)) {
			// Spawn the creep yourself if you can
			if (!this.productionQueue[priority]) {
				this.productionQueue[priority] = [];
				this.productionPriorities.push(priority);
			}
			this.productionQueue[priority].push(protoCreep);
		} else {
			// If you are incubating and can't build the requested creep, enqueue it to the incubation hatchery
			if (this.colony.incubator && this.colony.incubator.hatchery) {
				this.colony.incubator.hatchery.enqueue(protoCreep, priority);
			} else {
				log.warning(`${this.room.print} hatchery: cannot spawn creep ${protoCreep.name}!`);
			}
		}
	}

	private spawnHighestPriorityCreep(): number | undefined {
		let sortedKeys = _.sortBy(this.productionPriorities);
		for (let priority of sortedKeys) {
			let protoCreep = this.productionQueue[priority].shift();
			if (protoCreep) {
				let result = this.spawnCreep(protoCreep);
				if (result == OK) {
					return result;
				} else if (result != ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH) {
					this.productionQueue[priority].unshift(protoCreep);
					return result;
				}
			}
		}
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
		if (!this.settings.suppressSpawning) {
			this.handleSpawns();
		}
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

