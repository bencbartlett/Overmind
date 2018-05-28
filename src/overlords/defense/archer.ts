// archer overlord - spawns defender/healer pairs for sustained combat

import {Zerg} from '../../Zerg';
import {OverlordPriority} from '../priorities_overlords';
import {DirectiveTargetSiege} from '../../directives/targeting/siegeTarget';
import {CombatOverlord} from '../CombatOverlord';
import {CreepSetup} from '../CreepSetup';
import {boostResources} from '../../resources/map_resources';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {profile} from '../../profiler/decorator';

export class ArcherSetup extends CreepSetup {
	static role = 'archer';

	constructor() {
		super(ArcherSetup.role, {
			pattern  : [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, MOVE, MOVE],
			sizeLimit: Infinity,
		});
	}
}

@profile
export class ArcherDefenseOverlord extends CombatOverlord {

	archers: Zerg[];
	private retreatPos: RoomPosition;
	room: Room;
	settings: {
		retreatHitsPercent: number,
		reengageHitsPercent: number,
	};

	constructor(directive: DirectiveInvasionDefense, boosted = false,
				priority                                     = OverlordPriority.defense.rangedDefense) {
		super(directive, 'archer', priority);
		this.archers = this.creeps(ArcherSetup.role);
		if (boosted) {
			this.boosts.archer = [
				boostResources.ranged_attack[3],
				boostResources.heal[3],
			];
		}
		this.retreatPos = this.colony.controller.pos;
		this.settings = {
			retreatHitsPercent : 0.85,
			reengageHitsPercent: 0.95,
		};
	}

	private findTarget(archer: Zerg): Creep | Structure | undefined {
		if (this.room) {
			// Prioritize specifically targeted structures first
			let targetingDirectives = DirectiveTargetSiege.find(this.room.flags) as DirectiveTargetSiege[];
			let targetedStructures = _.compact(_.map(targetingDirectives,
													 directive => directive.getTarget())) as Structure[];
			if (targetedStructures.length > 0) {
				return this.findClosestReachable(archer.pos, targetedStructures);
			} else {
				// Target nearby hostile creeps
				let creepTarget = this.findClosestHostile(archer, false);
				if (creepTarget) return creepTarget;
				// Target nearby hostile structures
				let structureTarget = this.findClosestPrioritizedStructure(archer);
				if (structureTarget) return structureTarget;
			}
		}
	}

	private retreatActions(archer: Zerg): void {
		archer.travelTo(this.fallback);
		if (archer.hits > this.settings.reengageHitsPercent * archer.hits) {
			archer.memory.retreating = false;
		}
	}

	private attackActions(attacker: Zerg): void {
		let target = this.findTarget(attacker);
		if (target) {
			let range = attacker.pos.getRangeTo(target);
			if (range < 3) {
				attacker.travelTo(this.colony.controller);
			}
			if (range == 3) {
				attacker.rangedAttack(target);
			} else {
				attacker.travelTo(target, _.merge(this.moveOpts, {range: 3}));
			}
		}
	}

	private handleArcher(archer: Zerg): void {
		// Handle retreating actions
		if (archer.hits < this.settings.retreatHitsPercent * archer.hitsMax) {
			archer.memory.retreating = true;
		}
		if (archer.memory.retreating) {
			this.retreatActions(archer);
		}
		// Move to room and then perform attacking actions
		if (!archer.inSameRoomAs(this)) {
			archer.travelTo(this.pos);
		} else {
			this.attackActions(archer);
			this.healActions(archer);
		}
	}


	private healActions(archer: Zerg): void {
		if (this.room && this.room.hostiles.length == 0) { // No hostiles in the room
			this.medicActions(archer);
			return;
		}

		if (archer.hitsMax - archer.hits > 0) {
			archer.heal(archer);
		} else {
			// Try to heal whatever else is in range
			let target = archer.pos.findClosestByRange(this.archers);
			if (target) {
				archer.heal(target, true);
				archer.travelTo(target);
			}
		}
	}

	init() {
		this.reassignIdleCreeps(ArcherSetup.role);
		let amount;
		if (this.directive.memory.amount) {
			amount = this.directive.memory.amount;
		} else {
			amount = _.sum(_.map(this.room.hostiles, hostile => hostile.boosts.length > 0 ? 2 : 1));
		}
		this.wishlist(amount, new ArcherSetup());
	}

	run() {
		for (let archer of this.archers) {
			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
			if (archer.hasValidTask) {
				archer.run();
			} else {
				if (archer.needsBoosts && this.labsHaveBoosts()) {
					this.handleBoosts(archer);
				} else {
					this.handleArcher(archer);
				}
			}
		}

	}
}
