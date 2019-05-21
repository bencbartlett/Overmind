import {Colony} from '../../Colony';
import {log} from '../../console/log';
import {Roles} from '../../creepSetups/setups';
import {ClaimingOverlord} from '../../overlords/colonization/claimer';
import {PioneerOverlord} from '../../overlords/colonization/pioneer';
import {profile} from '../../profiler/decorator';
import {Cartographer, ROOMTYPE_CONTROLLER} from '../../utilities/Cartographer';
import {printRoomName} from '../../utilities/utils';
import {MY_USERNAME} from '../../~settings';
import {Directive} from '../Directive';


/**
 * Claims a new room and builds a spawn but does not incubate. Removes when spawn is constructed.
 */
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
		super(flag, colony => colony.level >= DirectiveColonize.requiredRCL
							  && colony.name != Directive.getPos(flag).roomName && colony.spawns.length > 0);
		// Register incubation status
		this.toColonize = this.room ? Overmind.colonies[Overmind.colonyMap[this.room.name]] : undefined;
		// Remove if misplaced
		if (Cartographer.roomType(this.pos.roomName) != ROOMTYPE_CONTROLLER) {
			log.warning(`${this.print}: ${printRoomName(this.pos.roomName)} is not a controller room; ` +
						`removing directive!`);
			this.remove(true);
		}
	}

	spawnMoarOverlords() {
		this.overlords.claim = new ClaimingOverlord(this);
		this.overlords.pioneer = new PioneerOverlord(this);
	}

	init() {
		this.alert(`Colonization in progress`);
	}

	run(verbose = false) {
		if (this.toColonize && this.toColonize.spawns.length > 0) {
			// Reassign all pioneers to be miners and workers
			const miningOverlords = _.map(this.toColonize.miningSites, site => site.overlords.mine);
			for (const pioneer of this.overlords.pioneer.pioneers) {
				const miningOverlord = miningOverlords.shift();
				if (miningOverlord) {
					if (verbose) {
						log.debug(`Reassigning: ${pioneer.print} to mine: ${miningOverlord.print}`);
					}
					pioneer.reassign(miningOverlord, Roles.drone);
				} else {
					if (verbose) {
						log.debug(`Reassigning: ${pioneer.print} to work: ${this.toColonize.overlords.work.print}`);
					}
					pioneer.reassign(this.toColonize.overlords.work, Roles.worker);
				}
			}
			// Remove the directive
			this.remove();
		}
		if (Game.time % 10 == 2 && this.room && !!this.room.owner && this.room.owner != MY_USERNAME) {
			log.notify(`Removing Colonize directive in ${this.pos.roomName}: room already owned by another player.`);
			this.remove();
		}
	}
}
