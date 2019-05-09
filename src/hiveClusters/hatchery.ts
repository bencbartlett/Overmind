import {$} from '../caching/GlobalCache';
import {Colony, ColonyStage} from '../Colony';
import {log} from '../console/log';
import {bodyCost, CreepSetup} from '../creepSetups/CreepSetup';
import {TransportRequestGroup} from '../logistics/TransportRequestGroup';
import {Mem} from '../memory/Memory';
import {Movement} from '../movement/Movement';
import {Pathing} from '../movement/Pathing';
import {QueenOverlord} from '../overlords/core/queen';
import {BunkerQueenOverlord} from '../overlords/core/queen_bunker';
import {Overlord} from '../overlords/Overlord';
import {Priority} from '../priorities/priorities';
import {profile} from '../profiler/decorator';
import {energyStructureOrder, getPosFromBunkerCoord, insideBunkerBounds} from '../roomPlanner/layouts/bunker';
import {Stats} from '../stats/stats';
import {exponentialMovingAverage, hasMinerals} from '../utilities/utils';
import {Visualizer} from '../visuals/Visualizer';
import {Zerg} from '../zerg/Zerg';
import {HiveCluster} from './_HiveCluster';

const ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH = -20;
const ERR_SPECIFIED_SPAWN_BUSY = -21;

export interface SpawnRequest {
	setup: CreepSetup;					// creep body generator to use
	overlord: Overlord;					// overlord requesting the creep
	priority: number;					// priority of the request // TODO: WIP
	partners?: CreepSetup[];			// partners to spawn along with the creep
	options?: SpawnRequestOptions;		// options
}

export interface SpawnRequestOptions {
	spawn?: StructureSpawn;				// allows you to specify which spawn to use; only use for high priority
	directions?: DirectionConstant[];	// StructureSpawn.spawning.directions
}

interface SpawnOrder {
	protoCreep: ProtoCreep;
	options: SpawnOptions | undefined;
}

export interface HatcheryMemory {
	stats: {
		overload: number;
		uptime: number;
		longUptime: number;
	};
}

const HatcheryMemoryDefaults: HatcheryMemory = {
	stats: {
		overload  : 0,
		uptime    : 0,
		longUptime: 0,
	}
};


/**
 * The hatchery encompasses all spawning-related structures, like spawns, extensions, and some energy buffer containers,
 * and contains logic for spawning the creeps requested by overlords
 */
@profile
export class Hatchery extends HiveCluster {

	memory: HatcheryMemory;
	spawns: StructureSpawn[]; 								// List of spawns in the hatchery
	availableSpawns: StructureSpawn[]; 						// Spawns that are available to make stuff right now
	extensions: StructureExtension[]; 						// List of extensions in the hatchery
	energyStructures: (StructureSpawn | StructureExtension)[]; 	// All spawns and extensions
	link: StructureLink | undefined; 						// The input link
	towers: StructureTower[]; 								// All towers that aren't in the command center
	battery: StructureContainer | undefined;				// The container to provide an energy buffer
	transportRequests: TransportRequestGroup;				// Box for energy requests
	overlord: QueenOverlord | BunkerQueenOverlord;			// Hatchery overlord if past larva stage
	settings: {												// Settings for hatchery operation
		refillTowersBelow: number,  							// What value to refill towers at?
		linksRequestEnergyBelow: number, 						// What value will links store more energy at?
		suppressSpawning: boolean,             					// Prevents the hatchery from spawning this tick
	};
	private _nextAvailability: number | undefined;
	// private _queuedSpawnTime: number | undefined;
	private productionPriorities: number[];
	private productionQueue: {								// Prioritized spawning queue
		[priority: number]: SpawnOrder[]
	};
	private isOverloaded: boolean;

	static restrictedRange = 6;								// Don't stand idly within this range of hatchery

	constructor(colony: Colony, headSpawn: StructureSpawn) {
		super(colony, headSpawn, 'hatchery');
		// Register structure components
		this.memory = Mem.wrap(this.colony.memory, 'hatchery', HatcheryMemoryDefaults, true);
		if (this.colony.layout == 'twoPart') this.colony.destinations.push({pos: this.pos, order: -1});
		this.spawns = colony.spawns;
		this.availableSpawns = _.filter(this.spawns, spawn => !spawn.spawning);
		this.extensions = colony.extensions;
		this.towers = colony.commandCenter ? _.difference(colony.towers, colony.commandCenter.towers) : colony.towers;
		if (this.colony.layout == 'bunker') {
			this.battery = _.first(_.filter(this.room.containers, cont => insideBunkerBounds(cont.pos, this.colony)));
			$.set(this, 'energyStructures', () => this.computeEnergyStructures());
		} else {
			this.link = this.pos.findClosestByLimitedRange(colony.availableLinks, 2);
			this.colony.linkNetwork.claimLink(this.link);
			this.battery = this.pos.findClosestByLimitedRange(this.room.containers, 2);
			this.energyStructures = (<(StructureSpawn | StructureExtension)[]>[]).concat(this.spawns, this.extensions);
		}
		this.productionPriorities = [];
		this.productionQueue = {};
		this.isOverloaded = false;
		this.settings = {
			refillTowersBelow      : 750,
			linksRequestEnergyBelow: 0,
			suppressSpawning       : false,
		};
		this.transportRequests = colony.transportRequests; // hatchery always uses colony transport group
	}

	refresh() {
		this.memory = Mem.wrap(this.colony.memory, 'hatchery', HatcheryMemoryDefaults, true);
		$.refreshRoom(this);
		$.refresh(this, 'spawns', 'extensions', 'energyStructures', 'link', 'towers', 'battery');
		this.availableSpawns = _.filter(this.spawns, spawn => !spawn.spawning);
		this.isOverloaded = false;
		this.productionPriorities = [];
		this.productionQueue = {};
	}

	spawnMoarOverlords() {
		if (this.colony.layout == 'bunker' && (this.colony.storage || this.colony.terminal)
			&& this.colony.assets[RESOURCE_ENERGY] > 10000) {
			this.overlord = new BunkerQueenOverlord(this); // use bunker queen if has storage and enough energy
		} else {
			this.overlord = new QueenOverlord(this);
		}
	}

	// Idle position for queen
	get idlePos(): RoomPosition {
		if (this.battery) {
			return this.battery.pos;
		} else {
			return this.spawns[0].pos.availableNeighbors(true)[0];
		}
	}

	private computeEnergyStructures(): (StructureSpawn | StructureExtension)[] {
		if (this.colony.layout == 'bunker') {
			const positions = _.map(energyStructureOrder, coord => getPosFromBunkerCoord(coord, this.colony));
			let spawnsAndExtensions: (StructureSpawn | StructureExtension)[] = [];
			spawnsAndExtensions = spawnsAndExtensions.concat(this.spawns, this.extensions);
			const energyStructures: (StructureSpawn | StructureExtension)[] = [];
			for (const pos of positions) {
				const structure = _.find(pos.lookFor(LOOK_STRUCTURES), s =>
					s.structureType == STRUCTURE_SPAWN
					|| s.structureType == STRUCTURE_EXTENSION) as StructureSpawn | StructureExtension;
				if (structure) {
					energyStructures.push(_.remove(spawnsAndExtensions, s => s.id == structure.id)[0]);
				}
			}
			return _.compact(energyStructures.concat(spawnsAndExtensions));
		} else {
			// Ugly workaround to [].concat() throwing a temper tantrum
			let spawnsAndExtensions: (StructureSpawn | StructureExtension)[] = [];
			spawnsAndExtensions = spawnsAndExtensions.concat(this.spawns, this.extensions);
			return _.sortBy(spawnsAndExtensions, structure => structure.pos.getRangeTo(this.idlePos));
		}
	}

	/* Request more energy when appropriate either via link or hauler */
	private registerEnergyRequests(): void {
		// Register requests for input into the hatchery (goes on colony store group)
		if (this.link && this.link.isEmpty) {
			this.colony.linkNetwork.requestReceive(this.link);
		}
		if (this.battery) {
			const threshold = this.colony.stage == ColonyStage.Larva ? 0.75 : 0.5;
			if (this.battery.energy < threshold * this.battery.storeCapacity) {
				this.colony.logisticsNetwork.requestInput(this.battery, {multiplier: 1.5});
			}
			// get rid of any minerals in the container if present
			if (hasMinerals(this.battery.store)) {
				this.colony.logisticsNetwork.requestOutputMinerals(this.battery);
			}
		}
		// Register energy transport requests (goes on hatchery store group, which can be colony store group)
		// let refillStructures = this.energyStructures;
		// if (this.colony.defcon > DEFCON.safe) {
		// 	for (let hostile of this.room.dangerousHostiles) {
		// 		// TODO: remove tranport requests if blocked by enemies
		// 	}
		// }
		// if (this.room.defcon > 0) {refillStructures = _.filter()}
		_.forEach(this.energyStructures, struct => this.transportRequests.requestInput(struct, Priority.NormalLow));

		// let refillSpawns = _.filter(this.spawns, spawn => spawn.energy < spawn.energyCapacity);
		// let refillExtensions = _.filter(this.extensions, extension => extension.energy < extension.energyCapacity);
		const refillTowers = _.filter(this.towers, tower => tower.energy < this.settings.refillTowersBelow);
		// _.forEach(refillSpawns, spawn => this.transportRequests.requestInput(spawn, Priority.NormalLow));
		// _.forEach(refillExtensions, extension => this.transportRequests.requestInput(extension, Priority.NormalLow));
		_.forEach(refillTowers, tower => this.transportRequests.requestInput(tower, Priority.NormalLow));
	}

	// Creep queueing and spawning =====================================================================================

	private generateCreepName(roleName: string): string {
		// Generate a creep name based on the role and add a suffix to make it unique
		let i = 0;
		while (Game.creeps[(roleName + '_' + i)]) {
			i++;
		}
		return (roleName + '_' + i);
	}

	private spawnCreep(protoCreep: ProtoCreep, options: SpawnRequestOptions = {}): number {
		// get a spawn to use
		let spawnToUse: StructureSpawn | undefined;
		if (options.spawn) {
			spawnToUse = options.spawn;
			if (spawnToUse.spawning) {
				return ERR_SPECIFIED_SPAWN_BUSY;
			} else {
				_.remove(this.availableSpawns, spawn => spawn.id == spawnToUse!.id); // mark as used
			}
		} else {
			spawnToUse = this.availableSpawns.shift();
		}
		if (spawnToUse) { // if there is a spawn, create the creep
			if (this.colony.bunker && this.colony.bunker.coreSpawn
				&& spawnToUse.id == this.colony.bunker.coreSpawn.id && !options.directions) {
				options.directions = [TOP, RIGHT]; // don't spawn into the manager spot
			}
			protoCreep.name = this.generateCreepName(protoCreep.name); // modify the creep name to make it unique
			if (bodyCost(protoCreep.body) > this.room.energyCapacityAvailable) {
				return ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH;
			}
			protoCreep.memory.data.origin = spawnToUse.pos.roomName;
			const result = spawnToUse.spawnCreep(protoCreep.body, protoCreep.name, {
				memory          : protoCreep.memory,
				energyStructures: this.energyStructures,
				directions      : options.directions
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

	/* Generate (but not spawn) the largest creep possible, returns the protoCreep as an object */
	private generateProtoCreep(setup: CreepSetup, overlord: Overlord): ProtoCreep {
		// Generate the creep body
		let creepBody: BodyPartConstant[];
		// if (overlord.colony.incubator) { // if you're being incubated, build as big a creep as you want
		// 	creepBody = setup.generateBody(overlord.colony.incubator.room.energyCapacityAvailable);
		// } else { // otherwise limit yourself to actual energy constraints
		creepBody = setup.generateBody(this.room.energyCapacityAvailable);
		// }
		// Generate the creep memory
		const creepMemory: CreepMemory = {
			[_MEM.COLONY]  : overlord.colony.name, 				// name of the colony the creep is assigned to
			[_MEM.OVERLORD]: overlord.ref,						// name of the Overlord running this creep
			role           : setup.role,						// role of the creep
			task           : null, 								// task the creep is performing
			data           : { 									// rarely-changed data about the creep
				origin: '',										// where it was spawned, filled in at spawn time
			},
		};
		// Create the protocreep and return it
		const protoCreep: ProtoCreep = { 							// object to add to spawner queue
			body  : creepBody, 										// body array
			name  : setup.role, 									// name of the creep - gets modified by hatchery
			memory: creepMemory,									// memory to initialize with
		};
		return protoCreep;
	}

	/* Returns the approximate aggregated time at which the hatchery will next be available to spawn something */
	get nextAvailability(): number {
		if (!this._nextAvailability) {
			const allQueued = _.flatten(_.values(this.productionQueue)) as SpawnOrder[];
			const queuedSpawnTime = _.sum(allQueued, order => order.protoCreep.body.length) * CREEP_SPAWN_TIME;
			const activeSpawnTime = _.sum(this.spawns, spawn => spawn.spawning ? spawn.spawning.remainingTime : 0);
			this._nextAvailability = (activeSpawnTime + queuedSpawnTime) / this.spawns.length;
		}
		return this._nextAvailability;
	}

	// /* Number of ticks required to make everything in spawn queue divided by number of spawns */
	// get queuedSpawnTime(): number {
	// 	if (!this._queuedSpawnTime) {
	// 		let allQueued = _.flatten(_.values(this.productionQueue)) as SpawnOrder[];
	// 		let queuedSpawnTime = _.sum(allQueued, order => order.protoCreep.body.length) * CREEP_SPAWN_TIME;
	// 		this._queuedSpawnTime = queuedSpawnTime / this.spawns.length;
	// 	}
	// 	return this._queuedSpawnTime;
	// }

	/* Enqueues a request to the hatchery */
	enqueue(request: SpawnRequest): void {
		const protoCreep = this.generateProtoCreep(request.setup, request.overlord);
		const priority = request.priority;
		if (this.canSpawn(protoCreep.body) && protoCreep.body.length > 0) {
			// Spawn the creep yourself if you can
			this._nextAvailability = undefined; // invalidate cache
			// this._queuedSpawnTime = undefined;
			if (!this.productionQueue[priority]) {
				this.productionQueue[priority] = [];
				this.productionPriorities.push(priority); // this is necessary because keys interpret number as string
			}
			this.productionQueue[priority].push({protoCreep: protoCreep, options: request.options});
		} else {
			log.debug(`${this.room.print}: cannot spawn creep ${protoCreep.name} with body ` +
					  `${JSON.stringify(protoCreep.body)}!`);
		}
	}

	private spawnHighestPriorityCreep(): number | undefined {
		const sortedKeys = _.sortBy(this.productionPriorities);
		for (const priority of sortedKeys) {

			// if (this.colony.defcon >= DEFCON.playerInvasion
			// 	&& !this.colony.controller.safeMode
			// 	&& priority > OverlordPriority.warSpawnCutoff) {
			// 	continue; // don't spawn non-critical creeps during wartime
			// }

			const nextOrder = this.productionQueue[priority].shift();
			if (nextOrder) {
				const {protoCreep, options} = nextOrder;
				const result = this.spawnCreep(protoCreep, options);
				if (result == OK) {
					return result;
				} else if (result == ERR_SPECIFIED_SPAWN_BUSY) {
					return result; // continue to spawn other things while waiting on specified spawn
				} else {
					// If there's not enough energyCapacity to spawn, ignore it and move on, otherwise block and wait
					if (result != ERR_ROOM_ENERGY_CAPACITY_NOT_ENOUGH) {
						this.productionQueue[priority].unshift(nextOrder);
						return result;
					}
				}
			}
		}
	}

	private handleSpawns(): void {
		// Spawn all queued creeps that you can
		while (this.availableSpawns.length > 0) {
			const result = this.spawnHighestPriorityCreep();
			if (result == ERR_NOT_ENOUGH_ENERGY) { // if you can't spawn something you want to
				this.isOverloaded = true;
			}
			if (result != OK && result != ERR_SPECIFIED_SPAWN_BUSY) {
				// Can't spawn creep right now
				break;
			}
		}
		// Move creeps off of exit position to let the spawning creep out if necessary
		for (const spawn of this.spawns) {
			if (spawn.spawning && spawn.spawning.remainingTime <= 1
				&& spawn.pos.findInRange(FIND_MY_CREEPS, 1).length > 0) {
				let directions: DirectionConstant[];
				if (spawn.spawning.directions) {
					directions = spawn.spawning.directions;
				} else {
					directions = _.map(spawn.pos.availableNeighbors(true), pos => spawn.pos.getDirectionTo(pos));
				}
				const exitPos = Pathing.positionAtDirection(spawn.pos, _.first(directions)) as RoomPosition;
				Movement.vacatePos(exitPos);
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
		this.recordStats();
	}

	private recordStats() {
		// Compute uptime and overload status
		const spawnUsageThisTick = _.filter(this.spawns, spawn => spawn.spawning).length / this.spawns.length;
		const uptime = exponentialMovingAverage(spawnUsageThisTick, this.memory.stats.uptime, CREEP_LIFE_TIME);
		const longUptime = exponentialMovingAverage(spawnUsageThisTick, this.memory.stats.longUptime, 5 * CREEP_LIFE_TIME);
		const overload = exponentialMovingAverage(this.isOverloaded ? 1 : 0, this.memory.stats.overload, CREEP_LIFE_TIME);

		Stats.log(`colonies.${this.colony.name}.hatchery.uptime`, uptime);
		Stats.log(`colonies.${this.colony.name}.hatchery.overload`, overload);

		this.memory.stats = {overload, uptime, longUptime};
	}

	visuals(coord: Coord): Coord {
		let {x, y} = coord;
		const spawning: string[] = [];
		const spawnProgress: [number, number][] = [];
		_.forEach(this.spawns, function(spawn) {
			if (spawn.spawning) {
				spawning.push(spawn.spawning.name.split('_')[0]);
				const timeElapsed = spawn.spawning.needTime - spawn.spawning.remainingTime;
				spawnProgress.push([timeElapsed, spawn.spawning.needTime]);
			}
		});
		const boxCoords = Visualizer.section(`${this.colony.name} Hatchery`, {x, y, roomName: this.room.name},
											 9.5, 3 + spawning.length + .1);
		const boxX = boxCoords.x;
		y = boxCoords.y + 0.25;

		// Log energy
		Visualizer.text('Energy', {x: boxX, y: y, roomName: this.room.name});
		Visualizer.barGraph([this.room.energyAvailable, this.room.energyCapacityAvailable],
							{x: boxX + 4, y: y, roomName: this.room.name}, 5);
		y += 1;

		// Log uptime
		const uptime = this.memory.stats.uptime;
		Visualizer.text('Uptime', {x: boxX, y: y, roomName: this.room.name});
		Visualizer.barGraph(uptime, {x: boxX + 4, y: y, roomName: this.room.name}, 5);
		y += 1;

		// Log overload status
		const overload = this.memory.stats.overload;
		Visualizer.text('Overload', {x: boxX, y: y, roomName: this.room.name});
		Visualizer.barGraph(overload, {x: boxX + 4, y: y, roomName: this.room.name}, 5);
		y += 1;

		for (const i in spawning) {
			Visualizer.text(spawning[i], {x: boxX, y: y, roomName: this.room.name});
			Visualizer.barGraph(spawnProgress[i], {x: boxX + 4, y: y, roomName: this.room.name}, 5);
			y += 1;
		}
		return {x: x, y: y + .25};
	}
}

