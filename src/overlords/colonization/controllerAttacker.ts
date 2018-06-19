import {Overlord} from '../Overlord';
import {Zerg} from '../../Zerg';
import {Tasks} from '../../tasks/Tasks';
import {Directive} from '../../directives/Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {CreepSetup} from '../CreepSetup';

const controllerAttackerSetup = new CreepSetup('controllerAttacker', {
	pattern: [CLAIM, MOVE],
	sizeLimit: Infinity
});

@profile
export class ControllerAttackingOverlord extends Overlord {

	controllerAttackers: Zerg[];

	constructor(directive: Directive, priority = OverlordPriority.realTime.claim) {
		super(directive, 'controllerAttacker', priority);
		this.controllerAttackers = this.creeps(controllerAttackerSetup.role);
	}

	init() {
		let amount = (this.room && this.room.controller && this.room.controller.my) ? 0 : 1;
		this.wishlist(amount, controllerAttackerSetup);
	}

	private handlecontrollerAttacker(controllerAttacker: Zerg): void {
		if (controllerAttacker.room == this.room && !controllerAttacker.pos.isEdge) {
			controllerAttacker.task = Tasks.attackController(this.room.controller!);
		} else {
			// controllerAttacker.task = Tasks.goTo(this.pos, {travelToOptions: {ensurePath: true}});
			controllerAttacker.travelTo(this.pos, {ensurePath: true, preferHighway: true});
		}
	}

	run() {
		for (let controllerAttacker of this.controllerAttackers) {
			if (controllerAttacker.isIdle) {
				this.handlecontrollerAttacker(controllerAttacker);
			}
			controllerAttacker.run();
		}
	}
}
