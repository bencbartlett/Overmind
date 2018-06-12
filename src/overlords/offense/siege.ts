// Siege overlord - spawns sieger creeps to break down walls and structures

import {Zerg} from '../../Zerg';
import {OverlordPriority} from '../../priorities/priorities_overlords';
import {DirectiveTargetSiege} from '../../directives/targeting/siegeTarget';
import {DirectiveSiege} from '../../directives/offense/siege';
import {CombatOverlord} from '../CombatOverlord';
import {profile} from '../../profiler/decorator';
import {CreepSetup} from '../CreepSetup';

const SiegerSetup = new CreepSetup('sieger', {
	pattern  : [WORK, MOVE],
	sizeLimit: Infinity,
});

const SiegerSetupWithHeals = new CreepSetup('sieger', {
	pattern  : [WORK, HEAL, MOVE, MOVE],
	sizeLimit: Infinity,
});

@profile
export class SiegeOverlord extends CombatOverlord {

	siegers: Zerg[];
	recoveryWaypoint: RoomPosition;
	settings: {
		retreatHitsPercent: number,
	};

	constructor(directive: DirectiveSiege, priority = OverlordPriority.offense.siege) {
		super(directive, 'siege', priority);
		this.siegers = this.creeps(SiegerSetup.role);
		this.recoveryWaypoint = directive.recoveryWaypoint;
		this.settings = {
			retreatHitsPercent: 0.75,
		};
	}

	private findSiegeTarget(sieger: Zerg): Structure | void {
		if (this.room) {
			let targetingDirectives = DirectiveTargetSiege.find(this.room.flags) as DirectiveTargetSiege[];
			let targetedStructures = _.compact(_.map(targetingDirectives,
													 directive => directive.getTarget())) as Structure[];
			if (targetedStructures.length > 0) {
				return sieger.pos.findClosestByRange(targetedStructures);
			} else {
				return sieger.pos.findClosestByRange(this.room.hostileStructures);
			}
		}
	}

	private siegeActions(sieger: Zerg, target: Structure): void {
		// console.log(`sieging to ${target.pos}`);
		let hasDismantled = false;
		// Dismantle the target if you can, else move to get in range
		if (sieger.pos.isNearTo(target)) {
			// Dismantle if you can, otherwise heal yourself
			if (sieger.dismantle(target) == OK) {
				hasDismantled = true;
			}
		} else {
			sieger.travelTo(target, {allowHostile: true});
		}

		// Heal yourself if it won't interfere with dismantling
		if (!hasDismantled && sieger.getActiveBodyparts(HEAL) > 0 && sieger.hits < sieger.hitsMax) {
			sieger.heal(sieger);
		}
	}

	/* Retreat to a waypoint and heal to full health before going back into the room */
	private retreatActions(sieger: Zerg, waypoint: RoomPosition): void {
		// console.log(`retreating to ${waypoint}`);
		if (sieger.getActiveBodyparts(HEAL) > 0) sieger.heal(sieger);
		sieger.travelTo(waypoint, this.moveOpts);
	}

	private handleSieger(sieger: Zerg): void {
		if (this.recoveryWaypoint &&
			sieger.pos.roomName != this.pos.roomName &&
			sieger.pos.roomName != this.recoveryWaypoint.roomName) {
			// Go to the recovery point first
			sieger.travelTo(this.recoveryWaypoint, this.moveOpts);
		}
		if (sieger.pos.roomName == this.pos.roomName) {
			if (sieger.hits > this.settings.retreatHitsPercent * sieger.hitsMax) {
				// If you're in the hostile room and have sufficient health, go siege
				let siegeTarget = this.findSiegeTarget(sieger);
				if (siegeTarget) this.siegeActions(sieger, siegeTarget);
			} else {
				// If you're in hostile room and health is getting low, retreat
				this.retreatActions(sieger, this.recoveryWaypoint);
			}
		} else {
			if (sieger.hits == sieger.hitsMax) {
				// If you're at full health and outside the room, go back in
				sieger.travelTo(this.pos, _.merge({range: 50}, this.moveOpts));
			} else {
				// If you're below full health and outside the room, heal up first
				this.retreatActions(sieger, this.recoveryWaypoint);
			}
		}
	}

	init() {
		this.wishlist(3, SiegerSetup);
	}

	run() {
		for (let sieger of this.siegers) {
			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
			if (sieger.hasValidTask) {
				sieger.run();
			} else {
				this.handleSieger(sieger);
			}
		}
	}
}
