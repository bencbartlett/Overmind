import {Colony} from '../Colony';
import {log} from '../console/log';
import {CreepSetup} from '../creepSetups/CreepSetup';
import {SpawnRequest, SpawnRequestOptions} from '../hiveClusters/hatchery';
import {SpawnGroup} from '../logistics/SpawnGroup';
import {Pathing} from '../movement/Pathing';
import {profile} from '../profiler/decorator';
import {boostParts} from '../resources/map_resources';
import {MIN_LIFETIME_FOR_BOOST} from '../tasks/instances/getBoosted';
import {Tasks} from '../tasks/Tasks';
import {CombatZerg} from '../zerg/CombatZerg';
import {Zerg} from '../zerg/Zerg';

export interface OverlordInitializer {
	ref: string;
	room: Room | undefined;
	pos: RoomPosition;
	colony: Colony;
	memory: any;
	waypoints?: RoomPosition[];
}

export function hasColony(initializer: OverlordInitializer | Colony): initializer is OverlordInitializer {
	return (<OverlordInitializer>initializer).colony != undefined;
}

export const DEFAULT_PRESPAWN = 50;
export const MAX_SPAWN_REQUESTS = 100; // this stops division by zero or related errors from sending infinite requests

export interface CreepRequestOptions {
	reassignIdle?: boolean;
	noLifetimeFilter?: boolean;
	prespawn?: number;
	priority?: number;
	partners?: CreepSetup[];
	options?: SpawnRequestOptions;
}

export interface ZergOptions {
	notifyWhenAttacked?: boolean;
	boostWishlist?: _ResourceConstantSansEnergy[] | undefined;
}

export interface OverlordMemory {
	suspendUntil?: number;
}

const OverlordMemoryDefaults: OverlordMemory = {};

/**
 * An Overlord is roughly analogous to a process in an OS: it is a generalization of a set of related things that need
 * to be done in a colony, like mining from a site, bootstrapping a new colony, guarding against invaders, or building
 * construction sites. Overlords handle spawning or obtaining suitable creeps to do these things and contain the actual
 * implementation of doing them.
 */
@profile
export abstract class Overlord {

	protected initializer: OverlordInitializer | Colony;
	// memory: OverlordMemory;
	room: Room | undefined;
	priority: number; 			// priority can be changed in constructor phase but not after
	name: string;
	ref: string;
	pos: RoomPosition;
	colony: Colony;
	spawnGroup: SpawnGroup | undefined;
	private _creeps: { [roleName: string]: Creep[] };
	private _zerg: { [roleName: string]: Zerg[] };
	private _combatZerg: { [roleName: string]: CombatZerg[] };
	private boosts: { [roleName: string]: _ResourceConstantSansEnergy[] | undefined };
	creepUsageReport: { [roleName: string]: [number, number] | undefined };

	constructor(initializer: OverlordInitializer | Colony, name: string, priority: number) {
		this.initializer = initializer;
		// this.memory = Mem.wrap(initializer.memory, name, OverlordMemoryDefaults);
		this.room = initializer.room;
		this.priority = priority;
		this.name = name;
		this.ref = initializer.ref + '>' + name;
		this.pos = initializer.pos;
		this.colony = hasColony(initializer) ? initializer.colony : initializer;
		this.spawnGroup = undefined;
		this._zerg = {};
		this._combatZerg = {};
		this.recalculateCreeps();
		this.creepUsageReport = _.mapValues(this._creeps, creep => undefined);
		this.boosts = _.mapValues(this._creeps, creep => undefined);
		// Register the overlord on the colony overseer and on the overmind
		Overmind.overlords[this.ref] = this;
		Overmind.overseer.registerOverlord(this);
	}

	get isSuspended(): boolean {
		return Overmind.overseer.isOverlordSuspended(this);
	}

	suspendFor(ticks: number) {
		return Overmind.overseer.suspendOverlordFor(this, ticks);
	}

	suspendUntil(untilTick: number) {
		return Overmind.overseer.suspendOverlordUntil(this, untilTick);
	}

	/**
	 * Refreshes overlord, recalculating creeps and refreshing existing Zerg. New creeps are automatically added,
	 * and the corresponding role groups (e.g. 'queens') are automatically updated. Child methods do not need to
	 * refresh their zerg properties, only other room objects stored on the Overlord.
	 */
	refresh(): void {
		// // Handle suspension // TODO: finish this
		// if (this.memory.suspendUntil) {
		// 	if (Game.time < this.memory.suspendUntil) {
		// 		return;
		// 	} else {
		// 		delete this.memory.suspendUntil;
		// 	}
		// }
		// Refresh room
		this.room = Game.rooms[this.pos.roomName];
		// Refresh zerg
		this.recalculateCreeps();
		for (const role in this._creeps) {
			for (const creep of this._creeps[role]) {
				if (Overmind.zerg[creep.name]) {
					// log.debug(`Refreshing creep ${creep.name}`)
					Overmind.zerg[creep.name].refresh();
				} else {
					log.warning(`${this.print}: could not find and refresh zerg with name ${creep.name}!`);
				}
			}
		}
	}

	get print(): string {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.pos.roomName + '">[' + this.ref + ']</a>';
	}

	recalculateCreeps(): void {
		// Recalculate the sets of creeps for each role in this overlord
		this._creeps = _.mapValues(Overmind.cache.overlords[this.ref],
								   creepsOfRole => _.map(creepsOfRole, creepName => Game.creeps[creepName]));
		// Update zerg and combatZerg records
		for (const role in this._zerg) {
			this.synchronizeZerg(role);
		}
		for (const role in this._combatZerg) {
			this.synchronizeCombatZerg(role);
		}
	}

	/**
	 * Wraps all creeps of a given role to Zerg objects and updates the contents in future ticks to avoid having to
	 * explicitly refresh groups of Zerg
	 */
	protected zerg(role: string, opts: ZergOptions = {}): Zerg[] {
		if (!this._zerg[role]) {
			this._zerg[role] = [];
			this.synchronizeZerg(role, opts.notifyWhenAttacked);
		}
		if (opts.boostWishlist) {
			this.boosts[role] = opts.boostWishlist;
		}
		return this._zerg[role];
	}

	private synchronizeZerg(role: string, notifyWhenAttacked?: boolean): void {
		// Synchronize the corresponding sets of Zerg
		const zergNames = _.zipObject(_.map(this._zerg[role] || [],
											zerg => [zerg.name, true])) as { [name: string]: boolean };
		const creepNames = _.zipObject(_.map(this._creeps[role] || [],
											 creep => [creep.name, true])) as { [name: string]: boolean };
		// Add new creeps which aren't in the _zerg record
		for (const creep of this._creeps[role] || []) {
			if (!zergNames[creep.name]) {
				this._zerg[role].push(Overmind.zerg[creep.name] || new Zerg(creep, notifyWhenAttacked));
			}
		}
		// Remove dead/reassigned creeps from the _zerg record
		for (const zerg of this._zerg[role]) {
			if (!creepNames[zerg.name]) {
				_.remove(this._zerg[role], z => z.name == zerg.name);
			}
		}
	}

	/**
	 * Wraps all creeps of a given role to CombatZerg objects and updates the contents in future ticks
	 */
	protected combatZerg(role: string, opts: ZergOptions = {}): CombatZerg[] {
		if (!this._combatZerg[role]) {
			this._combatZerg[role] = [];
			this.synchronizeCombatZerg(role, opts.notifyWhenAttacked);
		}
		if (opts.boostWishlist) {
			this.boosts[role] = opts.boostWishlist;
		}
		return this._combatZerg[role];
	}

	private synchronizeCombatZerg(role: string, notifyWhenAttacked?: boolean): void {
		// Synchronize the corresponding sets of CombatZerg
		const zergNames = _.zipObject(_.map(this._combatZerg[role] || [],
											zerg => [zerg.name, true])) as { [name: string]: boolean };
		const creepNames = _.zipObject(_.map(this._creeps[role] || [],
											 creep => [creep.name, true])) as { [name: string]: boolean };
		// Add new creeps which aren't in the _combatZerg record
		for (const creep of this._creeps[role] || []) {
			if (!zergNames[creep.name]) {
				if (Overmind.zerg[creep.name] && (<CombatZerg>Overmind.zerg[creep.name]).isCombatZerg) {
					this._combatZerg[role].push(Overmind.zerg[creep.name]);
				} else {
					this._combatZerg[role].push(new CombatZerg(creep, notifyWhenAttacked));
				}
			}
		}
		// Remove dead/reassigned creeps from the _combatZerg record
		for (const zerg of this._combatZerg[role]) {
			if (!creepNames[zerg.name]) {
				_.remove(this._combatZerg[role], z => z.name == zerg.name);
			}
		}
	}

	/* Gets the "ID" of the outpost this overlord is operating in. 0 for owned rooms, >= 1 for outposts, -1 for other */
	get outpostIndex(): number {
		return _.findIndex(this.colony.roomNames, roomName => roomName == this.pos.roomName);
	}

	protected reassignIdleCreeps(role: string): void {
		// Find all creeps without an overlord
		const idleCreeps = _.filter(this.colony.getCreepsByRole(role), creep => !getOverlord(creep));
		// Reassign them all to this flag
		for (const creep of idleCreeps) {
			setOverlord(creep, this);
		}
	}

	// /* Returns all creeps of a specified role */
	// protected creeps(role: string): Creep[] {
	// 	if (this._creeps[role]) {
	// 		return this._creeps[role];
	// 	} else {
	// 		return [];
	// 	}
	// }

	protected creepReport(role: string, currentAmt: number, neededAmt: number) {
		this.creepUsageReport[role] = [currentAmt, neededAmt];
	}

	// TODO: include creep move speed
	lifetimeFilter(creeps: (Creep | Zerg)[], prespawn = DEFAULT_PRESPAWN, spawnDistance?: number): (Creep | Zerg)[] {
		if (!spawnDistance) {
			spawnDistance = 0;
			if (this.spawnGroup) {
				const distances = _.take(_.sortBy(this.spawnGroup.memory.distances), 2);
				spawnDistance = (_.sum(distances) / distances.length) || 0;
			} else if (this.colony.hatchery) {
				// Use distance or 0 (in case distance returns something undefined due to incomplete pathfinding)
				spawnDistance = Pathing.distance(this.pos, this.colony.hatchery.pos) || 0;
			}
			if (this.colony.isIncubating && this.colony.spawnGroup) {
				spawnDistance += this.colony.spawnGroup.stats.avgDistance;
			}
		}

		/* The last condition fixes a bug only present on private servers that took me a fucking week to isolate.
		 * At the tick of birth, creep.spawning = false and creep.ticksTolive = undefined
		 * See: https://screeps.com/forum/topic/443/creep-spawning-is-not-updated-correctly-after-spawn-process */
		return _.filter(creeps, creep =>
			creep.ticksToLive! > CREEP_SPAWN_TIME * creep.body.length + spawnDistance! + prespawn ||
			creep.spawning || (!creep.spawning && !creep.ticksToLive));
	}

	parkCreepsIfIdle(creeps: Zerg[], outsideHatchery = true) {
		for (const creep of creeps) {
			if (!creep) {
				console.log(`creeps: ${_.map(creeps, creep => creep.name)}`);
				continue;
			}
			if (creep.isIdle && creep.canExecute('move')) {
				if (this.colony.hatchery) {
					const hatcheryRestrictedRange = 6;
					if (creep.pos.getRangeTo(this.colony.hatchery.pos) < hatcheryRestrictedRange) {
						const hatcheryBorder = this.colony.hatchery.pos.getPositionsAtRange(hatcheryRestrictedRange);
						const moveToPos = creep.pos.findClosestByRange(hatcheryBorder);
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

	/**
	 * Requests a group of (2-3) creeps from a hatchery to be spawned at the same time. Using this with low-priority
	 * operations can result in a long time
	 */
	protected requestSquad(setups: CreepSetup[], opts = {} as CreepRequestOptions) {
		log.warning(`Overlord.requestSquad() is not finished yet!`); // TODO: finish
		_.defaults(opts, {priority: this.priority, prespawn: DEFAULT_PRESPAWN});
		const spawner = this.spawnGroup || this.colony.spawnGroup || this.colony.hatchery;
		if (spawner) {
			if (setups.length > 3) {
				log.warning(`Requesting squads of >3 is not advisable`);
			}
			const request: SpawnRequest = {
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
			if (Game.time % 100 == 0) {
				log.warning(`Overlord ${this.ref} @ ${this.pos.print}: no spawner object!`);
			}
		}
	}

	/**
	 * Create a creep setup and enqueue it to the Hatchery; does not include automatic reporting
	 */
	protected requestCreep(setup: CreepSetup, opts = {} as CreepRequestOptions) {
		_.defaults(opts, {priority: this.priority, prespawn: DEFAULT_PRESPAWN});
		const spawner = this.spawnGroup || this.colony.spawnGroup || this.colony.hatchery;
		if (spawner) {
			const request: SpawnRequest = {
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
			if (Game.time % 100 == 0) {
				log.warning(`Overlord ${this.ref} @ ${this.pos.print}: no spawner object!`);
			}
		}
	}

	/**
	 * Wishlist of creeps to simplify spawning logic; includes automatic reporting
	 */
	protected wishlist(quantity: number, setup: CreepSetup, opts = {} as CreepRequestOptions) {
		_.defaults(opts, {priority: this.priority, prespawn: DEFAULT_PRESPAWN, reassignIdle: false});
		let creepQuantity: number;
		if (opts.noLifetimeFilter) {
			creepQuantity = (this._creeps[setup.role] || []).length;
		} else if (_.has(this.initializer, 'waypoints')) {
			// TODO: replace hardcoded distance with distance computed through portals
			creepQuantity = this.lifetimeFilter(this._creeps[setup.role] || [], opts.prespawn, 500).length;
		} else {
			creepQuantity = this.lifetimeFilter(this._creeps[setup.role] || [], opts.prespawn).length;
		}
		let spawnQuantity = quantity - creepQuantity;
		if (opts.reassignIdle && spawnQuantity > 0) {
			const idleCreeps = _.filter(this.colony.getCreepsByRole(setup.role), creep => !getOverlord(creep));
			for (let i = 0; i < Math.min(idleCreeps.length, spawnQuantity); i++) {
				setOverlord(idleCreeps[i], this);
				spawnQuantity--;
			}
		}
		// A bug in outpostDefenseOverlord caused infinite requests and cost me two botarena rounds before I found it...
		if (spawnQuantity > MAX_SPAWN_REQUESTS) {
			log.warning(`Too many requests for ${setup.role}s submitted by ${this.print}! (Check for errors.)`);
		} else {
			for (let i = 0; i < spawnQuantity; i++) {
				this.requestCreep(setup, opts);
			}
		}
		this.creepReport(setup.role, creepQuantity, quantity);
	}

	// TODO: finish this; currently requires host colony to have evolution chamber
	canBoostSetup(setup: CreepSetup): boolean {
		if (this.colony.evolutionChamber && this.boosts[setup.role] && this.boosts[setup.role]!.length > 0) {
			let energyCapacityAvailable: number;
			if (this.spawnGroup) {
				energyCapacityAvailable = this.spawnGroup.energyCapacityAvailable;
			} else if (this.colony.spawnGroup) {
				energyCapacityAvailable = this.colony.spawnGroup.energyCapacityAvailable;
			} else if (this.colony.hatchery) {
				energyCapacityAvailable = this.colony.hatchery.room.energyCapacityAvailable;
			} else {
				return false;
			}
			const body = _.map(setup.generateBody(energyCapacityAvailable), part => ({type: part, hits: 100}));
			if (body.length == 0) return false;
			return _.all(this.boosts[setup.role]!,
						 boost => this.colony.evolutionChamber!.canBoost(body, boost));
		}
		return false;
	}

	/**
	 * Return whether you are capable of boosting a creep to the desired specifications
	 */
	shouldBoost(creep: Zerg, onlyBoostInSpawn = false): boolean {
		// Can't boost if there's no evolution chamber or TTL is less than threshold
		const colony = Overmind.colonies[creep.room.name] as Colony | undefined;
		const evolutionChamber = colony ? colony.evolutionChamber : undefined;
		if (!evolutionChamber ||
			(creep.ticksToLive && creep.ticksToLive < MIN_LIFETIME_FOR_BOOST * creep.lifetime)) {
			return false;
		}

		// EDIT: they removed in-spawn boosting... RIP :(
		// // If you're in a bunker layout at level 8 with max labs, only boost while spawning
		// if (onlyBoostInSpawn && this.colony.bunker && this.colony.level == 8 && this.colony.labs.length == 10) {
		// 	if (!creep.spawning) {
		// 		return false;
		// 	}
		// }

		// Otherwise just boost if you need it and can get the resources
		if (this.boosts[creep.roleName]) {
			const boosts = _.filter(this.boosts[creep.roleName]!, boost =>
				(creep.boostCounts[boost] || 0) < creep.getActiveBodyparts(boostParts[boost]));
			if (boosts.length > 0) {
				return _.all(boosts, boost => evolutionChamber!.canBoost(creep.body, boost));
			}
		}
		return false;
	}


	/**
	 * Request a boost from the evolution chamber; should be called during init()
	 */
	private requestBoostsForCreep(creep: Zerg): void {
		const colony = Overmind.colonies[creep.room.name] as Colony | undefined;
		const evolutionChamber = colony ? colony.evolutionChamber : undefined;
		if (evolutionChamber && this.boosts[creep.roleName]) {
			const boosts = _.filter(this.boosts[creep.roleName]!, boost =>
				(creep.boostCounts[boost] || 0) < creep.getActiveBodyparts(boostParts[boost]));
			for (const boost of boosts) {
				evolutionChamber.requestBoost(creep, boost);
			}
		}
	}

	/**
	 * Handle boosting of a creep; should be called during run()
	 */
	protected handleBoosting(creep: Zerg): void {
		const colony = Overmind.colonies[creep.room.name] as Colony | undefined;
		const evolutionChamber = colony ? colony.evolutionChamber : undefined;

		if (this.boosts[creep.roleName] && evolutionChamber) {
			const boosts = _.filter(this.boosts[creep.roleName]!, boost =>
				(creep.boostCounts[boost] || 0) < creep.getActiveBodyparts(boostParts[boost]));
			for (const boost of boosts) {
				const boostLab = _.find(evolutionChamber.boostingLabs, lab => lab.mineralType == boost);
				if (boostLab) {
					creep.task = Tasks.getBoosted(boostLab, boost);
				}
			}
		}
	}

	/**
	 * Request any needed boosting resources from terminal network
	 */
	private requestBoosts(creeps: Zerg[]): void {
		for (const creep of creeps) {
			if (this.shouldBoost(creep)) {
				this.requestBoostsForCreep(creep);
			}
		}
	}

	/**
	 * Requests that should be handled for all overlords prior to the init() phase
	 */
	preInit(): void {
		// Handle resource requests for boosts
		for (const role in this.boosts) {
			if (this.boosts[role] && this._creeps[role]) {
				this.requestBoosts(_.compact(_.map(this._creeps[role], creep => Overmind.zerg[creep.name])));
			}
		}
	}

	abstract init(): void;

	abstract run(): void;

	/**
	 * Standard sequence of actions for running task-based creeps
	 */
	autoRun(roleCreeps: Zerg[], taskHandler: (creep: Zerg) => void, fleeCallback?: (creep: Zerg) => boolean) {
		for (const creep of roleCreeps) {
			if (!!fleeCallback) {
				if (fleeCallback(creep)) continue;
			}
			if (creep.isIdle) {
				if (this.shouldBoost(creep)) {
					this.handleBoosting(creep);
				} else {
					taskHandler(creep);
				}
			}
			creep.run();
		}
	}

	visuals(): void {

	}

}

export function getOverlord(creep: Zerg | Creep): Overlord | null {
	if (creep.memory[_MEM.OVERLORD]) {
		return Overmind.overlords[creep.memory[_MEM.OVERLORD]!] || null;
	} else {
		return null;
	}
}

export function setOverlord(creep: Zerg | Creep, newOverlord: Overlord | null) {
	// Remove cache references to old assignments
	const roleName = creep.memory.role;
	const ref = creep.memory[_MEM.OVERLORD];
	const oldOverlord: Overlord | null = ref ? Overmind.overlords[ref] : null;
	if (ref && Overmind.cache.overlords[ref] && Overmind.cache.overlords[ref][roleName]) {
		_.remove(Overmind.cache.overlords[ref][roleName], name => name == creep.name);
	}
	if (newOverlord) {
		// Change to the new overlord's colony
		creep.memory[_MEM.COLONY] = newOverlord.colony.name;
		// Change assignments in memory
		creep.memory[_MEM.OVERLORD] = newOverlord.ref;
		// Update the cache references
		if (!Overmind.cache.overlords[newOverlord.ref]) {
			Overmind.cache.overlords[newOverlord.ref] = {};
		}
		if (!Overmind.cache.overlords[newOverlord.ref][roleName]) {
			Overmind.cache.overlords[newOverlord.ref][roleName] = [];
		}
		Overmind.cache.overlords[newOverlord.ref][roleName].push(creep.name);
	} else {
		creep.memory[_MEM.OVERLORD] = null;
	}
	if (oldOverlord) oldOverlord.recalculateCreeps();
	if (newOverlord) newOverlord.recalculateCreeps();
	log.info(`${creep.name} has been reassigned from ${oldOverlord ? oldOverlord.print : 'IDLE'} ` +
			 `to ${newOverlord ? newOverlord.print : 'IDLE'}`);
}
