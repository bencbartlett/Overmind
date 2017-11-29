import {Directive} from './Directive';
import {ReserverSetup} from '../roles/reserver';

export class DirectiveOccupy extends Directive {

	reserveBuffer: number;
	reservers: ICreep[];
	colony: IColony; 		// Occupied rooms definitely have a colony

	static directiveName = 'occupy';
	static colorCode = {
		color         : COLOR_PURPLE,
		secondaryColor: COLOR_PURPLE,
	};

	constructor(flag: Flag) {
		super(flag);
		this.reserveBuffer = 3000; // Reserve rooms until this amount is reached
		this.reservers = this.getAssignedCreeps('reserver');
	}

	init(): void {
		// Request reservers if this is an unowned room (outpost)
		if (this.room && this.room.controller && !this.room.controller.my) {
			let c = this.room.controller;
			if (!c.reservation || (c.reservedByMe && c.reservation.ticksToEnd < this.reserveBuffer)) {
				if (this.reservers.length == 0 && this.colony.hatchery) {
					this.colony.hatchery.enqueue(
						new ReserverSetup().create(this.colony, {
							assignment            : this.flag,
							patternRepetitionLimit: 4,
						}));
				}
			}
		}
	}

	run(): void {
		// No runtime logic
		return;
	}
}