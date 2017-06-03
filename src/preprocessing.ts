// Preprocessing code to be run before animation of anything

export class Preprocessing {
	constructor() {
		Game.cache = {
			assignments      : {},
			targets          : {},
			objectives       : {},
			structures       : {},
			drops            : {},
			constructionSites: {},
		};
	}

	/* Generates a hash table for creeps assigned to each object: key: role, val: name */
	cacheAssignments() {
		for (let name in Game.creeps) {
			let creep = Game.creeps[name];
			let assignmentRef = creep.memory.assignmentRef;
			if (assignmentRef) {
				if (!Game.cache.assignments[assignmentRef]) {
					Game.cache.assignments[assignmentRef] = {};
				}
				if (!Game.cache.assignments[assignmentRef][creep.memory.role]) {
					Game.cache.assignments[assignmentRef][creep.memory.role] = [];
				}
				Game.cache.assignments[assignmentRef][creep.memory.role].push(name);
			}
		}
	}

	/* Generates a hash table for targets: key: TargetRef, val: targeting creep names*/
	cacheTargets() {
		for (let name in Game.creeps) {
			let creep = Game.creeps[name];
			if (creep.memory.task && creep.memory.task._target && creep.memory.task._target.ref) {
				let targetRef = creep.memory.task._target.ref;
				if (!Game.cache.targets[targetRef]) {
					Game.cache.targets[targetRef] = [];
				}
				Game.cache.targets[targetRef].push(name);
			}
		}
	}

	/* Generates a hash table for objective handling: key: objective ID, val: handling creep names */
	cacheObjectives() {
		for (let name in Game.creeps) {
			let creep = Game.creeps[name];
			if (creep.memory.objective) {
				if (!Game.cache.objectives[creep.memory.objective]) {
					Game.cache.objectives[creep.memory.objective] = [];
				}
				Game.cache.objectives[creep.memory.objective].push(name);
			}
		}
	}

	/* Generates a nested hash table for structure lookup: {[roomName], {[structureType]: Structures[]} */
	cacheStructures() {
		for (let name in Game.rooms) {
			let room = Game.rooms[name];
			let structureDict = _.groupBy(room.find(FIND_STRUCTURES),
										  (s: Structure) => s.structureType) as { [structureType: string]: Structure[] };
			Game.cache.structures[name] = structureDict;
		}
	}

	/* Generates a nested hash table for drop lookup: {[roomName], {[resourceType]: drops[]} */
	cacheDrops() {
		for (let name in Game.rooms) {
			let room = Game.rooms[name];
			let dropDict = _.groupBy(room.find(FIND_DROPPED_RESOURCES),
									 (r: Resource) => r.resourceType) as { [resourceType: string]: Resource[] };
			Game.cache.drops[name] = dropDict;
		}
	}


	run() {
		this.cacheAssignments();
		this.cacheTargets();
		this.cacheStructures();
		this.cacheDrops();
	}
}

// const profiler = require('screeps-profiler');
import profiler = require('./lib/screeps-profiler');
profiler.registerClass(Preprocessing, 'Preprocessing');
