import {profile} from '../../profiler/decorator';
import { Directive } from '../Directive';
import { ControllerAttackingOverlord } from '../../overlords/colonization/controllerAttacker';
import {Colony} from '../../Colony';

// Attacks Room Controller

@profile
export class DirectiveAttack extends Directive {

	static directiveName = 'attack';
	static color = COLOR_PURPLE;
	static secondaryColor = COLOR_ORANGE;
	static requiredRCL = 3;

	toattack: Colony | undefined;
	overlords: {
		controllerAttacker: ControllerAttackingOverlord;
	};

	constructor(flag: Flag) {
		super(flag);
		this.toattack = this.room ? Overmind.colonies[Overmind.colonyMap[this.room.name]] : undefined;
		this.overlords.controllerAttacker = new ControllerAttackingOverlord(this);
	}

	init() {

	}

	run() {
		if (this.toattack && this.toattack.spawns.length > 0) {
			this.remove();
		}
	}
}
