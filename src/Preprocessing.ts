// Preprocessing code to be run before animation of anything

export class Preprocessing {
    constructor() {
        Game.cache = {
            assignments: {},
            targets: {},
            structures: {},
            constructionSites: {}
        }
    }

    cacheAssignments() { // generates a hash table for creeps assigned to each thing; key: role, val: name
        for (let name in Game.creeps) {
            let creep = Game.creeps[name];
            let assignmentRef = creep.memory.assignment;
            if (assignmentRef) {
                if (!Game.cache.assignments[assignmentRef]) {
                    Game.cache.assignments[assignmentRef] = {};
                }
                if (!Game.cache.assignments[assignmentRef][creep.memory.role]) {
                    Game.cache.assignments[assignmentRef][creep.memory.role] = []
                }
                Game.cache.assignments[assignmentRef][creep.memory.role].push(name);
            }
        }
    }

    cacheTargets() {
        for (let name in Game.creeps) {
            let creep = Game.creeps[name];
            if (creep.memory.task && creep.memory.task.targetID) {
                let targetRef = creep.memory.task.targetID;
                if (!Game.cache.targets[targetRef]) {
                    Game.cache.targets[targetRef] = [];
                }
                Game.cache.targets[targetRef].push(name);
            }
        }
    }

    cacheStructures() {
        for (let name in Game.rooms) {
            let room = Game.rooms[name];
            let structureDict =  _.groupBy(room.find(FIND_STRUCTURES),
                                           (s:Structure) => s.structureType) as {[structureType: string]: Structure[]};
            Game.cache.structures[name] = structureDict;
        }
    }


    run() {
        Memory.preprocessing = {};
        this.cacheAssignments();
        this.cacheTargets();
        this.cacheStructures();
    }
}

// const profiler = require('screeps-profiler');
import profiler = require('./lib/screeps-profiler'); profiler.registerClass(Preprocessing, 'Preprocessing');
