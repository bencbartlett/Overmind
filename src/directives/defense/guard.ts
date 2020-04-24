import {GuardSwarmOverlord} from '../../overlords/defense/guardSwarm';
import {DefenseNPCOverlord} from '../../overlords/defense/npcDefense';
import {profile} from '../../profiler/decorator';
import {Directive} from '../Directive';
import {NotifierPriority} from '../Notifier';

interface DirectiveGuardMemory extends FlagMemory {
	enhanced?: boolean;
	invaderCore?: boolean;
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
		if (this.room && this.room.invaderCore) {
			this.memory.invaderCore = true;
		}
		if (this.memory.invaderCore) {
			this.alert(`Attacking invader core`, NotifierPriority.Low);
		}
	}

	run(): void {
		// If there are no hostiles or hostiles structures left in the room, possibly remove
		if (this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			// If everyone's healed up and the room is safe, remove
			const creepsNeedingHealing = _.filter(this.room.creeps, creep => creep.hits < creep.hitsMax);
			if (creepsNeedingHealing.length == 0 && this.room.isSafe) {
				this.remove();
			}
		}
	}
}
