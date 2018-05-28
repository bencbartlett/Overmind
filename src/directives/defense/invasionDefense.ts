import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {ArcherDefenseOverlord} from '../../overlords/defense/archer';
import {ColonyStage} from '../../Colony';
import {RampartDefenseOverlord} from '../../overlords/defense/rampartDefense';
import {log} from '../../lib/logger/log';

interface DirectiveInvasionDefenseMemory extends FlagMemory {
	persistent?: boolean;
	created: number;
}

@profile
export class DirectiveInvasionDefense extends Directive {

	static directiveName = 'invasionDefense';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_RED;
	static requiredRCL = 3;

	memory: DirectiveInvasionDefenseMemory;
	room: Room;

	private relocateFrequency: number;

	constructor(flag: Flag) {
		super(flag, DirectiveInvasionDefense.requiredRCL);
		let bigInvaders = _.filter(this.room.hostiles, hostile => hostile.body.length >= 30);
		let boostedInvasion = _.filter(bigInvaders, invader => invader.boosts.length > 0).length > 0;
		let percentWalls = _.filter(this.room.barriers, s => s.structureType == STRUCTURE_WALL).length /
						   this.room.barriers.length;
		let meleeHostiles = _.filter(this.room.hostiles, hostile => hostile.getActiveBodyparts(ATTACK) > 0 ||
																	hostile.getActiveBodyparts(WORK) > 0);
		let rangedHostiles = _.filter(this.room.hostiles, hostile => hostile.getActiveBodyparts(RANGED_ATTACK) > 0);
		if (this.colony.stage > ColonyStage.Larva && percentWalls > 0.5) {
			this.overlords.archer = new ArcherDefenseOverlord(this, boostedInvasion);
		} else if (meleeHostiles.length > 0) {
			this.overlords.rampartDefense = new RampartDefenseOverlord(this, boostedInvasion);
		} else {
			log.warning(`No overlord!`);
		}
	}

	init(): void {

	}

	run(): void {
		// If there are no hostiles left in the room and everyone's healed, then remove the flag
		if (!this.memory.persistent && Game.time - this.memory.created > 100 &&
			this.room && this.room.hostiles.length == 0 && this.room.hostileStructures.length == 0) {
			if (_.filter(this.room.creeps, creep => creep.hits < creep.hitsMax).length == 0) {
				this.remove();
			}
		}
	}
}
