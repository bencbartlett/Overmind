import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {OutpostDefenseOverlord} from '../../overlords/defense/outpostDefense';

interface DirectiveInvasionDefenseMemory extends FlagMemory {
	persistent?: boolean;
	created: number;
	safeSince: number;
}

@profile
export class DirectiveOutpostDefense extends Directive {

	static directiveName = 'outpostDefense';
	static color = COLOR_BLUE;
	static secondaryColor = COLOR_RED;
	static requiredRCL = 1;

	memory: DirectiveInvasionDefenseMemory;
	room: Room | undefined;

	constructor(flag: Flag) {
		super(flag, DirectiveOutpostDefense.requiredRCL);
	}

	spawnMoarOverlords() {
		this.overlords.outpostDefense = new OutpostDefenseOverlord(this);
	}

	init(): void {

	}

	run(): void {
		if (!this.room || this.room.hostiles.length > 0) {
			this.memory.safeSince = Game.time;
		}
		// If there are no hostiles left in the room and everyone's healed, then remove the flag
		if (this.room && this.room.hostiles.length == 0 &&
			Game.time - this.memory.safeSince > 100 && this.room.hostileStructures.length == 0) {
			if (_.filter(this.room.creeps, creep => creep.hits < creep.hitsMax).length == 0) {
				this.remove();
			}
		}
	}

}
