// Overseer: coordinates and directs related creep and structure actions in a more distributed manner than hive clusters

import {CreepSetup} from '../creepSetup/CreepSetup';
import {profile} from '../lib/Profiler';
import {Pathing} from '../pathing/pathing';
import {Priority} from '../config/priorities';
import {Colony} from '../Colony';
import {Zerg} from '../Zerg';

export interface IOverlordInitializer {
	name: string;
	room: Room | undefined;
	pos: RoomPosition;
	colony: Colony;
	memory: any;
}

@profile
export abstract class Overlord {

	// directive: IDirective;
	// flag: Flag;
	room: Room | undefined;
	name: string;
	priority: number;
	ref: string;
	pos: RoomPosition;
	colony: Colony;
	creeps: { [roleName: string]: Zerg[] };
	memory: OverlordMemory;

	constructor(initializer: IOverlordInitializer, name: string, priority = Priority.Normal) {
		this.name = name;
		this.room = initializer.room;
		this.priority = priority;
		this.ref = initializer.name + ':' + this.name;
		this.pos = initializer.pos;
		this.colony = initializer.colony;
		this.creeps = _.mapValues(Overmind.cache.overlords[this.ref],
								  creepsOfRole => _.map(creepsOfRole, creepName => Game.zerg[creepName]));
		this.initMemory(initializer);
		// Register the overlord on the colony overseer and on the overmind
		this.colony.overseer.overlords[this.priority].push(this);
		Overmind.overlords[this.ref] = this;
	}

	protected getCreeps(role: string): Zerg[] {
		if (this.creeps[role]) {
			return this.creeps[role];
		} else {
			return [];
		}
	}

	protected initMemory(initializer: IOverlordInitializer): void {
		if (!initializer.memory.overlords) {
			initializer.memory.overlords = {};
		}
		if (!initializer.memory.overlords[this.name]) {
			initializer.memory.overlords[this.name] = {};
		}
		this.memory = initializer.memory.overlords[this.name];
	}

	/* Generate (but not spawn) the largest creep possible, returns the protoCreep as an object */
	protected generateProtoCreep(setup: CreepSetup): protoCreep {
		// Generate the creep body
		let creepBody: BodyPartConstant[];
		if (this.colony.incubator) { // if you're being incubated, build as big a creep as you want
			creepBody = setup.generateBody(this.colony.incubator.room.energyCapacityAvailable);
		} else { // otherwise limit yourself to actual energy constraints
			creepBody = setup.generateBody(this.colony.room.energyCapacityAvailable);
		}
		// Generate the creep memory
		let creepMemory: CreepMemory = {
			colony  : this.colony.name, 						// name of the colony the creep is assigned to
			overlord: this.ref,								// name of the overseer running this creep
			role    : setup.role,								// role of the creep
			task    : null, 									// task the creep is performing
			data    : { 										// rarely-changed data about the creep
				origin   : '',										// where it was spawned, filled in at spawn time
				replaceAt: 0, 										// when it should be replaced
				boosts   : {} 										// keeps track of what boosts creep has/needs
			},
			_trav   : null,
			_travel : null,
		};
		// Create the protocreep and return it
		let protoCreep: protoCreep = { 							// object to add to spawner queue
			body  : creepBody, 										// body array
			name  : setup.role, 									// name of the creep - gets modified by hatchery
			memory: creepMemory,									// memory to initialize with
		};
		return protoCreep;
	}


	// TODO: include creep move speed
	protected lifetimeFilter(creeps: Zerg[]): Zerg[] {
		let spawnDistance = 0;
		if (this.colony.hatchery) {
			spawnDistance = Pathing.distance(this.pos, this.colony.hatchery.pos);
		}
		return _.filter(creeps, creep => creep.ticksToLive > 3 * creep.body.length + spawnDistance);
	}

	/* Create a creep setup and enqueue it to the Hatchery */
	protected requestCreep(setup: CreepSetup, priority = this.priority) {
		if (this.colony.hatchery) {
			this.colony.hatchery.enqueue(this.generateProtoCreep(setup), priority);
		}
	}

	/* Wishlist of creeps to simplify spawning logic */
	protected wishlist(quantity: number, setup: CreepSetup, priority = this.priority) {
		if (this.lifetimeFilter(this.getCreeps(setup.role)).length < quantity && this.colony.hatchery) {
			this.colony.hatchery.enqueue(this.generateProtoCreep(setup), priority);
		}
	}

	abstract spawn(): void;

	abstract init(): void;

	abstract run(): void;

}
