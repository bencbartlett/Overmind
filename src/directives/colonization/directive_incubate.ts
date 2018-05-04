import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {ClaimingOverlord} from '../../overlords/colonization/overlord_claim';
import {Colony, ColonyStage} from '../../Colony';

// Claims a new room and incubates it from the nearest (or specified) colony

@profile
export class DirectiveIncubate extends Directive {

	static directiveName = 'incubate';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_WHITE;
	static requiredRCL = 7;

	incubatee: Colony | undefined; // the colony being incubated by the incubator

	constructor(flag: Flag) {
		super(flag);
		// Register incubation status
		this.incubatee = this.room ? Overmind.Colonies[Overmind.colonyMap[this.room.name]] : undefined;
		if (this.incubatee && this.colony != this.incubatee) {
			// this.colony is from Flag memory and is the incubator; this.room.colony is the new colony
			this.incubatee.incubator = this.colony;
			this.incubatee.isIncubating = true;
			this.colony.incubatingColonies.push(this.incubatee);
			if (!this.incubatee.hatchery && this.colony.hatchery) {
				this.incubatee.hatchery = this.colony.hatchery;
			}
		}
		this.overlords.claim = new ClaimingOverlord(this);
	}

	init() {

	}

	run() {
		// Incubation directive gets removed once the colony has a command center (storage)
		if (!this.memory.persistent && this.incubatee && this.incubatee.stage > ColonyStage.Larva) {
			this.remove();
		}
		// // You can set memory.onlyBuildSpawn = true to remove the flag once spawn is built, skipping incubation
		// if (this.memory.onlyBuildSpawn && this.incubatee && this.incubatee.spawns.length > 0) {
		// 	this.remove();
		// }
	}
}
