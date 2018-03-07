import {Directive} from '../Directive';
import {profile} from '../../lib/Profiler';
import {ArcherDefenseOverlord} from '../../overlords/combat/overlord_archer';

interface DirectiveInvasionDefenseMemory extends FlagMemory {
	persistent?: boolean;
	created: number;
}

@profile
export class DirectiveInvasionDefense extends Directive {

	static directiveName = 'invasionDefense';
	static color = COLOR_ORANGE;
	static secondaryColor = COLOR_RED;

	memory: DirectiveInvasionDefenseMemory;
	room: Room;

	private relocateFrequency: number;

	constructor(flag: Flag) {
		super(flag);
		let bigInvaders = _.filter(this.room.hostiles, hostile => hostile.body.length >= 30);
		let boostedInvasion = _.filter(bigInvaders, invader => invader.boosts.length > 0).length > 0;
		this.overlords.archer = new ArcherDefenseOverlord(this, boostedInvasion);
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
