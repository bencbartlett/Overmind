// import {tasks} from '../maps/map_tasks';
import {TaskWithdraw} from '../tasks/task_withdraw';
// import {TaskGetRenewed} from '../tasks/task_getRenewed';
import {Objective} from '../objectives/Objective';


export abstract class AbstractSetup implements ISetup {
	name: string;								// Name of the role
	body: {
		pattern: BodyPartConstant[];			// body pattern to be repeated
		prefix: BodyPartConstant[];				// stuff at beginning of body
		suffix: BodyPartConstant[];				// stuff at end of body
		proportionalPrefixSuffix: boolean;		// (?) prefix/suffix scale with body size
		ordered: boolean;						// (?) assemble as WORK WORK MOVE MOVE instead of WORK MOVE WORK MOVE
		boost?: { [partToBoost: string]: ResourceConstant };	// Bost body parts with specified minerals
	};

	constructor(roleName: string) {
		this.name = roleName;
		// Defaults for a creep setup
		this.body = {
			pattern                 : [],
			prefix                  : [],
			suffix                  : [],
			proportionalPrefixSuffix: true,
			ordered                 : false,
		};
	}

	/* The cost of a single repetition of the basic bodyPattern for this role */
	get bodyPatternCost(): number {
		return this.bodyCost(this.body.pattern);
	}

	/* Return the cost of an entire array of body parts */
	bodyCost(bodyArray: string[]): number {
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

	/* Generate the largest body of a given pattern that is producable from a room,
	 * subject to limitations from maxRepeats */
	generateBody(availableEnergy: number, maxRepeats = Infinity): BodyPartConstant[] {
		let patternCost, patternLength, numRepeats;
		let prefix = this.body.prefix;
		let suffix = this.body.suffix;
		let proportionalPrefixSuffix = this.body.proportionalPrefixSuffix;
		let body: BodyPartConstant[] = [];
		// calculate repetitions
		if (proportionalPrefixSuffix) { // if prefix and suffix are to be kept proportional to body size
			patternCost = this.bodyCost(prefix) + this.bodyCost(this.body.pattern) + this.bodyCost(suffix);
			patternLength = prefix.length + this.body.pattern.length + suffix.length;
			numRepeats = Math.floor(availableEnergy / patternCost); // maximum number of repeats we can afford
			numRepeats = Math.min(Math.floor(50 / patternLength),
								  numRepeats,
								  maxRepeats);
		} else { // if prefix and suffix don't scale
			let extraCost = this.bodyCost(prefix) + this.bodyCost(suffix);
			patternCost = this.bodyCost(this.body.pattern);
			patternLength = this.body.pattern.length;
			numRepeats = Math.floor((availableEnergy - extraCost) / patternCost); // max number of remaining patterns
			numRepeats = Math.min(Math.floor((50 - prefix.length - suffix.length) / patternLength),
								  numRepeats,
								  maxRepeats);
		}
		// build the body
		if (proportionalPrefixSuffix) { // add the prefix
			for (let i = 0; i < numRepeats; i++) {
				body = body.concat(prefix);
			}
		} else {
			body = body.concat(prefix);
		}
		if (this.body.ordered) { // repeated body pattern
			for (let part of this.body.pattern) {
				for (let i = 0; i < numRepeats; i++) {
					body.push(part);
				}
			}
		} else {
			for (let i = 0; i < numRepeats; i++) {
				body = body.concat(this.body.pattern);
			}
		}
		if (proportionalPrefixSuffix) { // add the suffix
			for (let i = 0; i < numRepeats; i++) {
				body = body.concat(suffix);
			}
		} else {
			body = body.concat(suffix);
		}
		// return it
		return body;
	}

	/* Generate (but not spawn) the largest creep possible, returns the creep as an object */
	generateLargestCreep(colony: IColony, {assignment, patternRepetitionLimit}: protoCreepOptions): protoCreep {
		let creepBody: BodyPartConstant[];
		if (colony.incubator) { // if you're being incubated, build as big a creep as you want
			creepBody = this.generateBody(colony.incubator.room.energyCapacityAvailable, patternRepetitionLimit);
		} else { // otherwise limit yourself to actual energy constraints
			creepBody = this.generateBody(colony.room.energyCapacityAvailable, patternRepetitionLimit);
		}
		let protoCreep: protoCreep = { 									// object to add to spawner queue
			body  : creepBody, 											// body array
			name  : this.name, 											// name of the creep - gets modified by hatchery
			memory: { 													// memory to initialize with
				role         : this.name,								// role of the creep
				task         : null, 									// task the creep is performing
				assignmentRef: assignment ? assignment.ref : null, 		// ref of object the creep is assigned to
				assignmentPos: assignment ? assignment.pos : null, 		// serialized position of the assignment
				objectiveRef : null,									// reference to creep's current objective
				colony       : colony.name, 							// name of the colony the creep is assigned to
				data         : { 										// rarely-changed data about the creep
					origin   : '',										// where it was spawned, filled in at spawn time
					replaceAt: 0, 										// when it should be replaced
					boosts   : {} 										// keeps track of what boosts creep has/needs
				},
				roleData     : {}, 										// empty role data object
			},
		};
		return protoCreep;
	}

	/* Overwrite this method to modify the protoCreep object before spawning it */
	onCreate(pCreep: protoCreep): protoCreep {
		return pCreep;
	}

	/* Create a protocreep, modify it as needed, and return the object. Does not spawn the creep. */
	create(colony: IColony, {assignment, patternRepetitionLimit}: protoCreepOptions): protoCreep {
		let protoCreep: protoCreep = this.generateLargestCreep(colony, {assignment, patternRepetitionLimit});
		protoCreep = this.onCreate(protoCreep); // modify creep as needed
		return protoCreep;
	}
}


export abstract class AbstractCreep implements ICreep {
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
	settings: any;					// Adjustable settings object, can vary across roles
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
		this.settings = {};
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

	heal(target: Creep | AbstractCreep): number {
		if (target instanceof AbstractCreep) {
			return this.creep.heal(target.creep);
		} else {
			return this.creep.heal(target);
		}
	}

	rangedHeal(target: Creep | AbstractCreep): number {
		if (target instanceof AbstractCreep) {
			return this.creep.rangedHeal(target.creep);
		} else {
			return this.creep.rangedHeal(target);
		}
	}

	transfer(target: Creep | AbstractCreep | Structure, resourceType: ResourceConstant, amount?: number): number {
		if (target instanceof AbstractCreep) {
			return this.creep.transfer(target.creep, resourceType, amount);
		} else {
			return this.creep.transfer(target, resourceType, amount);
		}
	}

	withdraw(target: Creep | AbstractCreep | Structure, resourceType: ResourceConstant, amount?: number): number {
		if (target instanceof Creep) {
			return target.transfer(this.creep, resourceType, amount);
		} else if (target instanceof AbstractCreep) {
			return target.creep.transfer(this.creep, resourceType, amount);
		} else {
			return this.creep.withdraw(target, resourceType, amount);
		}
	}

	travelTo(destination: RoomPosition | { pos: RoomPosition }, options?: any): number {
		return this.creep.travelTo(destination, options);
	};

	// Custom creep methods ============================================================================================

	get assignment(): RoomObject | null {
		if (this.memory.assignmentRef) {
			return deref(this.memory.assignmentRef);
		} else {
			return null;
		}
	}

	set assignment(newAssignment: RoomObject | null) {
		// Remove cache references to old assignments
		let ref = this.memory.assignmentRef;
		if (ref && Game.cache.assignments[ref] && Game.cache.assignments[ref][this.roleName]) {
			Game.cache.assignments[ref][this.roleName] = _.remove(Game.cache.assignments[ref][this.roleName],
																  name => name == this.name);
		}
		if (newAssignment) {
			// Change assignments in memory
			this.memory.assignmentRef = newAssignment.ref;
			this.memory.assignmentPos = newAssignment.pos;
			// Update the cache references
			if (!Game.cache.assignments[newAssignment.ref]) {
				Game.cache.assignments[newAssignment.ref] = {};
			}
			if (!Game.cache.assignments[newAssignment.ref][this.roleName]) {
				Game.cache.assignments[newAssignment.ref][this.roleName] = [];
			}
			Game.cache.assignments[newAssignment.ref][this.roleName].push(this.name);
		} else {
			this.memory.assignmentRef = null;
			this.memory.assignmentPos = null;
		}
	}

	get assignmentPos(): RoomPosition | null {
		let apos = this.memory.assignmentPos;
		if (apos) {
			return new RoomPosition(apos.x, apos.y, apos.roomName);
		} else {
			return null;
		}
	}

	/* Is the creep in the same room as its assignment? */
	get inAssignedRoom(): boolean {
		return this.assignmentPos != null && this.pos.roomName == this.assignmentPos.roomName;
	}

	/* Returns the colony flag for the room containing this creep's assignment */
	get assignedRoomFlag(): Flag | null {
		if (this.assignmentPos) {
			let roomName = this.assignmentPos.roomName;
			let colonyName = Overmind.colonyMap[roomName];
			let flagName = roomName + ':' + colonyName;
			return Game.flags[flagName];
		} else {
			return null;
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
			if (Game.cache.targets[oldRef]) {
				Game.cache.targets[oldRef] = _.remove(Game.cache.targets[oldRef], name => name == this.name);
			}
		}
		// Set the new task
		this.memory.task = task;
		if (task && task.target) { // If task isn't null
			// Register task target in cache
			if (!Game.cache.targets[task.target.ref]) {
				Game.cache.targets[task.target.ref] = [];
			}
			Game.cache.targets[task.target.ref].push(this.name);
			// Register references to creep
			task.creep = this;
			this._task = task;
		}
	}

	/* Does the creep have a valid task at the moment? */
	get hasValidTask(): boolean {
		return this.task != null && this.task.creep != null && this.task.target != null &&
			   this.task.isValidTask() && this.task.isValidTarget();
	}

	/* Creeps are idle if they don't have a task. */
	get isIdle(): boolean {
		return !this.hasValidTask;
	}

	/* Does the creep have a valid task? If not, get a new task. */
	assertValidTask(): void {
		if (!this.hasValidTask) {
			this.newTask();
		}
	}

	/* Dereference the objective that the creep is working on. */
	get objective(): Objective | null {
		if (this.memory.objectiveRef) {
			return this.colony.overlord.objectiveGroup.objectivesByRef[this.memory.objectiveRef];
		} else {
			return null;
		}
	}

	/* Colony that the creep belongs to. */
	get colony(): IColony {
		return this.creep.colony;
	}

	set colony(newColony: IColony) {
		this.creep.colony = newColony;
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

	/* Whether the creep is close enough to death that you should start spawning its replacement */
	get needsReplacing(): boolean {
		if (this.ticksToLive && this.assignment) { // undefined when spawning
			let originSpawn = Game.rooms[this.memory.data.origin].spawns[0];
			let replaceAt = originSpawn.pathLengthTo(this.assignment) / this.moveSpeed; // expected travel time
			replaceAt += 3 * this.body.length; // expected spawning time
			return this.ticksToLive < replaceAt;
		} else {
			return false;
		}
	}

	/* The same as creep.getActiveBodyparts, but just counts bodyparts regardless of condition. */
	getBodyparts(partType: string): number {
		return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
	}

	/* Say a multi-string message on loop */
	sayLoop(sayList: string[]): void {
		if (!this.memory.data.sayCount) {
			this.memory.data.sayCount = 0;
		}
		let count = this.memory.data.sayCount;
		this.say(sayList[count], true);
		this.memory.data.sayCount = (count + 1) % sayList.length;
	}

	/* Repair the road beneath you if needed */
	repairNearbyDamagedRoad(): number {
		let damagedRoads = _.filter(this.pos.lookFor(LOOK_STRUCTURES),
									(s: Structure) => s.structureType == STRUCTURE_ROAD && s.hitsMax - s.hits > 100);
		let damagedRoad = damagedRoads[0] as StructureRoad;
		if (damagedRoad) {
			return this.repair(damagedRoad);
		}
		return OK;
	}

	/* Default logic for a worker-type creep to refill its energy supply */
	recharge(): void { // default recharging logic for creeps
		let target = this.pos.findClosestByRange(this.room.storageUnits, {
			filter: (s: StorageUnit) => (s instanceof StructureContainer && s.energy > this.carryCapacity) ||
										(s instanceof StructureStorage && s.creepCanWithdrawEnergy(this)),
		}) as StorageUnit;
		if (target) { // assign recharge task to creep
			this.task = new TaskWithdraw(target);
		} else {
			this.say('Can\'t recharge');
		}
	}

	/* Default logic for requesting a new task from the colony overlord. Creeps which request tasks from
	 * other objects, such as hatchery/commancCenter/etc should overwrite this method. */
	requestTask(): void {
		return this.colony.overlord.assignTask(this);
	}

	/* Default decision tree for handling when a task is valid. */
	newTask(): void {
		this.task = null;
		if (this.carry.energy == 0) {
			this.recharge();
		} else {
			this.requestTask();
		}
	}

	/* Execute the task you currently have. */
	executeTask(): number | void {
		if (this.task) {
			return this.task.run();
		}
	}

	/* Mostly used for incubation purposes - get renewed from a spawn if you're getting old. */
	// renewIfNeeded(): void {
	// 	if (this.room.spawns[0] && this.memory.data.renewMe && this.ticksToLive < 500) {
	// 		this.task = new TaskGetRenewed(this.room.spawns[0]);
	// 	}
	// }

	/* Code that you want to run at the beginning of each run() call. */
	onRun(): void {
		return;
	}

	/* Code that you want to run at the init phase after colonies have been initialized. */
	init(): void {
		return;
	}

	/* Main execution function for the creep on each tick. */
	run(): void {
		// Execute on-run code
		this.onRun();
		// Assert that there is a valid task; if not, obtain one
		this.assertValidTask();
		// Execute the task or complain that you don't have a task
		this.executeTask();
	}
}

