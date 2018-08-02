// Overseer: coordinates creep actions and spawn requests related to a common objective

import {CreepSetup} from './CreepSetup';
import {profile} from '../profiler/decorator';
import {Colony} from '../Colony';
import {Zerg} from '../zerg/Zerg';
import {Tasks} from '../tasks/Tasks';
import {boostParts} from '../resources/map_resources';
import {MIN_LIFETIME_FOR_BOOST} from '../tasks/instances/getBoosted';
import {log} from '../console/log';
import {SpawnRequest, SpawnRequestOptions} from '../hiveClusters/hatchery';
import {SpawnGroup} from '../logistics/SpawnGroup';
import {CombatZerg} from '../zerg/CombatZerg';
import {Pathing} from '../movement/Pathing';

export function getOverlord(creep: Zerg | Creep): Overlord | null {
	if (creep.memory.overlord) {
		return Overmind.overlords[creep.memory.overlord] || null;
	} else {
		return null;
	}
}

export function setOverlord(creep: Zerg | Creep, newOverlord: Overlord | null) {
	// Remove cache references to old assignments
	let roleName = creep.memory.role;
	let ref = creep.memory.overlord;
	let oldOverlord: Overlord | null = ref ? Overmind.overlords[ref] : null;
	if (ref && Overmind.cache.overlords[ref] && Overmind.cache.overlords[ref][roleName]) {
		_.remove(Overmind.cache.overlords[ref][roleName], name => name == creep.name);
	}
	if (newOverlord) {
		// Change to the new overlord's colony
		creep.memory.colony = newOverlord.colony.name;
		// Change assignments in memory
		creep.memory.overlord = newOverlord.ref;
		// Update the cache references
		if (!Overmind.cache.overlords[newOverlord.ref]) {
			Overmind.cache.overlords[newOverlord.ref] = {};
		}
		if (!Overmind.cache.overlords[newOverlord.ref][roleName]) {
			Overmind.cache.overlords[newOverlord.ref][roleName] = [];
		}
		Overmind.cache.overlords[newOverlord.ref][roleName].push(creep.name);
	} else {
		creep.memory.overlord = null;
	}
	if (oldOverlord) oldOverlord.recalculateCreeps();
	if (newOverlord) newOverlord.recalculateCreeps();
}


const DEFAULT_PRESPAWN = 50;

export interface OverlordInitializer {
	ref: string;
	room: Room | undefined;
	pos: RoomPosition;
	colony: Colony;
	memory: any;
}

export interface CreepRequestOptions {
	prespawn?: number;
	priority?: number;
	partners?: CreepSetup[];
	options?: SpawnRequestOptions;
}

@profile
export abstract class Overlord {

	room: Room | undefined;
	// name: string;
	priority: number;
	ref: string;
	pos: RoomPosition;
	colony: Colony;
	spawnGroup: SpawnGroup | undefined;
	protected _creeps: { [roleName: string]: Creep[] };
	creepUsageReport: { [role: string]: [number, number] | undefined };
	// memory: OverlordMemory;
	boosts: { [roleName: string]: _ResourceConstantSansEnergy[] | undefined };

	constructor(initializer: OverlordInitializer, name: string, priority: number) {
		// this.initMemory(initializer);
		// this.name = name;
		this.room = initializer.room;
		this.priority = priority;
		this.ref = initializer.ref + '>' + name;
		this.pos = initializer.pos;
		this.colony = initializer.colony;
		this.spawnGroup = undefined;
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
								   creepsOfRole => _.map(creepsOfRole, creepName => Game.creeps[creepName]));
	}

	/* Gets the "ID" of the outpost this overlord is operating in. 0 for owned rooms, >= 1 for outposts, -1 for other */
	get outpostIndex(): number {
		return _.findIndex(this.colony.roomNames, this.pos.roomName);
	}

	protected reassignIdleCreeps(role: string): void {
		// Find all creeps without an overlord
		let idleCreeps = _.filter(this.colony.getCreepsByRole(role), creep => !getOverlord(creep));
		// Reassign them all to this flag
		for (let creep of idleCreeps) {
			setOverlord(creep, this);
		}
	}

	/* Returns all creeps of a specified role */
	protected creeps(role: string): Creep[] {
		if (this._creeps[role]) {
			return this._creeps[role];
		} else {
			return [];
		}
	}

	/* Default wrapping behavior -- maps all creeps to a base-level zerg */
	protected zerg(role: string): Zerg[] {
		return _.map(this.creeps(role), creep => new Zerg(creep));
	}

	/* Default wrapping behavior -- maps all creeps to a base-level zerg */
	protected combatZerg(role: string): CombatZerg[] {
		return _.map(this.creeps(role), creep => new CombatZerg(creep));
	}

	// protected allCreeps(): Creep[] {
	// 	let allCreeps: Zerg[] = [];
	// 	for (let role of _.keys(this._creeps)) {
	// 		allCreeps = allCreeps.concat(this._creeps[role]);
	// 	}
	// 	return _.compact(allCreeps);
	// }

	protected creepReport(role: string, currentAmt: number, neededAmt: number) {
		this.creepUsageReport[role] = [currentAmt, neededAmt];
	}

	// TODO: include creep move speed
	lifetimeFilter(creeps: (Creep | Zerg)[], prespawn = DEFAULT_PRESPAWN): (Creep | Zerg)[] {
		let spawnDistance = 0;
		// TODO: account for creeps that can be spawned at incubatee's hatchery
		// if (this.colony.incubator) {
		// 	spawnDistance = Pathing.distance(this.pos, this.colony.incubator.hatchery!.pos) || 0;
		// } else
		if (this.spawnGroup) {
			let distances = _.take(_.sortBy(this.spawnGroup.memory.distances), 2);
			spawnDistance = _.sum(distances) / distances.length || 0;
		} else if (this.colony.hatchery) {
			// Use distance or 0 (in case distance returns something undefined due to incomplete pathfinding)
			spawnDistance = Pathing.distance(this.pos, this.colony.hatchery.pos) || 0;
		}
		if (this.colony.isIncubating && this.colony.spawnGroup) {
			spawnDistance += this.colony.spawnGroup.stats.avgDistance;
		}
		// The last condition fixes a bug only present on private servers that took me a fucking week to isolate.
		// At the tick of birth, creep.spawning = false and creep.ticksTolive = undefined
		// See: https://screeps.com/forum/topic/443/creep-spawning-is-not-updated-correctly-after-spawn-process
		return _.filter(creeps, creep =>
			creep.ticksToLive! > CREEP_SPAWN_TIME * creep.body.length + spawnDistance + prespawn ||
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
						if (moveToPos) creep.goTo(moveToPos);
					} else {
						creep.park();
					}
				} else {
					creep.park();
				}
			}
		}
	}

	/* Requests a group of (2-3) creeps from a hatchery to be spawned at the same time. Using this with low-priority
	 * operations can result in a long time */
	protected requestSquad(setups: CreepSetup[], opts = {} as CreepRequestOptions) {
		log.warning(`Overlord.requestSquad() is not finished yet!`); // TODO: finish
		_.defaults(opts, {priority: this.priority, prespawn: DEFAULT_PRESPAWN});
		let spawner = this.spawnGroup || this.colony.spawnGroup || this.colony.hatchery;
		if (spawner) {
			if (setups.length > 3) {
				log.warning(`Requesting squads of >3 is not advisable`);
			}
			let request: SpawnRequest = {
				setup   : _.head(setups),
				overlord: this,
				priority: opts.priority!,
				partners: _.tail(setups),
			};
			if (opts.options) {
				request.options = opts.options;
			}
			spawner.enqueue(request);
		} else {
			if (Game.time % 25 == 0) {
				log.warning(`Overlord ${this.ref} @ ${this.pos.print}: no spawner object!`);
			}
		}
	}

	/* Create a creep setup and enqueue it to the Hatchery; does not include automatic reporting */
	protected requestCreep(setup: CreepSetup, opts = {} as CreepRequestOptions) {
		_.defaults(opts, {priority: this.priority, prespawn: DEFAULT_PRESPAWN});
		let spawner = this.spawnGroup || this.colony.spawnGroup || this.colony.hatchery;
		if (spawner) {
			let request: SpawnRequest = {
				setup   : setup,
				overlord: this,
				priority: opts.priority!,
			};
			if (opts.partners) {
				request.partners = opts.partners;
			}
			if (opts.options) {
				request.options = opts.options;
			}
			spawner.enqueue(request);
		} else {
			if (Game.time % 25 == 0) {
				log.warning(`Overlord ${this.ref} @ ${this.pos.print}: no spawner object!`);
			}
		}
	}

	/* Wishlist of creeps to simplify spawning logic; includes automatic reporting */
	protected wishlist(quantity: number, setup: CreepSetup, opts = {} as CreepRequestOptions) {
		_.defaults(opts, {priority: this.priority, prespawn: DEFAULT_PRESPAWN});
		let creepQuantity = this.lifetimeFilter(this.creeps(setup.role), opts.prespawn).length;
		if (creepQuantity < quantity) {
			this.requestCreep(setup, opts);
		}
		this.creepReport(setup.role, creepQuantity, quantity);
	}

	shouldBoost(creep: Zerg): boolean {
		// Can't boost if there's no evolution chamber or TTL is less than 90%
		if (!this.colony.evolutionChamber ||
			(creep.ticksToLive && creep.ticksToLive < MIN_LIFETIME_FOR_BOOST * creep.lifetime)) {
			return false;
		}
		// // If you're in a bunker layout at level 8 with max labs, only boost while spawning
		// if (this.colony.bunker && this.colony.level == 8 && this.colony.labs.length == 10) {
		// 	if (!creep.spawning) {
		// 		return false;
		// 	}
		// }
		// Otherwise just boost if you need it and can get the resources
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

	private getBoostLabFor(creep: Zerg): StructureLab | undefined {
		if (!creep.memory.boostLab) {
			let closestLab = creep.pos.findClosestByRange(this.colony.labs);
			if (closestLab) {
				creep.memory.boostLab = closestLab.id;
				return closestLab;
			} else {
				log.warning(`No boosting lab available for ${creep.name}!`);
			}
		} else {
			return Game.getObjectById(creep.memory.boostLab) as StructureLab | undefined;
		}
	}

	/* Request a boost from the evolution chamber; should be called during init() */
	protected requestBoostsForCreep(creep: Zerg): void {
		if (this.colony.evolutionChamber && this.boosts[creep.roleName]) {
			let boost = _.find(this.boosts[creep.roleName]!,
							   boost => (creep.boostCounts[boost] || 0) < creep.getActiveBodyparts(boostParts[boost]));
			if (boost) {
				let boostLab = this.getBoostLabFor(creep);
				if (boostLab) {
					this.colony.evolutionChamber.requestBoost(boost, creep, boostLab);
				}
			}
		}
	}

	/* Handle boosting of a creep; should be called during run() */
	protected handleBoosting(creep: Zerg): void {
		if (this.colony.evolutionChamber && this.boosts[creep.roleName]) {
			let boost = _.find(this.boosts[creep.roleName]!,
							   boost => (creep.boostCounts[boost] || 0) < creep.getActiveBodyparts(boostParts[boost]));
			if (boost) {
				let boostLab = this.getBoostLabFor(creep);
				if (boostLab) {
					if (this.colony.evolutionChamber.queuePosition(creep, boostLab) == 0) {
						log.info(`${this.colony.room.print}: boosting ${creep.name}@${creep.pos.print} with ${boost}!`);
						creep.task = Tasks.getBoosted(boostLab, boost);
					} else {
						// Approach the lab but don't attempt to get boosted
						if (creep.pos.getRangeTo(boostLab) > 2) {
							creep.goTo(boostLab, {range: 2});
						} else {
							creep.park();
						}
					}
				}
			}
		}
	}

	/* Request any needed boosts from terminal network; should be called during init() */
	protected requestBoosts(creeps: Zerg[]): void {
		for (let creep of creeps) {
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
