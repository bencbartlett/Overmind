import {Directive} from './Directive';
import {ClaimerSetup} from '../roles/claimer';
import {profileClass} from '../profiling';

export class DirectiveIncubate extends Directive {
	incubator: IColony;
	claimers: ICreep[];

	static directiveName = 'incubate';
	static colorCode = {
		color         : COLOR_PURPLE,
		secondaryColor: COLOR_WHITE,
	};

	constructor(flag: Flag) {
		super(flag);
		let incubatingColonyName = this.name.split(':')[1];
		this.incubator = Overmind.Colonies[incubatingColonyName];
		this.claimers = this.getAssignedCreeps('claimer');
		if (this.colony) {
			// Register incubation status
			this.colony.incubator = this.incubator;
			// Reassign the hatchery if needed
			if (!this.colony.hatchery && this.incubator.hatchery) {
				this.colony.hatchery = this.incubator.hatchery;
			}
		} else {
			// Assign the incubator's overlord to take care of this directive until colony is made
			this.assignedTo = this.incubator.name;
		}
	}

	init(): void {
		// If the room is isn't (visible and has controller and I own it) then proceed
		if (!(this.room && this.room.controller && this.room.controller.my)) {
			// If the flag is assigned to a colony and there aren't any claimers already, then spawn one
			if (this.claimers.length < 1 && this.incubator && this.incubator.hatchery) {
				this.incubator.hatchery.enqueue(
					new ClaimerSetup().create(this.incubator, {
						assignment            : this.flag,
						patternRepetitionLimit: 1,
					}));
			}
		}
	}

	run(): void {
		// No runtime logic
		return;
	}
}

profileClass(DirectiveIncubate);
