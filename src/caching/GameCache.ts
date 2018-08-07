// Preprocessing code to be run before animation of anything

import {profile} from '../profiler/decorator';
import {DirectiveOutpost} from '../directives/core/outpost';
import {DirectiveSKOutpost} from '../directives/core/outpostSK';

@profile
export class GameCache implements ICache {

	overlords: { [overlord: string]: { [roleName: string]: string[] } };
	targets: { [ref: string]: string[] };
	outpostFlags: Flag[];

	constructor() {
		this.overlords = {};
		this.targets = {};
		this.outpostFlags = _.filter(Game.flags, flag => DirectiveOutpost.filter(flag)
														 || DirectiveSKOutpost.filter(flag));
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

	build() {
		this.cacheOverlords();
		this.cacheTargets();
	}

	rebuild() {
		// Recache the cheap or critical stuff: Overlords, constructionSites, drops
		this.cacheOverlords();

	}
}




