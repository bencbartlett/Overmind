// import {tasks} from '../maps/map_tasks';
import profiler = require('../lib/screeps-profiler');
import {Task} from "../tasks/Task";
import {taskRecharge} from "../tasks/task_recharge";
import {taskGetRenewed} from "../tasks/task_getRenewed";

export abstract class Role implements IRole {
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
            replaceTimeBuffer: 0, // time to replace the creep at
            consoleQuiet: false, // suppress console output for this role
            sayQuiet: false, // suppress speech bubbles for this role
            notifyOnNoTask: true, // notify if creep can't get a task from brain or if it doesn't have one
            notifyOnNoRechargeTargets: false // notify if creep can't recharge for some reason
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
        var patternCost, patternLength, numRepeats;
        var prefix = this.settings.bodyPrefix;
        var suffix = this.settings.bodySuffix;
        var proportionalPrefixSuffix = this.settings.proportionalPrefixSuffix;
        var body: string[] = [];
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
    generateLargestCreep(spawn: Spawn, {assignment, workRoom, patternRepetitionLimit}: creepCall): protoCreep {
        // spawn: spawn to add to, assignment: object (not ref) to assign creep to, patternRepetitionLimit: creep size
        var creepBody = this.generateBody(spawn.room.energyCapacityAvailable, patternRepetitionLimit);
        var creepName = spawn.creepName(this.name);
        var creep = { // object to add to spawner queue
            body: creepBody, // body array
            name: creepName, // name of the creep
            memory: { // memory to initialize with
                role: this.name, // role of the creep
                task: null, // task the creep is performing
                assignment: assignment.ref, // ref of object/room(use controller) the creep is assigned to
                workRoom: workRoom, // name of the room the creep is assigned to
                data: { // rarely-changed data about the creep
                    origin: spawn.room.name, // where it was spawned
                    replaceAt: 0, // when it should be replaced
                },
            },
        };
        return creep;
    }

    onCreate(pCreep: protoCreep): protoCreep { // modification to creep proto-object before spawning it
        return pCreep; // Overwrite this as needed
    }

    // default creation function for creeps
    create(spawn: StructureSpawn, {assignment, workRoom, patternRepetitionLimit}: creepCall): protoCreep {
        let creep = this.generateLargestCreep(spawn, {assignment, workRoom, patternRepetitionLimit});
        creep = this.onCreate(creep); // modify creep as needed
        return creep; // spawn.createCreep(creep.body, creep.name, creep.memory);
    }

    requestTask(creep: Creep): string { // default logic for requesting a new task from the room brain // TODO: why doesn't this work in other rooms?
        if (!creep.workRoom) {
            creep.log("no workRoom! Why?");
            return "";
        }
        var response = creep.workRoom.brain.assignTask(creep);
        if (!response && !this.settings.consoleQuiet && this.settings.notifyOnNoTask) {
            creep.log('could not get task from room brain!');
        }
        return response;
    }

    recharge(creep: Creep): string { // default recharging logic for creeps
        // try to find closest container or storage
        var bufferSettings = creep.room.brain.settings.storageBuffer; // not creep.workRoom; use rules of room you're in
        var buffer = bufferSettings.default;
        if (bufferSettings[this.name]) {
            buffer = bufferSettings[this.name];
        }
        var target = creep.pos.findClosestByRange(creep.room.storageUnits, {
            filter: (s: Container | StructureStorage) =>
            (s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > creep.carryCapacity) ||
            (s.structureType == STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > buffer),
        }) as Container | Storage;
        if (target) { // assign recharge task to creep
            return creep.assign(new taskRecharge(target));
        } else {
            if (!this.settings.consoleQuiet && this.settings.notifyOnNoRechargeTargets) {
                creep.log('no recharge targets!');
            }
            return "";
        }
    }

    newTask(creep: Creep): void {
        creep.task = null;
        if (creep.carry.energy == 0) {
            this.recharge(creep);
        } else {
            this.requestTask(creep);
        }
    }

    executeTask(creep: Creep): number | void {
        if (creep.task) {
            return creep.task.step();
        } else {
            if (!this.settings.consoleQuiet && this.settings.notifyOnNoTask) {
                creep.log('no task!');
            }
            if (!this.settings.sayQuiet && this.settings.notifyOnNoTask) {
                creep.say('no task!');
            }
        }
    }

    renewIfNeeded(creep: Creep): string {
        if (creep.room.spawns[0] && creep.memory.data.renewMe && creep.ticksToLive < 500) {
            return creep.assign(new taskGetRenewed(creep.room.spawns[0]));
        } else {
            return "";
        }
    }

    onRun(creep: Creep): any { // Code that you want to run at the beginning of each run() call
        return creep;
    }

    run(creep: Creep): any {
        // Execute on-run code
        this.onRun(creep);
        // Check each tick that the task is still valid
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            this.newTask(creep);
        }
        // If there is a task, execute it
        return this.executeTask(creep);
    }
}

// const profiler = require('screeps-profiler');

profiler.registerClass(Role, 'Role');