// // Siege overlord - spawns sieger creeps to break down walls and structures
//
// import {OverlordPriority} from '../../priorities/priorities_overlords';
// import {DirectiveTargetSiege} from '../../directives/targeting/siegeTarget';
// import {DirectiveSiege} from '../../directives/offense/siege';
// import {profile} from '../../profiler/decorator';
// import {Overlord} from '../Overlord';
// import {CombatZerg} from '../../zerg/CombatZerg';
// import {CombatSetups, Roles} from '../../creepSetups/setups';
//
// // TODO: this overlord is deprecated and should be updated
//
// @profile
// export class SiegeOverlord extends Overlord {
//
// 	siegers: CombatZerg[];
// 	recoveryWaypoint: RoomPosition;
// 	settings: {
// 		retreatHitsPercent: number,
// 	};
//
// 	constructor(directive: DirectiveSiege, priority = OverlordPriority.offense.siege) {
// 		super(directive, 'siege', priority);
// 		this.siegers = this.combatZerg(Roles.dismantler);
// 		this.recoveryWaypoint = directive.recoveryWaypoint;
// 		this.settings = {
// 			retreatHitsPercent: 0.75,
// 		};
// 	}
//
// 	private findSiegeTarget(sieger: CombatZerg): Structure | null | undefined {
// 		if (this.room) {
// 			let targetingDirectives = DirectiveTargetSiege.find(this.room.flags) as DirectiveTargetSiege[];
// 			let targetedStructures = _.compact(_.map(targetingDirectives,
// 													 directive => directive.getTarget())) as Structure[];
// 			if (targetedStructures.length > 0) {
// 				return sieger.pos.findClosestByRange(targetedStructures);
// 			} else {
// 				return sieger.pos.findClosestByRange(this.room.hostileStructures);
// 			}
// 		}
// 	}
//
// 	private siegeActions(sieger: CombatZerg, target: Structure): void {
// 		// console.log(`sieging to ${target.pos}`);
// 		let hasDismantled = false;
// 		// Dismantle the target if you can, else move to get in range
// 		if (sieger.pos.isNearTo(target)) {
// 			// Dismantle if you can, otherwise heal yourself
// 			if (sieger.dismantle(target) == OK) {
// 				hasDismantled = true;
// 			}
// 		} else {
// 			sieger.goTo(target, {allowHostile: true});
// 		}
//
// 		// Heal yourself if it won't interfere with dismantling
// 		if (!hasDismantled && sieger.getActiveBodyparts(HEAL) > 0 && sieger.hits < sieger.hitsMax) {
// 			sieger.heal(sieger);
// 		}
// 	}
//
// 	/* Retreat to a waypoint and heal to full health before going back into the room */
// 	private retreatActions(sieger: CombatZerg, waypoint: RoomPosition): void {
// 		// console.log(`retreating to ${waypoint}`);
// 		if (sieger.getActiveBodyparts(HEAL) > 0) sieger.heal(sieger);
// 		sieger.goTo(waypoint);
// 	}
//
// 	private handleSieger(sieger: CombatZerg): void {
// 		if (this.recoveryWaypoint &&
// 			sieger.pos.roomName != this.pos.roomName &&
// 			sieger.pos.roomName != this.recoveryWaypoint.roomName) {
// 			// Go to the recovery point first
// 			sieger.goTo(this.recoveryWaypoint);
// 		}
// 		if (sieger.pos.roomName == this.pos.roomName) {
// 			if (sieger.hits > this.settings.retreatHitsPercent * sieger.hitsMax) {
// 				// If you're in the hostile room and have sufficient health, go siege
// 				let siegeTarget = this.findSiegeTarget(sieger);
// 				if (siegeTarget) this.siegeActions(sieger, siegeTarget);
// 			} else {
// 				// If you're in hostile room and health is getting low, retreat
// 				this.retreatActions(sieger, this.recoveryWaypoint);
// 			}
// 		} else {
// 			if (sieger.hits == sieger.hitsMax) {
// 				// If you're at full health and outside the room, go back in
// 				sieger.goTo(this.pos, _.merge({range: 50}));
// 			} else {
// 				// If you're below full health and outside the room, heal up first
// 				this.retreatActions(sieger, this.recoveryWaypoint);
// 			}
// 		}
// 	}
//
// 	init() {
// 		this.wishlist(3, CombatSetups.dismantlers.default);
// 	}
//
// 	run() {
// 		for (let sieger of this.siegers) {
// 			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
// 			if (sieger.hasValidTask) {
// 				sieger.run();
// 			} else {
// 				this.handleSieger(sieger);
// 			}
// 		}
// 	}
// }
