import {Directive} from './Directive';
import {profile} from '../lib/Profiler';
import {GuardOverlord} from '../overlords/overlord_guard';

@profile
export class DirectiveGuard extends Directive {

	static directiveName = 'guard';
	static color = COLOR_RED;
	static secondaryColor = COLOR_BLUE;

	private relocateFrequency: number;

	constructor(flag: Flag) {
		super(flag);
		this.overlords.guard = new GuardOverlord(this);
		this.relocateFrequency = 10; // Relocate the flag to follow enemy movement every n ticks
	}

	init(): void {

	}

	run(): void {
		// Reloacate the flag
		if (Game.time % this.relocateFrequency == 0) {
			if (this.room && this.room.hostiles[0]) {
				this.setPosition(this.room.hostiles[0].pos);
			}
		}
		// If there are no hostiles left in the room and everyone's healed, then remove the flag
		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			if (_.filter(this.room.creeps, creep => creep.hits < creep.hitsMax).length == 0) {
				this.remove();
			}
		}
	}
}
