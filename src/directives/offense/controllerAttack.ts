import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {StationaryScoutOverlord} from '../../overlords/scouting/stationary';
import {ControllerAttackerOverlord} from '../../overlords/offense/controllerAttacker';
import {log} from '../../console/log';

/**
 * Attack a controller, downgrading it to level 0
 */
@profile
export class DirectiveControllerAttack extends Directive {

	static directiveName = 'controllerAttack';
	static color = COLOR_RED;
	static secondaryColor = COLOR_PURPLE;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		this.overlords.scout = new StationaryScoutOverlord(this); // TODO: Not have a scout at all times
		this.overlords.controllerAttack = new ControllerAttackerOverlord(this);
	}

	init(): void {
		let level: string = this.room && this.room.controller ? this.room.controller.level.toString() : '???';
		this.alert(`Downgrading controller (RCL${level})`);
	}

	run(): void {
		if (this.room && this.room.controller && this.room.controller.level == 0) {
			log.notify(`Removing ${this.name} since controller has reached level 0.`);
			this.remove();
		}
	}
}

