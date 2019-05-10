import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {NotifierPriority} from '../Notifier';

/**
 * Nuke response: automatically over-fortify ramparts to withstand an incoming nuclear strike
 */
@profile
export class DirectiveNukeResponse extends Directive {

	static directiveName = 'nukeResponse';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_BLUE;

	static requiredRCL = 4;

	nuke: Nuke | undefined;
	room: Room;

	constructor(flag: Flag) {
		super(flag, colony => colony.name == Directive.getPos(flag).roomName
							  && colony.level >= DirectiveNukeResponse.requiredRCL);
		this.refresh();
	}

	refresh() {
		super.refresh();
		this.nuke = this.pos.lookFor(LOOK_NUKES)[0]; // TODO: needs to handle multiple nukes on same pos
	}

	spawnMoarOverlords() {

	}

	init(): void {
		if (this.nuke) {
			this.alert(`Nuclear impact in ${this.nuke.timeToLand}`, NotifierPriority.Critical);
		} else {
			this.alert(`Nuke response directive active!`, NotifierPriority.Critical);
		}
	}

	run(): void {
		// Build ramparts at all positions affected by nukes with structures on them
		if (Game.time % 50 == 0) {
			if (this.nuke) {
				const rampartPositions = _.filter(this.nuke.pos.getPositionsInRange(2), function(pos) {
					// Rampart should be built to protect all non-road, non-barrier structures in nuke range
					return _.filter(pos.lookFor(LOOK_STRUCTURES),
									s => s.structureType != STRUCTURE_ROAD &&
										 s.structureType != STRUCTURE_RAMPART &&
										 s.structureType != STRUCTURE_WALL).length > 0;
				});
				for (const pos of rampartPositions) {
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
