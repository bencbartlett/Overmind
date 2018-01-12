import {Overlord} from './Overlord';
import {ReserverSetup} from '../creepSetup/defaultSetups';
import {TaskReserve} from '../tasks/task_reserve';
import {TaskGoTo} from '../tasks/task_goTo';
import {Priority} from '../config/priorities';
import {Zerg} from '../Zerg';
import {DirectiveOutpost} from '../directives/directive_outpost';

export class ReservingOverlord extends Overlord {

	reservers: Zerg[];
	reserveBuffer: number;

	constructor(directive: DirectiveOutpost, priority = Priority.NormalHigh) {
		super(directive, 'reserve', priority);
		this.reservers = this.creeps('reserver');
		this.reserveBuffer = 3000;
	}

	spawn() {
		if (!this.room || this.room.controller!.needsReserving(this.reserveBuffer)) {
			this.wishlist(1, new ReserverSetup());
		}
	}

	init() {
		this.spawn();
	}

	private handleReserver(reserver: Zerg): void {
		if (reserver.room == this.room && !reserver.pos.isEdge) {
			reserver.task = new TaskReserve(this.room.controller!);
		} else {
			reserver.task = new TaskGoTo(this.pos);
		}
	}

	run() {
		for (let reserver of this.reservers) {
			if (reserver.isIdle) {
				this.handleReserver(reserver);
			}
			reserver.run();
		}
	}
}
