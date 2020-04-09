import {Colony} from '../../Colony';
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

	static requiredRCL = 6;

	nukes: Nuke[];
	room: Room;

	constructor(flag: Flag) {
		super(flag, colony => colony.name == Directive.getPos(flag).roomName
							  && colony.level >= DirectiveNukeResponse.requiredRCL);
		this.refresh();
	}

	refresh() {
		super.refresh();
		this.nukes = this.room.find(FIND_NUKES);
		if (this.nukes.length > 0) {
			this.colony.state.isBeingNuked = true;
		}
	}

	spawnMoarOverlords() {

	}

	init(): void {
		for (const nuke of this.nukes) {
			this.alert(`Nuclear impact in ${nuke.timeToLand}`, NotifierPriority.Critical);
		}
	}

	/**
	 * Returns whether a position should be reinforced or not
	 */
	static shouldReinforceLocation(pos: RoomPosition): boolean {
		const dontReinforce: StructureConstant[] = [STRUCTURE_ROAD, STRUCTURE_RAMPART, STRUCTURE_WALL];
		const colony = Overmind.colonies[pos.roomName];
		if (colony && colony.assets.energy < 200000) {
			dontReinforce.push(STRUCTURE_EXTENSION);
		}
		return _.filter(pos.lookFor(LOOK_STRUCTURES), s => !_.contains(dontReinforce, s.structureType)).length > 0;
	}

	run(): void {
		// Build ramparts at all positions affected by nukes with structures on them
		if (Game.time % 50 == 0) {
			if (this.nukes.length > 0) {
				for (const nuke of this.nukes) {
					const rampartPositions = _.filter(nuke.pos.getPositionsInRange(2),
													  pos => DirectiveNukeResponse.shouldReinforceLocation(pos));
					for (const pos of rampartPositions) {
						// Build a rampart if there isn't one already
						if (!pos.lookForStructure(STRUCTURE_RAMPART)) {
							pos.createConstructionSite(STRUCTURE_RAMPART);
						}
					}
					log.alert(`Incoming nuke at ${nuke.pos.print}! Time until impact: ${nuke.timeToLand}`);
				}
			} else {
				// Remove once nuke is gone
				this.remove();
			}
		}
	}
}
