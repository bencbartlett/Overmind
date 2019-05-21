import {Colony} from '../../Colony';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {getOverlord, Overlord} from '../Overlord';

/**
 * This overlord contains the default actions for any creeps which lack an overlord (for example, miners whose
 * miningSite is no longer visible, or guards with no directive)
 */
@profile
export class DefaultOverlord extends Overlord {

	idleZerg: Zerg[];

	constructor(colony: Colony) {
		super(colony, 'default', OverlordPriority.default);
		this.idleZerg = [];
	}

	init() {
		// Zergs are collected at end of init phase; by now anything needing to be claimed already has been
		const idleCreeps = _.filter(this.colony.creeps, creep => !getOverlord(creep));
		this.idleZerg = _.map(idleCreeps, creep => Overmind.zerg[creep.name] || new Zerg(creep));
		for (const zerg of this.idleZerg) {
			zerg.refresh();
		}
	}

	run() {

	}
}
