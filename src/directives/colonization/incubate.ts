import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {ClaimingOverlord} from '../../overlords/colonization/claimer';
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
		super(flag, DirectiveIncubate.requiredRCL);
		// Register incubation status
		this.incubatee = this.room ? Overmind.colonies[Overmind.colonyMap[this.room.name]] : undefined;
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
		if (!this.memory.persistent && this.incubatee) {
			if (this.colony.stage == ColonyStage.Adult) { // if incubator is an adult, incubate colony to adulthood
				if (this.incubatee.stage == ColonyStage.Adult) {
					this.remove();
				}
			} else { // otherwise remove once storage is built
				if (this.incubatee.stage > ColonyStage.Larva) {
					this.remove();
				}
			}
		}
	}
}
