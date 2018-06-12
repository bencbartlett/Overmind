import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {Colony} from '../../Colony';
import {PioneerOverlord} from '../../overlords/colonization/pioneer';
import {MinerSetup, MiningOverlord} from '../../overlords/core/miner';
import {WorkerSetup} from '../../overlords/core/worker';

// Claims a new room and builds a spawn but does not incubate. Removes when spawn is constructed.

@profile
export class DirectiveColonize extends Directive {

	static directiveName = 'colonize';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_GREY;
	static requiredRCL = 3;

	toColonize: Colony | undefined;
	overlords: {
		claim: ClaimingOverlord;
		pioneer: PioneerOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
		// Register incubation status
		this.toColonize = this.room ? Overmind.colonies[Overmind.colonyMap[this.room.name]] : undefined;
		this.overlords.claim = new ClaimingOverlord(this);
		this.overlords.pioneer = new PioneerOverlord(this);
	}

	init() {

	}

	run() {
		if (this.toColonize && this.toColonize.spawns.length > 0) {
			// Reassign all pioneers to be miners and workers
			let miningOverlords = _.map(this.toColonize.miningSites, site => site.overlord) as MiningOverlord[];
			for (let pioneer of this.overlords.pioneer.pioneers) {
				let miningOverlord = miningOverlords.shift();
				if (miningOverlord) {
					pioneer.memory.role = MinerSetup.role;
					pioneer.overlord = miningOverlord;
				} else {
					pioneer.memory.role = WorkerSetup.role;
					pioneer.overlord = this.toColonize.overlords.work;
				}
			}
			// Remove the directive
			this.remove();
		}
	}
}
