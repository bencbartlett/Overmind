import {Directive} from './Directive';
import {profile} from '../lib/Profiler';
import {GuardOverlord} from '../overlords/overlord_guard';

@profile
export class DirectiveGuard extends Directive {

	static directiveName = 'guard';
	static color = COLOR_RED;
	static secondaryColor = COLOR_BLUE;

	constructor(flag: Flag) {
		super(flag);
		this.overlords.guard = new GuardOverlord(this);
	}

	init(): void {
		// this.initOverlords();
	}

	run(): void {
		// this.runOverlords();
		// If there are no hostiles left in the room, remove the flag
		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) { // TODO: wait until everyone's healed too
			this.remove();
		}
	}
}
