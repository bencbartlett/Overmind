import {profile} from '../profiler/decorator';
import {DirectiveOutpost} from '../directives/colony/outpost';
import {DirectiveSKOutpost} from '../directives/colony/outpostSK';

/**
 * GameCache does initial low-level preprocessing before each tick is run
 */
@profile
export class GameCache implements ICache {

	overlords: { [overlord: string]: { [roleName: string]: string[] } };
	creepsByColony: { [colonyName: string]: Creep[] };
	targets: { [ref: string]: string[] };
	outpostFlags: Flag[];

	constructor() {
		this.overlords = {};
		this.creepsByColony = {};
		this.targets = {};
		this.outpostFlags = _.filter(Game.flags, flag => DirectiveOutpost.filter(flag)
														 || DirectiveSKOutpost.filter(flag));
	}

	private cacheCreepsByColony() {
		this.creepsByColony = _.groupBy(Game.creeps, creep => creep.memory[_MEM.COLONY]) as { [colName: string]: Creep[] };
	}

	/**
	 * Generates a hash table for creeps assigned to each object: key: OLref, val: (key: role, val: names[])
	 */
	private cacheOverlords() {
		this.overlords = {};
		// keys: overlordRef, value: creepNames[]
		let creepNamesByOverlord = _.groupBy(_.keys(Game.creeps), name => Game.creeps[name].memory[_MEM.OVERLORD]);
		for (let ref in creepNamesByOverlord) {
			// keys: roleName, value: creepNames[]
			this.overlords[ref] = _.groupBy(creepNamesByOverlord[ref], name => Game.creeps[name].memory.role);
		}
	}

	/**
	 * Generates a hash table for targets: key: TargetRef, val: targeting creep names
	 */
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

	build() {
		this.cacheCreepsByColony();
		this.cacheOverlords();
		this.cacheTargets();
	}

	refresh() {
		this.cacheCreepsByColony();
		this.cacheOverlords();
		this.cacheTargets();
	}
}




