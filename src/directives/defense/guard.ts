import {GuardSwarmOverlord} from '../../overlords/defense/guardSwarm';
import {DefenseNPCOverlord} from '../../overlords/defense/npcDefense';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';

interface DirectiveGuardMemory extends FlagMemory {
	safeTick?: number;
	enhanced?: boolean;
}

/**
 * NPC defense directive for outpost rooms with invaders
 */
@profile
export class DirectiveGuard extends Directive {

	static directiveName = 'guard';
	static color = COLOR_BLUE;
	static secondaryColor = COLOR_BLUE;

	memory: DirectiveGuardMemory;

	constructor(flag: Flag) {
		super(flag);
	}

	spawnMoarOverlords() {
		if (this.colony.level >= DefenseNPCOverlord.requiredRCL) {
			// if (this.memory.enhanced || this.name.includes('enhanced')) {
			// 	this.overlords.guardPair = new GuardPairOverlord(this);
			// } else {
			this.overlords.guard = new DefenseNPCOverlord(this);
			// }
		} else {
			this.overlords.swarmGuard = new GuardSwarmOverlord(this);
		}
	}

	init(): void {

	}

	run(): void {
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
