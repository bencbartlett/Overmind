import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {GuardSwarmOverlord} from '../../overlords/defense/guardSwarm';

interface DirectiveGuardSwarmMemory extends FlagMemory {
	persistent?: boolean;
	created: number;
	amount?: number;
}

@profile
export class DirectiveGuardSwarm extends Directive {

	static directiveName = 'guardSwarm';
	static color = COLOR_RED;
	static secondaryColor = COLOR_PURPLE;

	memory: DirectiveGuardSwarmMemory;

	private relocateFrequency: number;

	constructor(flag: Flag) {
		super(flag);
		this.overlords.guard = new GuardSwarmOverlord(this);
	}

	init(): void {

	}

	run(): void {
		// If there are no hostiles left in the room and everyone's healed, then remove the flag
		if (Game.time - this.memory.created > 100 &&
			this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			if (_.filter(this.room.creeps, creep => creep.hits < creep.hitsMax).length == 0) {
				this.remove();
			}
		}
	}
}
