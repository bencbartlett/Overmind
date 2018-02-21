// Siege overlord - spawns sieger creeps to break down walls and structures

import {Overlord} from './Overlord';
import {HealerSetup} from '../creepSetup/defaultSetups';
import {Zerg} from '../Zerg';
import {OverlordPriority} from './priorities_overlords';
import {DirectiveHealPoint} from '../directives/directive_healPoint';

export class HealPointOverlord extends Overlord {

	private moveOpts: TravelToOptions;
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

	private findHealTarget(guard: Zerg): Creep | undefined {
		return guard.pos.findClosestByRange(_.filter(guard.room.creeps, creep => creep.hits < creep.hitsMax));
	}

	/* Move to and heal/rangedHeal the specified target */
	private medicActions(healer: Zerg, target: Creep): void {

		// Approach the target
		let range = healer.pos.getRangeTo(target);
		// if (range > 1) {
		// 	healer.travelTo(target, {movingTarget: true});
		// }

		// Heal or ranged-heal the target
		if (range <= 1) {
			healer.heal(target);
		} else if (range <= 3) {
			healer.rangedHeal(target);
		}
	}

	private handleHealer(healer: Zerg): void {
		// if (healer.pos.roomName != this.pos.roomName) {
		// 	healer.travelTo(this.pos);
		// } else {
		// 	healer.travelTo(this.pos);
		// 	let healTarget = this.findHealTarget(healer);
		// 	if (healTarget) {
		// 		this.medicActions(healer, healTarget);
		// 	}
		// 	// else {
		// 	// 	healer.travelTo(this.pos);
		// 	// }
		// }
		healer.travelTo(this.pos, this.moveOpts);
		let healTarget = this.findHealTarget(healer);
		if (healTarget) {
			this.medicActions(healer, healTarget);
		}
	}

	spawn() {
		this.wishlist(1, new HealerSetup());
	}

	init() {
		this.spawn();
	}

	run() {
		for (let healer of this.healers) {
			this.handleHealer(healer);
		}
	}
}
