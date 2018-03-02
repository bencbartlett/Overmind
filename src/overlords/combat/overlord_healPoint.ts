// Siege overlord - spawns sieger creeps to break down walls and structures

import {HealerSetup} from '../../creepSetup/defaultSetups';
import {Zerg} from '../../Zerg';
import {OverlordPriority} from '../priorities_overlords';
import {DirectiveHealPoint} from '../../directives/combat/directive_healPoint';
import {CombatOverlord} from './CombatOverlord';

export class HealPointOverlord extends CombatOverlord {

	healers: Zerg[];
	recoveryWaypoint: RoomPosition;

	constructor(directive: DirectiveHealPoint, priority = OverlordPriority.offense.healPoint) {
		super(directive, 'healPoint', priority);
		this.healers = this.creeps('healer');
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
		this.wishlist(1, new HealerSetup());
	}

	run() {
		for (let healer of this.healers) {
			this.handleHealer(healer);
		}
	}
}
