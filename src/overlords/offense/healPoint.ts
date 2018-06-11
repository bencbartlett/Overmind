// Siege overlord - spawns sieger creeps to break down walls and structures

import {Zerg} from '../../Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {DirectiveHealPoint} from '../../directives/offense/healPoint';
import {CombatOverlord} from '../CombatOverlord';
import {profile} from '../../profiler/decorator';
import {CreepSetup} from '../CreepSetup';


const PointHealerSetup = new CreepSetup('pointHealer', {
	pattern  : [HEAL, MOVE],
	sizeLimit: Infinity,
	ordered  : false
});

@profile
export class HealPointOverlord extends CombatOverlord {

	healers: Zerg[];
	recoveryWaypoint: RoomPosition;

	constructor(directive: DirectiveHealPoint, priority = OverlordPriority.offense.healPoint) {
		super(directive, 'healPoint', priority);
		this.healers = this.creeps(PointHealerSetup.role);
		this.moveOpts = {
			allowSK   : true,
			ensurePath: true,
		};
	}

	private handleHealer(healer: Zerg): void {
		healer.travelTo(this.pos, this.moveOpts);
		let healTarget = this.findClosestHurtFriendly(healer);
		if (healTarget) {
			healer.heal(healTarget, true);
		}
	}

	init() {
		this.wishlist(1, PointHealerSetup);
	}

	run() {
		for (let healer of this.healers) {
			this.handleHealer(healer);
		}
	}
}
