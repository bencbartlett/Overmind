import {getOverlord, Overlord} from '../Overlord';
import {profile} from '../../profiler/decorator';
import {Colony} from '../../Colony';
import {Zerg} from '../../zerg/Zerg';
import {MinerSetup} from '../mining/miner';
import {DroneSetup} from '../mining/extractor';
import {getPosFromString} from '../../utilities/utils';


// This overlord contains the default actions for any creeps which lack an overlord (for example, miners whose
// miningSite is no longer visible, or guards with no directive)

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
		for (let zerg of this.idleZerg) {
			// Miners and extractors go to their respective sources/extractors if they lack vision
			if (zerg.roleName == MinerSetup.role || zerg.roleName == DroneSetup.role) {
				let destination = getPosFromString(zerg.memory.overlord);
				if (destination) {
					zerg.goTo(destination);
				}
			}
		}
	}
}
