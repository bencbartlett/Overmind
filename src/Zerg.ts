import {profile} from './lib/Profiler';

@profile
export class WrappedCreep implements Zerg {
	creep: Creep; 					// The creep that this wrapper class will control
	body: BodyPartDefinition[];     // These properties are all wrapped from this.creep.* to this.*
	carry: StoreDefinition;			// |
	carryCapacity: number;			// |
	fatigue: number;				// |
	hits: number;					// |
	hitsMax: number;				// |
	id: string;						// |
	memory: CreepMemory;			// | See the ICreepMemory interface for structure
	name: string;					// |
	pos: RoomPosition;				// |
	ref: string;					// |
	roleName: string;				// |
	room: Room;						// |
	spawning: boolean;				// |
	ticksToLive: number;			// |
	// settings: any;					// Adjustable settings object, can vary across roles
	private _task: ITask | null; 	// Cached Task object that is instantiated once per tick and every time task changes

	constructor(creep: Creep) {
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
		this.spawning = creep.spawning;
		this.ticksToLive = creep.ticksToLive;
		// this.settings = {};
	}

	// Wrapped creep methods ===========================================================================================

	attack(target: Creep | Structure): number {
		return this.creep.attack(target);
	}

	attackController(controller: StructureController): number {
		return this.creep.attackController(controller);
	}

	build(target: ConstructionSite): number {
		return this.creep.build(target);
	}

	claimController(controller: StructureController): number {
		return this.creep.claimController(controller);
	}

	dismantle(target: Structure): number {
		return this.creep.dismantle(target);
	}

	drop(resourceType: ResourceConstant, amount?: number): number {
		return this.creep.drop(resourceType, amount);
	}

	getActiveBodyparts(type: BodyPartConstant): number {
		return this.creep.getActiveBodyparts(type);
	}

	harvest(source: Source | Mineral): number {
		return this.creep.harvest(source);
	}

	move(direction: DirectionConstant): number {
		return this.creep.move(direction);
	}

	pickup(resource: Resource): number {
		return this.creep.pickup(resource);
	}

	rangedAttack(target: Creep | Structure): number {
		return this.creep.rangedAttack(target);
	}

	rangedMassAttack(): number {
		return this.creep.rangedMassAttack();
	}

	repair(target: Structure): number {
		return this.creep.repair(target);
	}

	reserveController(controller: StructureController): number {
		return this.creep.reserveController(controller);
	}

	say(message: string, pub?: boolean): number {
		return this.creep.say(message, pub);
	}

	signController(target: StructureController, text: string): number {
		return this.creep.signController(target, text);
	}

	suicide(): number {
		return this.creep.suicide();
	}

	upgradeController(controller: StructureController): number {
		return this.creep.upgradeController(controller);
	}

	heal(target: Creep | WrappedCreep): number {
		if (target instanceof WrappedCreep) {
			return this.creep.heal(target.creep);
		} else {
			return this.creep.heal(target);
		}
	}

	rangedHeal(target: Creep | WrappedCreep): number {
		if (target instanceof WrappedCreep) {
			return this.creep.rangedHeal(target.creep);
		} else {
			return this.creep.rangedHeal(target);
		}
	}

	transfer(target: Creep | WrappedCreep | Structure, resourceType: ResourceConstant, amount?: number): number {
		if (target instanceof WrappedCreep) {
			return this.creep.transfer(target.creep, resourceType, amount);
		} else {
			return this.creep.transfer(target, resourceType, amount);
		}
	}

	withdraw(target: Creep | WrappedCreep | Structure, resourceType: ResourceConstant, amount?: number): number {
		if (target instanceof Creep) {
			return target.transfer(this.creep, resourceType, amount);
		} else if (target instanceof WrappedCreep) {
			return target.creep.transfer(this.creep, resourceType, amount);
		} else {
			return this.creep.withdraw(target, resourceType, amount);
		}
	}

	travelTo(destination: RoomPosition | { pos: RoomPosition }, options?: any): number {
		return this.creep.travelTo(destination, options);
	};

	// Custom creep methods ============================================================================================

	get overlord(): IOverlord | null {
		if (this.memory.overlord) {
			let [directiveName, overlordName] = this.memory.overlord.split(':');
			if (Game.directives[directiveName] && Game.directives[directiveName].overlords[overlordName]) {
				return Game.directives[directiveName].overlords[overlordName];
			} else {
				return null;
			}
		} else {
			return null;
		}
	}

	set overlord(newOverlord: IOverlord | null) {
		// Remove cache references to old assignments
		let ref = this.memory.overlord;
		if (ref && Overmind.cache.overlords[ref] && Overmind.cache.overlords[ref][this.roleName]) {
			_.remove(Overmind.cache.overlords[ref][this.roleName], name => name == this.name);
		}
		if (newOverlord) {
			// Change assignments in memory
			this.memory.overlord = newOverlord.ref;
			// Update the cache references
			if (!Overmind.cache.overlords[newOverlord.ref]) {
				Overmind.cache.overlords[newOverlord.ref] = {};
			}
			if (!Overmind.cache.overlords[newOverlord.ref][this.roleName]) {
				Overmind.cache.overlords[newOverlord.ref][this.roleName] = [];
			}
			Overmind.cache.overlords[newOverlord.ref][this.roleName].push(this.name);
		} else {
			this.memory.overlord = null;
		}
	}

	/* Instantiate the _task object when needed */
	initializeTask(): ITask | null {
		let protoTask = this.memory.task as protoTask;
		if (protoTask) {
			// PERFORM TASK MIGRATION HERE
			return taskFromPrototask(protoTask);
		} else {
			return null;
		}
	}

	/* Wrapper for _task */
	get task(): ITask | null {
		if (!this._task) {
			this._task = this.initializeTask();
		}
		return this._task;
	}

	/* Assign the creep a task with the setter, replacing creep.assign(Task) */
	set task(task: ITask | null) {
		// Unregister target from old task if applicable
		let oldProtoTask = this.memory.task as protoTask;
		if (oldProtoTask) {
			let oldRef = oldProtoTask._target.ref;
			if (Overmind.cache.targets[oldRef]) {
				Overmind.cache.targets[oldRef] = _.remove(Overmind.cache.targets[oldRef], name => name == this.name);
			}
		}
		// Set the new task
		this.memory.task = task;
		if (task && task.target) { // If task isn't null
			// Register task target in cache
			if (!Overmind.cache.targets[task.target.ref]) {
				Overmind.cache.targets[task.target.ref] = [];
			}
			Overmind.cache.targets[task.target.ref].push(this.name);
			// Register references to creep
			task.creep = this;
			this._task = task;
		}
	}

	/* Does the creep have a valid task at the moment? */
	get hasValidTask(): boolean {
		return this.task != null && this.task.isValid();
	}

	/* Creeps are idle if they don't have a task. */
	get isIdle(): boolean {
		return !this.hasValidTask;
	}

	/* Colony that the creep belongs to. */
	get colony(): IColony {
		return Overmind.Colonies[this.memory.colony];
	}

	set colony(newColony: IColony) {
		this.memory.colony = newColony.name;
	}

	/* Return the maximum (not remaining) lifetime of the creep */
	get lifetime(): number {
		if (_.map(this.body, (part: BodyPartDefinition) => part.type).includes(CLAIM)) {
			return 500;
		} else {
			return 1500;
		}
	}

	/* The average movespeed of the creep on blank terrain */
	get moveSpeed(): number {
		if (!this.memory.data.moveSpeed) {
			var massiveParts = [WORK, ATTACK, RANGED_ATTACK, HEAL, TOUGH];
			var mass = 0;
			for (let part of massiveParts) {
				mass += this.getActiveBodyparts(part);
			}
			var moveParts = this.getActiveBodyparts(MOVE);
			var fatiguePerTick = 2 * mass;
			if (fatiguePerTick == 0) {
				this.memory.data.moveSpeed = 1;
			} else {
				this.memory.data.moveSpeed = Math.min(2 * moveParts / fatiguePerTick, 1);
			}
		}
		return this.memory.data.moveSpeed;
	}

	/* The same as creep.getActiveBodyparts, but just counts bodyparts regardless of condition. */
	getBodyparts(partType: string): number {
		return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
	}

	/* Execute the task you currently have. */
	run(): number | void {
		if (this.task) {
			return this.task.run();
		} else {
			return this.say('No task!');
		}
	}

}

