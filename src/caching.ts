// Preprocessing code to be run before animation of anything

import {profile} from './lib/Profiler';

@profile
export class GameCache implements ICache {
	// assignments: { [ref: string]: { [roleName: string]: string[] } };
	overlords: { [overlord: string]: { [roleName: string]: string[] } };
	targets: { [ref: string]: string[] };
	// objectives: { [ref: string]: string[] };
	structures: { [roomName: string]: { [structureType: string]: Structure[] } };
	constructionSites: { [roomName: string]: ConstructionSite[] };
	structureSites: { [roomName: string]: ConstructionSite[] };
	roadSites: { [roomName: string]: ConstructionSite[] };
	drops: { [roomName: string]: { [resourceType: string]: Resource[] } };

	constructor() {
		// this.assignments = {};
		this.overlords = {};
		this.targets = {};
		// this.objectives = {};
		this.structures = {};
		this.constructionSites = {};
		this.structureSites = {};
		this.roadSites = {};
		this.drops = {};
	}

	// /* Generates a hash table for creeps assigned to each object: key: assignmentRef, val: (key: role, val: names[]) */
	// private cacheAssignments() {
	// 	let namesByAssignment = _.groupBy(_.keys(Game.creeps), name => Game.creeps[name].memory.assignmentRef);
	// 	for (let ref in namesByAssignment) {
	// 		this.assignments[ref] = _.groupBy(namesByAssignment[ref], name => Game.creeps[name].memory.role);
	// 	}
	// }

	/* Generates a hash table for creeps assigned to each object: key: assignmentRef, val: (key: role, val: names[]) */
	private cacheOverlords() {
		let creepNamesByOverlord = _.groupBy(_.keys(Game.creeps), name => Game.creeps[name].memory.overlord);
		for (let name in creepNamesByOverlord) {
			this.overlords[name] = _.groupBy(creepNamesByOverlord[name], name => Game.creeps[name].memory.role);
		}
	}

	/* Generates a hash table for targets: key: TargetRef, val: targeting creep names*/
	private cacheTargets() {
		this.targets = _.groupBy(_.keys(Game.creeps), name => Game.creeps[name].memory.task ?
															  Game.creeps[name].memory.task!._target.ref : null);
		// for (let ref in namesByTarget) {
		// 	this.targets[ref] = _.groupBy(namesByTarget[ref], name => Game.creeps[name].memory.role);
		// }
	}

	// /* Generates a hash table for objective handling: key: objective ID, val: handling creep names */
	// private cacheObjectives() {
	// 	this.objectives = _.groupBy(_.keys(Game.creeps), name => Game.creeps[name].memory.objectiveRef);
	// }

	/* Generates a nested hash table for structure lookup: {[roomName], {[structureType]: Structures[]} */
	private cacheStructures() {
		for (let name in Game.rooms) {
			this.structures[name] = _.groupBy(Game.rooms[name].find(FIND_STRUCTURES), s => s.structureType);
		}
	}

	/* Generates a nested hash table for structure lookup: {[roomName], {[structureType]: Structures[]} */
	private cacheConstructionSites() {
		for (let name in Game.rooms) {
			this.constructionSites[name] = Game.rooms[name].find(FIND_CONSTRUCTION_SITES);
			this.structureSites[name] = _.filter(this.constructionSites[name], s => s.structureType != STRUCTURE_ROAD);
			this.roadSites[name] = _.filter(this.constructionSites[name], s => s.structureType == STRUCTURE_ROAD);
		}

	}

	/* Generates a nested hash table for drop lookup: {[roomName], {[resourceType]: drops[]} */
	private cacheDrops() {
		for (let name in Game.rooms) {
			this.drops[name] = _.groupBy(Game.rooms[name].find(FIND_DROPPED_RESOURCES), r => r.resourceType);
		}
	}

	build() {
		this.rebuild();
	}

	rebuild() {
		// this.cacheAssignments();
		this.cacheOverlords();
		this.cacheTargets();
		// this.cacheObjectives();
		this.cacheStructures();
		this.cacheConstructionSites();
		this.cacheDrops();
	}
}

//
// export class Preprocessing {
// 	constructor() {
// 		Game.cache = {
// 			assignments      : {},
// 			targets          : {},
// 			objectives       : {},
// 			structures       : {},
// 			drops            : {},
// 			constructionSites: {},
// 		};
// 	}
//
// 	/* Generates a hash table for creeps assigned to each object: key: role, val: name */
// 	cacheAssignments() {
// 		for (let name in Game.creeps) {
// 			let creep = Game.creeps[name];
// 			let assignmentRef = creep.memory.assignmentRef;
// 			if (assignmentRef) {
// 				if (!Game.cache.assignments[assignmentRef]) {
// 					Game.cache.assignments[assignmentRef] = {};
// 				}
// 				if (!Game.cache.assignments[assignmentRef][creep.memory.role]) {
// 					Game.cache.assignments[assignmentRef][creep.memory.role] = [];
// 				}
// 				Game.cache.assignments[assignmentRef][creep.memory.role].push(name);
// 			}
// 		}
// 	}
//
// 	/* Generates a hash table for targets: key: TargetRef, val: targeting creep names*/
// 	cacheTargets() {
// 		for (let name in Game.creeps) {
// 			let creep = Game.creeps[name];
// 			if (creep.memory.task && creep.memory.task._target && creep.memory.task._target.ref) {
// 				let targetRef = creep.memory.task._target.ref;
// 				if (!Game.cache.targets[targetRef]) {
// 					Game.cache.targets[targetRef] = [];
// 				}
// 				Game.cache.targets[targetRef].push(name);
// 			}
// 		}
// 	}
//
// 	/* Generates a hash table for objective handling: key: objective ID, val: handling creep names */
// 	cacheObjectives() {
// 		for (let name in Game.creeps) {
// 			let creep = Game.creeps[name];
// 			if (creep.memory.objectiveRef) {
// 				if (!Game.cache.objectives[creep.memory.objectiveRef]) {
// 					Game.cache.objectives[creep.memory.objectiveRef] = [];
// 				}
// 				Game.cache.objectives[creep.memory.objectiveRef].push(name);
// 			}
// 		}
// 	}
//
// 	/* Generates a nested hash table for structure lookup: {[roomName], {[structureType]: Structures[]} */
// 	cacheStructures() {
// 		for (let name in Game.rooms) {
// 			let room = Game.rooms[name];
// 			let structureDict = _.groupBy(room.find(FIND_STRUCTURES),
// 										  (s: Structure) => s.structureType) as { [structureType: string]: Structure[] };
// 			Game.cache.structures[name] = structureDict;
// 		}
// 	}
//
// 	/* Generates a nested hash table for drop lookup: {[roomName], {[resourceType]: drops[]} */
// 	cacheDrops() {
// 		for (let name in Game.rooms) {
// 			let room = Game.rooms[name];
// 			let dropDict = _.groupBy(room.find(FIND_DROPPED_RESOURCES),
// 									 (r: Resource) => r.resourceType) as { [resourceType: string]: Resource[] };
// 			Game.cache.drops[name] = dropDict;
// 		}
// 	}
//
//
// 	run() {
// 		this.cacheAssignments();
// 		this.cacheTargets();
// 		this.cacheStructures();
// 		this.cacheDrops();
// 	}
// }

// export function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
// 	// let value: any;
// 	let originalGet = descriptor.get;
//
// 	descriptor.get = function () {
// 		if (!this.hasOwnProperty('__memoized__')) {
// 			Object.defineProperty(this, '__memoized__', {value: new Map()});
// 		}
//
// 		return this.__memoized__.has(propertyKey) ?
// 			   this.__memoized__.get(propertyKey) :
// 			   (() => {
// 				   const value = originalGet.call(this);
// 				   this.__memoized__.set(propertyKey, value);
// 				   return value;
// 			   })();
// 	};
// }

