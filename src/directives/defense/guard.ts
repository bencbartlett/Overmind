import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {GuardOverlord} from '../../overlords/defense/guard';
import {GuardSwarmOverlord} from '../../overlords/defense/guardSwarm';

interface DirectiveGuardMemory extends FlagMemory {
	safeTick?: number;
}

@profile
export class DirectiveGuard extends Directive {

	static directiveName = 'guard';
	static color = COLOR_RED;
	static secondaryColor = COLOR_BLUE;

	memory: DirectiveGuardMemory;

	private relocateFrequency: number;

	constructor(flag: Flag) {
		super(flag);
		if (this.colony.level >= GuardOverlord.requiredRCL) {
			this.overlords.guard = new GuardOverlord(this);
			// this.overlords.guardPair = new GuardPairOverlord(this);
		} else {
			this.overlords.swarmGuard = new GuardSwarmOverlord(this);
		}

		this.relocateFrequency = 10; // Relocate the flag to follow enemy movement every n ticks
	}

	init(): void {

	}

	run(): void {
		// Reloacate the flag
		if (Game.time % this.relocateFrequency == 0) {
			if (this.room && this.room.hostiles[0] && this.room.hostiles[0].pos.rangeToEdge >= 3) {
				this.setPosition(this.room.hostiles[0].pos);
			}
		}
		// If there are no hostiles left in the room...
		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			// If everyone's healed up, mark as safe
			if (_.filter(this.room.creeps, creep => creep.hits < creep.hitsMax).length == 0 && !this.memory.safeTick) {
				this.memory.safeTick = Game.time;
			}
			// If has been safe for more than 100 ticks, remove directive
			if (this.memory.safeTick && Game.time - this.memory.safeTick > 100) {
				this.remove();
			}
		} else {
			if (this.memory.safeTick) {
				delete this.memory.safeTick;
			}
		}
	}
}
