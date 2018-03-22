// Overseer: coordinates creep actions and spawn requests related to a common objective

import {CreepSetup} from '../creepSetup/CreepSetup';
import {profile} from '../profiler/decorator';
import {Pathing} from '../pathing/pathing';
import {Colony} from '../Colony';
import {Zerg} from '../Zerg';
import {TaskGetBoosted} from '../tasks/task_getBoosted';
import {log} from '../lib/logger/log';

export interface IOverlordInitializer {
	name: string;
	room: Room | undefined;
	pos: RoomPosition;
	colony: Colony;
	memory: any;
}

@profile
export abstract class Overlord {

	room: Room | undefined;
	name: string;
	priority: number;
	ref: string;
	pos: RoomPosition;
	colony: Colony;
	protected _creeps: { [roleName: string]: Zerg[] };
	creepUsageReport: { [role: string]: [number, number] | undefined };
	memory: OverlordMemory;
	boosts: { [roleName: string]: _ResourceConstantSansEnergy[] | undefined };

	constructor(initializer: IOverlordInitializer, name: string, priority: number) {
		this.initMemory(initializer);
		this.name = name;
		this.room = initializer.room;
		this.priority = priority;
		this.ref = initializer.name + ':' + this.name;
		this.pos = initializer.pos;
		this.colony = initializer.colony;
		this.recalculateCreeps();
		this.creepUsageReport = _.mapValues(this._creeps, creep => undefined);
		// Register the overlord on the colony overseer and on the overmind
		this.colony.overseer.registerOverlord(this);
		this.boosts = _.mapValues(this._creeps, creep => undefined);
		Overmind.overlords[this.ref] = this;
	}

	recalculateCreeps(): void {
		this._creeps = _.mapValues(Overmind.cache.overlords[this.ref],
								   creepsOfRole => _.map(creepsOfRole, creepName => Game.zerg[creepName]));
	}

	/* Gets the "ID" of the outpost this overlord is operating in. 0 for owned rooms, >= 1 for outposts, -1 for other */
	get outpostIndex(): number {
		return _.findIndex(this.colony.roomNames, this.pos.roomName);
	}

	protected reassignIdleCreeps(role: string): void {
		// Find all idle guards
		let idleCreeps = _.filter(this.colony.getCreepsByRole(role), (zerg: Zerg) => !zerg.overlord);
		// Reassign them all to this flag
		for (let creep of idleCreeps) {
			creep.overlord = this;
		}
	}

	protected creeps(role: string): Zerg[] {
		if (this._creeps[role]) {
			return this._creeps[role];
		} else {
			return [];
		}
	}

	protected creepReport(role: string, currentAmt: number, neededAmt: number) {
		this.creepUsageReport[role] = [currentAmt, neededAmt];
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
	lifetimeFilter(creeps: Zerg[], prespawn = 50): Zerg[] {
		let spawnDistance = 0;
		if (this.colony.incubator) {
			spawnDistance = Pathing.distance(this.pos, this.colony.incubator.hatchery!.pos) || 0;
		} else if (this.colony.hatchery) {
			// Use distance or 0 (in case distance returns something undefined due to incomplete pathfinding)
			spawnDistance = Pathing.distance(this.pos, this.colony.hatchery.pos) || 0;
		}

		// The last condition fixes a bug only present on private servers that took me a fucking week to isolate.
		// At the tick of birth, creep.spawning = false and creep.ticksTolive = undefined
		// See: https://screeps.com/forum/topic/443/creep-spawning-is-not-updated-correctly-after-spawn-process
		return _.filter(creeps, creep => creep.ticksToLive! > 3 * creep.body.length + spawnDistance + prespawn ||
										 creep.spawning || (!creep.spawning && !creep.ticksToLive));
	}

	/* Create a creep setup and enqueue it to the Hatchery; does not include automatic reporting */
	protected requestCreep(setup: CreepSetup, prespawn = 50, priority = this.priority) {
		if (this.colony.hatchery) {
			this.colony.hatchery.enqueue(this.generateProtoCreep(setup), priority);
		}
	}

	/* Wishlist of creeps to simplify spawning logic; includes automatic reporting */
	protected wishlist(quantity: number, setup: CreepSetup, prespawn = 50, priority = this.priority) {
		let creepQuantity = this.lifetimeFilter(this.creeps(setup.role)).length;
		if (creepQuantity < quantity && this.colony.hatchery) {
			this.colony.hatchery.enqueue(this.generateProtoCreep(setup), priority);
		}
		this.creepReport(setup.role, creepQuantity, quantity);
	}

	protected handleBoosts(creep: Zerg): void {
		let neededBoosts = this.boosts[creep.roleName];
		if (neededBoosts) {
			let remainingBoosts = _.difference(neededBoosts, creep.boosts);
			let boost = _.first(remainingBoosts);
			if (boost && this.colony.labs.length > 0) {
				let labsContainingBoost = _.filter(this.colony.labs, lab => lab.mineralType == boost);
				let lab = _.first(labsContainingBoost);
				if (lab) {
					creep.task = new TaskGetBoosted(lab);
				} else {
					log.info(`No labs containing ${boost} are in ${this.colony.name}!`);
				}
			}
		}
	}

	protected labsHaveBoosts(): boolean {
		for (let role in this.boosts) {
			if (this.boosts[role]) {
				let boosts = this.boosts[role]!;
				for (let boost of boosts) {
					if (_.filter(this.colony.labs, lab => lab.getMineralType() == boost &&
														  lab.mineralAmount > 0).length == 0) {
						return false;
					}
				}
			}
		}
		return true;
	}

	protected requestBoost(resourceType: _ResourceConstantSansEnergy): void {
		if (this.colony.terminal) {
			Overmind.terminalNetwork.requestResource(resourceType, this.colony.terminal);
		}
	}

	abstract init(): void;

	abstract run(): void;

	visuals(): void {

	}

}
