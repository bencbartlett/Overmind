// Preprocessing code to be run before animation of anything

import {profile} from './profiler/decorator';

@profile
export class GameCache implements ICache {

	overlords: { [overlord: string]: { [roleName: string]: string[] } };
	targets: { [ref: string]: string[] };
	// structures: { [roomName: string]: { [structureType: string]: Structure[] } };
	// constructionSites: { [roomName: string]: ConstructionSite[] };
	// drops: { [roomName: string]: { [resourceType: string]: Resource[] } };

	constructor() {
		this.overlords = {};
		this.targets = {};
		// this.structures = {};
		// this.constructionSites = {};
		// this.drops = {};
	}

	/* Generates a hash table for creeps assigned to each object: key: OLref, val: (key: role, val: names[]) */
	private cacheOverlords() {
		this.overlords = {};
		// keys: overlordRef, value: creepNames[]
		let creepNamesByOverlord = _.groupBy(_.keys(Game.creeps), name => Game.creeps[name].memory.overlord);
		for (let ref in creepNamesByOverlord) {
			// keys: roleName, value: creepNames[]
			this.overlords[ref] = _.groupBy(creepNamesByOverlord[ref], name => Game.creeps[name].memory.role);
		}
	}

	/* Generates a hash table for targets: key: TargetRef, val: targeting creep names*/
	private cacheTargets() {
		this.targets = {};
		for (let i in Game.creeps) {
			let creep = Game.creeps[i];
			let task = creep.memory.task;
			while (task) {
				if (!this.targets[task._target.ref]) this.targets[task._target.ref] = [];
				this.targets[task._target.ref].push(creep.name);
				task = task._parent;
			}
		}
	}

	// /* Generates a nested hash table for structure lookup: {[roomName], {[structureType]: Structures[]} */
	// private cacheStructures() {
	// 	this.structures = {};
	// 	for (let name in Game.rooms) {
	// 		this.structures[name] = _.groupBy(Game.rooms[name].find(FIND_STRUCTURES), s => s.structureType);
	// 	}
	// }
	//
	// /* Generates a nested hash table for structure lookup: {[roomName], {[structureType]: Structures[]} */
	// private cacheConstructionSites() {
	// 	this.constructionSites = {};
	// 	for (let name in Game.rooms) {
	// 		this.constructionSites[name] = Game.rooms[name].find(FIND_MY_CONSTRUCTION_SITES);
	// 	}
	// }
	//
	// /* Generates a nested hash table for drop lookup: {[roomName], {[resourceType]: drops[]} */
	// private cacheDrops() {
	// 	this.drops = {};
	// 	for (let name in Game.rooms) {
	// 		this.drops[name] = _.groupBy(Game.rooms[name].find(FIND_DROPPED_RESOURCES), r => r.resourceType);
	// 	}
	// }

	build() {
		this.cacheOverlords();
		this.cacheTargets();
		// this.cacheStructures();
		// this.cacheConstructionSites();
		// this.cacheDrops();
	}

	rebuild() {
		// Recache the cheap or critical stuff: Overlords, constructionSites, drops
		this.cacheOverlords();

	}
}

