// import {tasks} from '../maps/map_tasks';
import profiler = require('../lib/screeps-profiler');
import {taskRecharge} from "../tasks/task_recharge";
import {taskGetRenewed} from "../tasks/task_getRenewed";
import {Colony} from "../Colony";
import {Objective} from "../objectives/Objective";
import {tasks} from "../maps/map_tasks";


export abstract class AbstractSetup implements ISetup {
    name: string;
    settings: any;
    roleRequirements: Function;

    constructor(roleName: string) {
        this.name = roleName; // name of the role
        this.settings = {
            bodyPattern: [], // body pattern to be repeated
            bodyPrefix: [], // stuff at beginning of body
            bodySuffix: [], // stuff at end of body
            proportionalPrefixSuffix: true, // prefix/suffix scale with body size
            orderedBodyPattern: false, // assemble as WORK WORK MOVE MOVE instead of WORK MOVE WORK MOVE,
        };
        this.roleRequirements = (c: Creep) => c.getActiveBodyparts(WORK) > 1 && // what is required to do this role
                                              c.getActiveBodyparts(MOVE) > 1 &&
                                              c.getActiveBodyparts(CARRY) > 1 &&
                                              console.log('Role.roleRequirements should be overwritten!');
    }

    get bodyPatternCost(): number { // base cost of the body pattern
        return this.bodyCost(this.settings.bodyPattern);
    }

    bodyCost(bodyArray: string[]): number {
        var partCosts: { [type: string]: number } = {
            'move': 50,
            'work': 100,
            'carry': 50,
            'attack': 80,
            'ranged_attack': 150,
            'heal': 250,
            'claim': 600,
            'tough': 10,
        };
        var cost = 0;
        for (let part of bodyArray) {
            cost += partCosts[part];
        }
        return cost;
    };

    generateBody(availableEnergy: number, maxRepeats = Infinity): string[] {
        let patternCost, patternLength, numRepeats;
        let prefix = this.settings.bodyPrefix;
        let suffix = this.settings.bodySuffix;
        let proportionalPrefixSuffix = this.settings.proportionalPrefixSuffix;
        let body: string[] = [];
        // calculate repetitions
        if (proportionalPrefixSuffix) { // if prefix and suffix are to be kept proportional to body size
            patternCost = this.bodyCost(prefix) + this.bodyCost(this.settings.bodyPattern) + this.bodyCost(suffix);
            patternLength = prefix.length + this.settings.bodyPattern.length + suffix.length;
            numRepeats = Math.floor(availableEnergy / patternCost); // maximum number of repeats we can afford
            numRepeats = Math.min(Math.floor(50 / patternLength),
                                  numRepeats,
                                  maxRepeats);
        } else { // if prefix and suffix don't scale
            let extraCost = this.bodyCost(prefix) + this.bodyCost(suffix);
            patternCost = this.bodyCost(this.settings.bodyPattern);
            patternLength = this.settings.bodyPattern.length;
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
        if (this.settings.orderedBodyPattern) { // repeated body pattern
            for (let part of this.settings.bodyPattern) {
                for (let i = 0; i < numRepeats; i++) {
                    body.push(part);
                }
            }
        } else {
            for (let i = 0; i < numRepeats; i++) {
                body = body.concat(this.settings.bodyPattern);
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

    // generate (but not spawn) the largest creep possible, returns the creep as an object
    generateLargestCreep(colony: Colony, {assignment, patternRepetitionLimit}: protoCreepOptions): protoCreep {
        // spawn: spawn to add to, assignment: object (not ref) to assign creep to, patternRepetitionLimit: creep size
        let creepBody = this.generateBody(colony.room.energyCapacityAvailable, patternRepetitionLimit);
        let protoCreep: protoCreep = { // object to add to spawner queue
            body: creepBody, // body array
            name: this.name, // name of the creep - gets modified by hatchery
            memory: { // memory to initialize with
                role: this.name, // role of the creep
                task: <ITask> null, // task the creep is performing
                assignmentRef: assignment.ref, // ref of object/room(use controller) the creep is assigned to
                assignmentPos: assignment.pos, // serialized position of the assignment
                colony: colony.name, // name of the colony the creep is assigned to
                data: { // rarely-changed data about the creep
                    origin: colony.room.name, // where it was spawned
                    replaceAt: 0, // when it should be replaced
                },
            },
        };
        return protoCreep;
    }

    onCreate(pCreep: protoCreep): protoCreep { // modification to creep proto-object before spawning it
        return pCreep; // Overwrite this as needed
    }

    // default creation function for creeps
    create(colony: Colony, {assignment, patternRepetitionLimit}: protoCreepOptions): protoCreep {
        let protoCreep: protoCreep = this.generateLargestCreep(colony, {assignment, patternRepetitionLimit});
        protoCreep = this.onCreate(protoCreep); // modify creep as needed
        return protoCreep; // spawn.createCreep(creep.body, creep.name, creep.memory);
    }
}


export abstract class AbstractCreep implements ICreep {

    creep: Creep;
    body: BodyPartDefinition[];
    carry: StoreDefinition;
    carryCapacity: number;
    fatigue: number;
    hits: number;
    hitsMax: number;
    id: string;
    memory: any;
    name: string;
    pos: RoomPosition;
    ref: string;
    roleName: string;
    room: Room;
    spawning: boolean;
    ticksToLive: number;
    settings: any;
    _task: ITask;

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
        this._task = this.initializeTask();
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

    drop(resourceType: string, amount?: number): number {
        return this.creep.drop(resourceType, amount);
    }

    getActiveBodyparts(type: string): number {
        return this.creep.getActiveBodyparts(type);
    }

    harvest(source: Source | Mineral): number {
        return this.creep.harvest(source);
    }

    move(direction: number): number {
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

    signController(target: Controller, text: string): number {
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

    transfer(target: Creep | AbstractCreep | Structure, resourceType: string, amount?: number): number {
        if (target instanceof AbstractCreep) {
            return this.creep.transfer(target.creep, resourceType, amount);
        } else {
            return this.creep.transfer(target, resourceType, amount);
        }
    }

    withdraw(target: Creep | AbstractCreep | Structure, resourceType: string, amount?: number): number {
        if (target instanceof Creep) {
            return target.transfer(this.creep, resourceType, amount);
        } else if (target instanceof AbstractCreep) {
            return target.creep.transfer(this.creep, resourceType, amount);
        } else {
            return this.creep.withdraw(target, resourceType, amount);
        }
    }

    travelTo(destination: { pos: RoomPosition }, options?: any): number {
        return this.creep.travelTo(destination, options);
    };

    // End of wrapped creep methods ====================================================================================

    // Begin custom creep methods ======================================================================================

    log(...args: any[]): void {
        console.log(this.room, ' ', this.name, ': "', ...args, '".');
    }

    get assignment(): RoomObject {
        return deref(this.memory.assignmentRef);
    }

    set assignment(newAssignment: RoomObject) {
        this.memory.assignmentRef = newAssignment.ref;
        this.memory.assignmentPos = newAssignment.pos;
    }

    get assignmentPos(): RoomPosition {
        let apos = this.memory.assignmentPos;
        return new RoomPosition(apos.x, apos.y, apos.roomName);
    }

    initializeTask(): ITask {
        if (this.memory.task != null) {
            // NOTE: task migration operations should be performed here
            // if (this.memory.task.targetID) {
            //     this.memory.task.targetRef = this.memory.task.targetID;
            // }
            let target = deref(this.memory.task.targetRef);
            let task = tasks(this.memory.task.name, target) as ITask;
            task.creepName = this.memory.task.creepName;
            task.targetCoords = this.memory.task.targetCoords;
            task.data = this.memory.task.data;
            return task;
        } else {
            return null;
        }
    }

    get task(): ITask {
        return this._task;
    }

    set task(task: ITask | null) {
        // Unregister target from old task if applicable
        if (this.memory.task) {
            let oldRef = this.memory.task.targetRef;
            if (Game.cache.targets[oldRef]) {
                Game.cache.targets[oldRef] = _.remove(Game.cache.targets[oldRef], name => name == this.name);
            }
        }
        // Set the new task
        this.memory.task = task;
        if (task) { // If task isn't null
            // Register task target in cache
            if (!Game.cache.targets[task.target.ref]) {
                Game.cache.targets[task.target.ref] = [];
            }
            Game.cache.targets[task.target.ref].push(this.name);
            // Register references to creep
            task.creep = this;
            this.memory.task = task;
            this._task = task;
        }
    }

    get hasValidTask(): boolean {
        return this.task && this.task.isValidTask() && this.task.isValidTarget();
    }

    assertValidTask(): void {
        if (!this.hasValidTask) {
            this.newTask();
        }
        if (!this.task) {
            this.log("Unable to obtain a task!");
        }
    }

    get objective(): Objective {
        if (this.memory.objective) {
            return this.colony.overlord.objectivesByRef[this.memory.objectives];
        } else {
            return null;
        }
    }

    get colony(): Colony {
        return this.creep.colony;
    }

    set colony(newColony: Colony) {
        this.creep.colony = newColony;
    }

    get lifetime(): number {
        if (_.map(this.body, (part: BodyPartDefinition) => part.type).includes(CLAIM)) {
            return 500;
        } else {
            return 1500;
        }
    }

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

    get needsReplacing(): boolean {
        if (this.ticksToLive) { // undefined when spawning
            let originSpawn = Game.rooms[this.memory.data.origin].spawns[0];
            let replaceAt = originSpawn.pathLengthTo(this.assignment) / this.moveSpeed; // expected travel time
            replaceAt += 3 * this.body.length; // expected spawning time
            return this.ticksToLive < replaceAt;
        } else {
            return false;
        }
    }

    getBodyparts(partType: string): number {
        return _.filter(this.body, (part: BodyPartDefinition) => part.type == partType).length;
    }

    publicMessage(sayList: string[]): void {
        if (!this.memory.data.sayCount) {
            this.memory.data.sayCount = 0;
        }
        let count = this.memory.data.sayCount;
        this.say(sayList[count], true);
        this.memory.data.sayCount = (count + 1) % sayList.length;
    }

    repairNearbyDamagedRoad(): number {
        let damagedRoads = _.filter(this.pos.lookFor(LOOK_STRUCTURES),
                                    (s: Structure) => s.structureType == STRUCTURE_ROAD && s.hitsMax - s.hits > 100);
        let damagedRoad = damagedRoads[0] as StructureRoad;
        if (damagedRoad) {
            return this.repair(damagedRoad);
        }
        return OK;
    }

    recharge(): void { // default recharging logic for creeps
        let target = this.pos.findClosestByRange(this.room.storageUnits, {
            filter: (s: StorageUnit) => (s instanceof StructureContainer && s.energy > this.carryCapacity) ||
                                        (s instanceof StructureStorage && s.creepCanWithdrawEnergy(this)),
        }) as StorageUnit;
        if (target) { // assign recharge task to creep
            this.task = new taskRecharge(target);
        } else {
            this.say("Can't recharge");
        }
    }

    requestTask(): void { // default logic for requesting a new task from the colony overlord
        return this.colony.overlord.assignTask(this);
    }

    newTask(): void {
        this.task = null;
        if (this.carry.energy == 0) {
            this.recharge();
        } else {
            this.requestTask();
        }
    }

    executeTask(): number | void {
        if (this.task) {
            return this.task.step();
        } else {
            // this.log('no task!');
            this.say('no task!');
        }
    }

    renewIfNeeded(): void {
        if (this.room.spawns[0] && this.memory.data.renewMe && this.ticksToLive < 500) {
            this.task = new taskGetRenewed(this.room.spawns[0]);
        }
    }

    onRun(): any { // Code that you want to run at the beginning of each run() call
        return null;
    }

    run(): any {
        // Execute on-run code
        this.onRun();
        // Assert that there is a valid task; if not, obtain one
        this.assertValidTask();
        // Execute the task or complain that you don't have a task
        this.executeTask();
    }
}
