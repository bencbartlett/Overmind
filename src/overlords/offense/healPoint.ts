// Siege overlord - spawns sieger creeps to break down walls and structures

import {Zerg} from '../../zerg/Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {DirectiveHealPoint} from '../../directives/offense/healPoint';
import {profile} from '../../profiler/decorator';
import {CreepSetup} from '../CreepSetup';
import {Overlord} from '../Overlord';
import {CombatTargeting} from '../../targeting/CombatTargeting';

const PointHealerSetup = new CreepSetup('pointHealer', {
	pattern  : [HEAL, MOVE],
	sizeLimit: Infinity,
	ordered  : false
});

@profile
export class HealPointOverlord extends Overlord {

	healers: Zerg[];
	recoveryWaypoint: RoomPosition;

	constructor(directive: DirectiveHealPoint, priority = OverlordPriority.offense.healPoint) {
		super(directive, 'healPoint', priority);
		this.healers = this.zerg(PointHealerSetup.role);
	}

	private handleHealer(healer: Zerg): void {
		healer.goTo(this.pos);
		let healTarget = CombatTargeting.findClosestHurtFriendly(healer);
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
