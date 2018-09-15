import {profile} from '../profiler/decorator';
import {Colony} from '../Colony';
import {Overlord} from '../overlords/Overlord';
import {initializeTask} from '../tasks/initializer';
import {Task} from '../tasks/Task';
import {Movement, MoveOptions} from '../movement/Movement';
import {isCreep, isZerg} from '../declarations/typeGuards';
import {CombatIntel} from '../intel/CombatIntel';
import {log} from '../console/log';
import {NEW_OVERMIND_INTERVAL} from '../~settings';

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

export function normalizeZerg(creep: Zerg | Creep): Zerg | Creep {
	return Overmind.zerg[creep.name] || creep;
}

export function toCreep(creep: Zerg | Creep): Creep {
	return isZerg(creep) ? creep.creep : creep;
}

// Last pipeline is more complex because it depends on the energy a creep has; sidelining this for now
const actionPipelines: string[][] = [
	['harvest', 'attack', 'build', 'repair', 'dismantle', 'attackController', 'rangedHeal', 'heal'],
	['rangedAttack', 'rangedMassAttack', 'build', 'repair', 'rangedHeal'],
	// ['upgradeController', 'build', 'repair', 'withdraw', 'transfer', 'drop'],
];

interface ParkingOptions {
	range: number;
	exactRange: boolean;
	offroad: boolean;
}

interface FleeOptions {
	dropEnergy?: boolean;
	invalidateTask?: boolean;
}

const RANGES = {
	BUILD   : 3,
	REPAIR  : 3,
	TRANSFER: 1,
	WITHDRAW: 1,
	HARVEST : 1,
	DROP    : 0,
};

@profile
export class Zerg {

	creep: Creep; 						// The creep that this wrapper class will control
	body: BodyPartDefinition[];    	 	// These properties are all wrapped from this.creep.* to this.*
	carry: StoreDefinition;				// |
	carryCapacity: number;				// |
	fatigue: number;					// |
	hits: number;						// |
	hitsMax: number;					// |
	id: string;							// |
	memory: CreepMemory;				// | See the ICreepMemory interface for structure
	// my: boolean;						// |
	name: string;						// |
	// owner: Owner; 						// |
	pos: RoomPosition;					// |
	ref: string;						// |
	roleName: string;					// |
	room: Room;							// |
	saying: string;						// |
	spawning: boolean;					// |
	ticksToLive: number | undefined;	// |
	lifetime: number;
	actionLog: { [actionName: string]: boolean }; // Tracks the actions that a creep has completed this tick
	blockMovement: boolean; 			// Whether the zerg is allowed to move or not
	// settings: any;					// Adjustable settings object, can vary across roles
	private _task: Task | null; 		// Cached Task object that is instantiated once per tick and on change

	constructor(creep: Creep, notifyWhenAttacked = true) {
		this.creep = creep;
		this.body = creep.body;
		this.carry = creep.carry;
		this.carryCapacity = creep.carryCapacity;
		this.fatigue = creep.fatigue;
		this.hits = creep.hits;
		this.hitsMax = creep.hitsMax;
		this.id = creep.id;
		this.memory = creep.memory;
		this.name = creep.name;
		this.pos = creep.pos;
		this.ref = creep.ref;
		this.roleName = creep.memory.role;
		this.room = creep.room;
		this.saying = creep.saying;
		this.spawning = creep.spawning;
		this.ticksToLive = creep.ticksToLive;
		this.lifetime = this.getBodyparts(CLAIM) > 0 ? CREEP_CLAIM_LIFE_TIME : CREEP_LIFE_TIME;
		this.actionLog = {};
		this.blockMovement = false;
		// this.settings = {};
		Overmind.zerg[this.name] = this; // register global reference
		global[this.name] = this;
		// Handle attack notification when at lifetime - 1
		if (!notifyWhenAttacked && (this.ticksToLive || 0) >= this.lifetime - (NEW_OVERMIND_INTERVAL + 1)) {
			// creep.notifyWhenAttacked only uses the 0.2CPU intent cost if it changes the intent value
			this.notifyWhenAttacked(notifyWhenAttacked);
		}
	}

	/* Refresh all changeable properties of the creep or delete from Overmind and global when dead */
	refresh(): void {
		const creep = Game.creeps[this.name];
		if (creep) {
			this.creep = creep;
			this.pos = creep.pos;
			this.body = creep.body;
			this.carry = creep.carry;
			this.carryCapacity = creep.carryCapacity;
			this.fatigue = creep.fatigue;
			this.hits = creep.hits;
			this.memory = creep.memory;
			this.roleName = creep.memory.role;
			this.room = creep.room;
			this.saying = creep.saying;
			this.spawning = creep.spawning;
			this.ticksToLive = creep.ticksToLive;
			this.actionLog = {};
			this.blockMovement = false;
			this._task = null; // todo
		} else {
			log.debug(`Deleting from global`);
			delete Overmind.zerg[this.name];
			delete global[this.name];
		}
	}

	debug(...args: any[]) {
		if (this.memory.debug) {
			log.debug(this.print, args);
		}
	}

	get ticksUntilSpawned(): number | undefined {
		if (this.spawning) {
			let spawner = this.pos.lookForStructure(STRUCTURE_SPAWN) as StructureSpawn;
			if (spawner && spawner.spawning) {
				return spawner.spawning.remainingTime;
			} else {
				// Shouldn't ever get here
				console.log(`Error determining ticks to spawn for ${this.name} @ ${this.pos.print}!`);
			}
		}
	}

	get print(): string {
		return '<a href="#!/room/' + Game.shard.name + '/' + this.pos.roomName + '">[' + this.name + ']</a>';
	}

	// Wrapped creep methods ===========================================================================================

	attack(target: Creep | Structure) {
		let result = this.creep.attack(target);
		if (result == OK) {
			this.actionLog.attack = true;
			if (isCreep(target)) {
				if (target.hitsPredicted == undefined) target.hitsPredicted = target.hits;
				target.hitsPredicted -= CombatIntel.predictedDamageAmount(this.creep, target, 'attack');
			}
		}
		return result;
	}

	attackController(controller: StructureController) {
		let result = this.creep.attackController(controller);
		if (!this.actionLog.attackController) this.actionLog.attackController = (result == OK);
		return result;
	}

	build(target: ConstructionSite) {
		let result = this.creep.build(target);
		if (!this.actionLog.build) this.actionLog.build = (result == OK);
		return result;
	}

	goBuild(target: ConstructionSite) {
		if (this.pos.inRangeToPos(target.pos, RANGES.BUILD)) {
			return this.build(target);
		} else {
			return this.goTo(target);
		}
	}

	cancelOrder(methodName: string): OK | ERR_NOT_FOUND {
		let result = this.creep.cancelOrder(methodName);
		if (result == OK) this.actionLog[methodName] = false;
		return result;
	}

	claimController(controller: StructureController) {
		let result = this.creep.claimController(controller);
		if (!this.actionLog.claimController) this.actionLog.claimController = (result == OK);
		return result;
	}

	dismantle(target: Structure): CreepActionReturnCode {
		let result = this.creep.dismantle(target);
		if (!this.actionLog.dismantle) this.actionLog.dismantle = (result == OK);
		return result;
	}

	drop(resourceType: ResourceConstant, amount?: number) {
		let result = this.creep.drop(resourceType, amount);
		if (!this.actionLog.drop) this.actionLog.drop = (result == OK);
		return result;
	}

	goDrop(pos: RoomPosition, resourceType: ResourceConstant, amount?: number) {
		if (this.pos.inRangeToPos(pos, RANGES.DROP)) {
			return this.drop(resourceType, amount);
		} else {
			return this.goTo(pos);
		}
	}

	generateSafeMode(target: StructureController) {
		return this.creep.generateSafeMode(target);
	}

	harvest(source: Source | Mineral) {
		let result = this.creep.harvest(source);
		if (!this.actionLog.harvest) this.actionLog.harvest = (result == OK);
		return result;
	}

	goHarvest(source: Source | Mineral) {
		if (this.pos.inRangeToPos(source.pos, RANGES.HARVEST)) {
			return this.harvest(source);
		} else {
			return this.goTo(source);
		}
	}

	move(direction: DirectionConstant, force = false) {
		if (!this.blockMovement && !force) {
			let result = this.creep.move(direction);
			if (!this.actionLog.move) this.actionLog.move = (result == OK);
			return result;
		} else {
			return ERR_BUSY;
		}
	}

	notifyWhenAttacked(enabled: boolean) {
		return this.creep.notifyWhenAttacked(enabled);
	}

	pickup(resource: Resource) {
		let result = this.creep.pickup(resource);
		if (!this.actionLog.pickup) this.actionLog.pickup = (result == OK);
		return result;
	}

	rangedAttack(target: Creep | Structure) {
		let result = this.creep.rangedAttack(target);
		if (result == OK) {
			this.actionLog.rangedAttack = true;
			if (isCreep(target)) {
				if (target.hitsPredicted == undefined) target.hitsPredicted = target.hits;
				target.hitsPredicted -= CombatIntel.predictedDamageAmount(this, target, 'rangedAttack');
			}
		}
		return result;
	}

	rangedMassAttack() {
		let result = this.creep.rangedMassAttack();
		if (result == OK) {
			this.actionLog.rangedMassAttack = true;
			for (let target of this.pos.findInRange(this.room.hostiles, 3)) {
				if (target.hitsPredicted == undefined) target.hitsPredicted = target.hits;
				target.hitsPredicted -= CombatIntel.getMassAttackDamageTo(this, target);
			}
		}
		return result;
	}

	repair(target: Structure) {
		let result = this.creep.repair(target);
		if (!this.actionLog.repair) this.actionLog.repair = (result == OK);
		return result;
	}

	goRepair(target: Structure) {
		if (this.pos.inRangeToPos(target.pos, RANGES.REPAIR)) {
			return this.repair(target);
		} else {
			return this.goTo(target);
		}
	}

	reserveController(controller: StructureController) {
		let result = this.creep.reserveController(controller);
		if (!this.actionLog.reserveController) this.actionLog.reserveController = (result == OK);
		return result;
	}

	/* Say a message; maximum message length is 10 characters */
	say(message: string, pub?: boolean) {
		return this.creep.say(message, pub);
	}

	signController(target: StructureController, text: string) {
		let result = this.creep.signController(target, text);
		if (!this.actionLog.signController) this.actionLog.signController = (result == OK);
		return result;
	}

	suicide() {
		return this.creep.suicide();
	}

	upgradeController(controller: StructureController) {
		let result = this.creep.upgradeController(controller);
		if (!this.actionLog.upgradeController) this.actionLog.upgradeController = (result == OK);
		// Determine amount of upgrade power
		// let weightedUpgraderParts = _.map(this.boostCounts, )
		// let upgradeAmount = this.getActiveBodyparts(WORK) * UPGRADE_CONTROLLER_POWER;
		// let upgrade

		// Stats.accumulate(`colonies.${this.colony.name}.rcl.progressTotal`, upgradeAmount);
		return result;
	}

	heal(target: Creep | Zerg, rangedHealInstead = false) {
		if (rangedHealInstead && !this.pos.isNearTo(target)) {
			return this.rangedHeal(target);
		}
		const creep = toCreep(target);
		let result = this.creep.heal(creep);
		if (result == OK) {
			this.actionLog.heal = true;
			if (creep.hitsPredicted == undefined) creep.hitsPredicted = creep.hits;
			creep.hitsPredicted += CombatIntel.getHealAmount(this);
		}
		return result;
	}

	rangedHeal(target: Creep | Zerg) {
		const creep = toCreep(target);
		let result = this.creep.rangedHeal(creep);
		if (result == OK) {
			this.actionLog.rangedHeal = true;
			if (creep.hitsPredicted == undefined) creep.hitsPredicted = creep.hits;
			creep.hitsPredicted += CombatIntel.getRangedHealAmount(this);
		}
		return result;
	}

	transfer(target: Creep | Zerg | Structure, resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number) {
		let result: ScreepsReturnCode;
		if (target instanceof Zerg) {
			result = this.creep.transfer(target.creep, resourceType, amount);
		} else {
			result = this.creep.transfer(target, resourceType, amount);
		}
		if (!this.actionLog.transfer) this.actionLog.transfer = (result == OK);
		return result;
	}

	goTransfer(target: Creep | Zerg | Structure, resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number) {
		if (this.pos.inRangeToPos(target.pos, RANGES.TRANSFER)) {
			return this.transfer(target, resourceType, amount);
		} else {
			return this.goTo(target);
		}
	}

	withdraw(target: Structure | Tombstone, resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number) {
		let result = this.creep.withdraw(target, resourceType, amount);
		if (!this.actionLog.withdraw) this.actionLog.withdraw = (result == OK);
		return result;
	}

	goWithdraw(target: Structure | Tombstone, resourceType: ResourceConstant = RESOURCE_ENERGY, amount?: number) {
		if (this.pos.inRangeToPos(target.pos, RANGES.WITHDRAW)) {
			return this.withdraw(target, resourceType, amount);
		} else {
			return this.goTo(target);
		}
	}

	// Simultaneous creep actions --------------------------------------------------------------------------------------

	/* Determine whether the given action will conflict with an action the creep has already taken.
	 * See http://docs.screeps.com/simultaneous-actions.html for more details. */
	canExecute(actionName: string): boolean {
		// Only one action can be executed from within a single pipeline
		let conflictingActions: string[] = [actionName];
		for (let pipeline of actionPipelines) {
			if (pipeline.includes(actionName)) conflictingActions = conflictingActions.concat(pipeline);
		}
		for (let action of conflictingActions) {
			if (this.actionLog[action]) {
				return false;
			}
		}
		return true;
	}

	// Body configuration and related data -----------------------------------------------------------------------------

	getActiveBodyparts(type: BodyPartConstant): number {
		return this.creep.getActiveBodyparts(type);
	}

	/* The same as creep.getActiveBodyparts, but just counts bodyparts regardless of condition. */
	getBodyparts(partType: BodyPartConstant): number {
		return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
	}

	// Custom creep methods ============================================================================================

	// Carry methods

	get hasMineralsInCarry(): boolean {
		for (let resourceType in this.carry) {
			if (resourceType != RESOURCE_ENERGY && (this.carry[<ResourceConstant>resourceType] || 0) > 0) {
				return true;
			}
		}
		return false;
	}

	// Boosting logic --------------------------------------------------------------------------------------------------

	get boosts(): _ResourceConstantSansEnergy[] {
		return this.creep.boosts;
	}

	get boostCounts(): { [boostType: string]: number } {
		return this.creep.boostCounts;
	}

	get needsBoosts(): boolean {
		if (this.overlord) {
			return this.overlord.shouldBoost(this);
		}
		return false;
	}

	// Overlord logic --------------------------------------------------------------------------------------------------

	get overlord(): Overlord | null {
		return getOverlord(this);
	}

	set overlord(newOverlord: Overlord | null) {
		setOverlord(this, newOverlord);
	}

	/* Reassigns the creep to work under a new overlord and as a new role. */
	reassign(newOverlord: Overlord | null, newRole: string, invalidateTask = true) {
		this.overlord = newOverlord;
		this.roleName = newRole;
		this.memory.role = newRole;
		if (invalidateTask) {
			this.task = null;
		}
	}

	// Task logic ------------------------------------------------------------------------------------------------------

	/* Wrapper for _task */
	get task(): Task | null {
		if (!this._task) {
			this._task = this.memory.task ? initializeTask(this.memory.task) : null;
		}
		return this._task;
	}

	/* Assign the creep a task with the setter, replacing creep.assign(Task) */
	set task(task: Task | null) {
		// Unregister target from old task if applicable
		let oldProtoTask = this.memory.task;
		if (oldProtoTask) {
			let oldRef = oldProtoTask._target.ref;
			if (Overmind.cache.targets[oldRef]) {
				_.remove(Overmind.cache.targets[oldRef], name => name == this.name);
			}
		}
		// Set the new task
		this.memory.task = task ? task.proto : null;
		if (task) {
			if (task.target) {
				// Register task target in cache if it is actively targeting something (excludes goTo and similar)
				if (!Overmind.cache.targets[task.target.ref]) {
					Overmind.cache.targets[task.target.ref] = [];
				}
				Overmind.cache.targets[task.target.ref].push(this.name);
			}
			// Register references to creep
			task.creep = this;
		}
		// Clear cache
		this._task = null;
	}

	/* Does the creep have a valid task at the moment? */
	get hasValidTask(): boolean {
		return !!this.task && this.task.isValid();
	}

	/* Creeps are idle if they don't have a task. */
	get isIdle(): boolean {
		return !this.task || !this.task.isValid();
	}

	/* Execute the task you currently have. */
	run(): number | undefined {
		if (this.task) {
			return this.task.run();
		}
	}

	// Colony association ----------------------------------------------------------------------------------------------

	/* Colony that the creep belongs to. */
	get colony(): Colony {
		return Overmind.colonies[this.memory.colony];
	}

	set colony(newColony: Colony) {
		this.memory.colony = newColony.name;
	}

	/* If the creep is in a colony room or outpost */
	get inColonyRoom(): boolean {
		return Overmind.colonyMap[this.room.name] == this.memory.colony;
	}

	// Movement and location -------------------------------------------------------------------------------------------

	goTo(destination: RoomPosition | HasPos, options: MoveOptions = {}) {
		return Movement.goTo(this, destination, options);
	};

	goToRoom(roomName: string, options: MoveOptions = {}) {
		return Movement.goToRoom(this, roomName, options);
	};

	inSameRoomAs(target: HasPos): boolean {
		return this.pos.roomName == target.pos.roomName;
	}

	safelyInRoom(roomName: string): boolean {
		return this.room.name == roomName && !this.pos.isEdge;
	}

	get inRampart(): boolean {
		return this.creep.inRampart;
	}

	get isMoving(): boolean {
		let moveData = this.memory._go as MoveData | undefined;
		return !!moveData && !!moveData.path && moveData.path.length > 1;
	}

	/* Kite around hostiles in the room */
	kite(avoidGoals: (RoomPosition | HasPos)[] = this.room.hostiles, options: MoveOptions = {}): number | undefined {
		_.defaults(options, {
			fleeRange: 5
		});
		return Movement.kite(this, avoidGoals, options);
	}

	private defaultFleeGoals() {
		let fleeGoals: (RoomPosition | HasPos)[] = [];
		fleeGoals = fleeGoals.concat(this.room.hostiles)
							 .concat(_.filter(this.room.keeperLairs, lair => (lair.ticksToSpawn || Infinity) < 10));
		return fleeGoals;
	}

	/* Flee from hostiles in the room, while not repathing every tick */
	flee(avoidGoals: (RoomPosition | HasPos)[] = this.room.fleeDefaults,
		 fleeOptions: FleeOptions              = {},
		 moveOptions: MoveOptions              = {}): boolean {
		if (avoidGoals.length == 0) {
			return false;
		} else if (this.room.controller && this.room.controller.my && this.room.controller.safeMode) {
			return false;
		} else {
			let fleeing = Movement.flee(this, avoidGoals, fleeOptions.dropEnergy, moveOptions) != undefined;
			if (fleeing) {
				// Drop energy if needed
				if (fleeOptions.dropEnergy && this.carry.energy > 0) {
					let nearbyContainers = this.pos.findInRange(this.room.storageUnits, 1);
					if (nearbyContainers.length > 0) {
						this.transfer(_.first(nearbyContainers), RESOURCE_ENERGY);
					} else {
						this.drop(RESOURCE_ENERGY);
					}
				}
				// Invalidate task
				if (fleeOptions.invalidateTask) {
					this.task = null;
				}
			}
			return fleeing;
		}
	}

	/* Park the creep off-roads */
	park(pos: RoomPosition = this.pos, maintainDistance = false): number {
		return Movement.park(this, pos, maintainDistance);
	}

	/* Moves a creep off of the current tile to the first available neighbor */
	moveOffCurrentPos(): number | undefined {
		return Movement.moveOffCurrentPos(this);
	}

	/* Moves onto an exit tile */
	moveOnExit(): ScreepsReturnCode | undefined {
		return Movement.moveOnExit(this);
	}

	/* Moves off of an exit tile */
	moveOffExit(avoidSwamp = true): ScreepsReturnCode {
		return Movement.moveOffExit(this, avoidSwamp);
	}

	moveOffExitToward(pos: RoomPosition, detour = true): number | undefined {
		return Movement.moveOffExitToward(this, pos, detour);
	}

	// Miscellaneous fun stuff -----------------------------------------------------------------------------------------

	sayLoop(messageList: string[], pub?: boolean) {
		return this.say(messageList[Game.time % messageList.length], pub);
	}

	sayRandom(phrases: string[], pub?: boolean) {
		return this.say(phrases[Math.floor(Math.random() * phrases.length)], pub);
	}

}

