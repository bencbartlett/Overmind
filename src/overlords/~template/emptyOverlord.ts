import {Setups} from '../../creepSetups/setups';
import {Directive} from '../../directives/Directive';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {Overlord, OverlordMemory} from '../Overlord';

interface EmptyOverlordMemory extends OverlordMemory {

}

const getDefaultEmptyOverlordMemory: () => EmptyOverlordMemory = () => ({});


/**
 * DOCUMENTATION GOES HERE
 */
@profile
export class EmptyOverlord extends Overlord {

	memory: EmptyOverlordMemory;

	role1: Zerg[];

	constructor(directive: Directive, priority = OverlordPriority.default) {
		super(directive, 'empty', priority, getDefaultEmptyOverlordMemory);
		// TODO
		this.role1 = this.zerg('ROLES.SOMETHING'); // TODO
	}

	refresh(): void {
		super.refresh();
		// TODO
	}

	init() {
		this.wishlist(1, Setups.upgraders.default);
	}

	private handleUpgrader(zerg: Zerg): void {
		// TODO
	}

	run() {
		this.autoRun(this.role1, zerg => this.handleUpgrader(zerg));
	}

}


