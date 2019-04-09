import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {Colony} from '../../Colony';
import {SpawnGroup} from '../../logistics/SpawnGroup';
import { isString } from 'lodash';
import { MY_USERNAME } from '../../~settings';
import { log } from '../../console/log';


/**
 * Claims a new room and incubates it from the nearest (or specified) colony
 */
@profile
export class DirectiveIncubate extends Directive {

	static directiveName = 'incubate';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_WHITE;

	incubatee: Colony | undefined;

	constructor(flag: Flag) {
		super(flag, colony => colony.level >= 7);
		// Register incubation status
		this.incubatee = this.room ? Overmind.colonies[Overmind.colonyMap[this.room.name]] : undefined;
		if (this.incubatee) {
			this.incubatee.isIncubating = true;
			this.incubatee.spawnGroup = new SpawnGroup(this.incubatee);
		}
	}

	spawnMoarOverlords() {
		if (!this.incubatee) { // colony isn't claimed yet
			this.overlords.claim = new ClaimingOverlord(this);
		}
	}

	init() {

	}

	run() {
		if (this.incubatee) {
			if (this.incubatee.level >= 7 && this.incubatee.storage && this.incubatee.terminal) {
				this.remove();
			}
		}
		// if reserved or owned by Overmind user - throw warning but don't remove? Included code to remove, just commented out.
		if (isString(Game.rooms[this.pos.roomName].owner) && Game.rooms[this.pos.roomName].owner != MY_USERNAME && Assimilator.isAssimilated(Game.rooms[this.pos.roomName].owner!)) {
			log.warning(`${this.print} is in a room controlled by another Overmind user!`)
			//this.remove();
		}
	}
}
