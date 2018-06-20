// Overseer: coordinates creep actions and spawn requests related to a common objective

import {CreepSetup} from './CreepSetup';
import {profile} from '../profiler/decorator';
import {Pathing} from '../movement/Pathing';
import {Colony} from '../Colony';
import {Zerg} from '../Zerg';
import {Tasks} from '../tasks/Tasks';
import {boostParts} from '../resources/map_resources';
import {MIN_LIFETIME_FOR_BOOST} from '../tasks/instances/getBoosted';
import {log} from '../console/log';

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
	// memory: OverlordMemory;
	boosts: { [roleName: string]: _ResourceConstantSansEnergy[] | undefined };

	constructor(initializer: IOverlordInitializer, name: string, priority: number) {
		// this.initMemory(initializer);
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

	/* Refreshes portions of the overlord state */
	rebuild(): void {
		this.recalculateCreeps();
		this.creepUsageReport = _.mapValues(this._creeps, creep => undefined);
	}

	recalculateCreeps(): void {
		this._creeps = _.mapValues(Overmind.cache.overlords[this.ref],
								   creepsOfRole => _.map(creepsOfRole, creepName => Game.zerg[creepName]));
	}

	debug(creep: Zerg, targetCreepName: string, ...args: any[]) {
		if (creep.name == targetCreepName) {
			console.log(JSON.stringify(args));
		}
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
		this.recalculateCreeps();
	}

	protected creeps(role: string): Zerg[] {
		if (this._creeps[role]) {
			return this._creeps[role];
		} else {
			return [];
		}
	}

	protected allCreeps(): Zerg[] {
		let allCreeps: Zerg[] = [];
		for (let role of _.keys(this._creeps)) {
			allCreeps = allCreeps.concat(this._creeps[role]);
		}
		return _.compact(allCreeps);
	}

	protected creepReport(role: string, currentAmt: number, neededAmt: number) {
		this.creepUsageReport[role] = [currentAmt, neededAmt];
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
			overlord: this.ref,									// name of the Overlord running this creep
			role    : setup.role,								// role of the creep
			task    : null, 									// task the creep is performing
			data    : { 										// rarely-changed data about the creep
				origin: '',										// where it was spawned, filled in at spawn time
			},
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
		// TODO: account for creeps that can be spawned at incubatee's hatchery
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

	parkCreepsIfIdle(creeps: Zerg[], outsideHatchery = true) {
		for (let creep of creeps) {
			if (!creep) {
				console.log(`creeps: ${_.map(creeps, creep => creep.name)}`);
				continue;
			}
			if (creep.isIdle && creep.canExecute('move')) {
				if (this.colony.hatchery) {
					let hatcheryRestrictedRange = 6;
					if (creep.pos.getRangeTo(this.colony.hatchery.pos) < hatcheryRestrictedRange) {
						let hatcheryBorder = this.colony.hatchery.pos.getPositionsAtRange(hatcheryRestrictedRange);
						let moveToPos = creep.pos.findClosestByRange(hatcheryBorder);
						creep.goTo(moveToPos);
					} else {
						creep.park();
					}
				} else {
					creep.park();
				}
			}
		}
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

	shouldBoost(creep: Zerg): boolean {
		if (!this.colony.evolutionChamber ||
			(creep.ticksToLive && creep.ticksToLive < MIN_LIFETIME_FOR_BOOST * creep.lifetime)) {
			return false;
		}
		if (this.boosts[creep.roleName]) {
			let boosts = _.filter(this.boosts[creep.roleName]!,
								  boost => (creep.boostCounts[boost] || 0)
										   < creep.getActiveBodyparts(boostParts[boost]));
			if (boosts.length > 0) {
				return _.all(boosts, boost => this.colony.evolutionChamber!.canBoost(creep, boost));
			}
		}
		return false;
	}

	/* Request a boost from the evolution chamber; should be called during init() */
	protected requestBoostsForCreep(creep: Zerg): void {
		if (this.colony.evolutionChamber && this.boosts[creep.roleName]) {
			let boost = _.find(this.boosts[creep.roleName]!,
							   boost => (creep.boostCounts[boost] || 0) < creep.getActiveBodyparts(boostParts[boost]));
			if (boost) {
				this.colony.evolutionChamber.requestBoost(boost, creep);
			}
		}
	}

	/* Handle boosting of a creep; should be called during run() */
	protected handleBoosting(creep: Zerg): void {
		if (this.colony.evolutionChamber && this.boosts[creep.roleName]) {
			let boost = _.find(this.boosts[creep.roleName]!,
							   boost => (creep.boostCounts[boost] || 0) < creep.getActiveBodyparts(boostParts[boost]));
			if (boost) {
				if (this.colony.evolutionChamber.queuePosition(creep) == 0) {
					log.info(`${this.colony.room.print}: boosting ${creep.name}@${creep.pos.print} with ${boost}!`);
					creep.task = Tasks.getBoosted(this.colony.evolutionChamber.boostingLab, boost);
				} else {
					// Approach the lab but don't attempt to get boosted
					if (creep.pos.getRangeTo(this.colony.evolutionChamber.boostingLab) > 2) {
						creep.goTo(this.colony.evolutionChamber.boostingLab, {range: 2});
					} else {
						creep.park();
					}
				}
			}
		}
	}

	/* Request any needed boosts from terminal network; should be called during init() */
	protected requestBoosts(): void {
		for (let creep of this.allCreeps()) {
			if (this.shouldBoost(creep)) {
				this.requestBoostsForCreep(creep);
			}
		}
	}

	abstract init(): void;

	abstract run(): void;

	visuals(): void {

	}

}
