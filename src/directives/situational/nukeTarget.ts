import {log} from '../../console/log';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';

/**
 * Launches nuke at target location
 */
@profile
export class DirectiveNukeTarget extends Directive {

	static directiveName = 'nukeTarget';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_RED;

	static requiredRCL = 8;

	nuke: Nuke | undefined;
	room: Room;

	// TODO add sending multiple nukes and spacing the nukes out by x amount

	constructor(flag: Flag) {
		super(flag, (colony) => !!colony.nuker && !(colony.nuker.cooldown > 0)
								&& Game.map.getRoomLinearDistance(colony.room.name, flag.pos.roomName) <= 10);
		this.refresh();
	}

	refresh() {
		super.refresh();
	}

	spawnMoarOverlords() {

	}

	init(): void {
	}

	run(): void {
		if (this.colony.nuker && this.colony.nuker.cooldown == 0) {
			const res = this.colony.nuker.launchNuke(this.flag.pos);
			if (res == OK) {
				log.notify(`Launching nuclear strike at ${this.flag.pos.print}, ETA ${Game.time + NUKE_LAND_TIME}`);
				this.remove();
			}
		} else if (!this.colony.nuker || this.colony.nuker.cooldown > 0) {
			log.error(`DirectiveNuke unable to fire from ${this.colony.name} due to nuker ${this.colony.nuker} ` +
					  `being unavailable: ${this.print}`);
			this.remove();
		}
	}
}
