import {getOverlord, Overlord} from '../Overlord';
import {profile} from '../../profiler/decorator';
import {Colony} from '../../Colony';
import {Zerg} from '../../zerg/Zerg';

@profile
export class DefaultOverlord extends Overlord {

	idleZerg: Zerg[];

	constructor(colony: Colony) {
		super(colony, 'default', Infinity);
		this.idleZerg = [];
	}

	init() {
		// Zergs are collected at end of init phase; by now anything needing to be claimed already has been
		let idleCreeps = _.filter(this.colony.creeps, creep => !getOverlord(creep));
		this.idleZerg = _.map(idleCreeps, creep => new Zerg(creep));
	}

	run() {

	}
}
