import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {log} from '../../lib/logger/log';

@profile
export class DirectiveNukeResponse extends Directive {

	static directiveName = 'nukeResponse';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_BLUE;
	static requiredRCL = 4;

	nuke: Nuke | undefined;
	room: Room;

	constructor(flag: Flag) {
		super(flag, DirectiveNukeResponse.requiredRCL);
		this.nuke = this.pos.lookFor(LOOK_NUKES)[0]; // TODO: needs to handle multiple nukes on same pos
	}

	init(): void {

	}

	run(): void {
		// Build ramparts at all positions affected by nukes with structures on them
		if (Game.time % 50 == 0) {
			if (this.nuke) {
				let rampartPositions = _.filter(this.nuke.pos.getPositionsInRange(2), function (pos) {
					// Rampart should be built to protect all non-road, non-barrier structures in nuke range
					return _.filter(pos.lookFor(LOOK_STRUCTURES),
									s => s.structureType != STRUCTURE_ROAD &&
										 s.structureType != STRUCTURE_RAMPART &&
										 s.structureType != STRUCTURE_WALL).length > 0;
				});
				for (let pos of rampartPositions) {
					// Build a rampart if there isn't one already
					if (!pos.lookForStructure(STRUCTURE_RAMPART)) {
						pos.createConstructionSite(STRUCTURE_RAMPART);
					}
				}
				log.alert(`Incoming nuke at ${this.nuke.pos.print}! Time until impact: ${this.nuke.timeToLand}`);
			} else {
				// Remove once nuke is gone
				this.remove();
			}
		}
	}
}
