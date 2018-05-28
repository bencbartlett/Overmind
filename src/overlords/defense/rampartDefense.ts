// archer overlord - spawns defender/healer pairs for sustained combat

import {Zerg} from '../../Zerg';
import {OverlordPriority} from '../priorities_overlords';
import {CombatOverlord} from '../CombatOverlord';
import {CreepSetup} from '../CreepSetup';
import {boostResources} from '../../resources/map_resources';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {profile} from '../../profiler/decorator';

export class RampartDefenderSetup extends CreepSetup {
	static role = 'rampartDefender';

	constructor() {
		super(RampartDefenderSetup.role, {
			pattern  : [ATTACK, MOVE],
			sizeLimit: Infinity,
		});
	}
}

@profile
export class RampartDefenseOverlord extends CombatOverlord {

	defenders: Zerg[];
	private defendPositions: RoomPosition[];
	room: Room;

	constructor(directive: DirectiveInvasionDefense, boosted = false, priority = OverlordPriority.defense.meleeDefense) {
		super(directive, 'rampartDefense', priority);
		this.defenders = this.creeps(RampartDefenderSetup.role);
		if (boosted) {
			this.boosts.defender = [
				boostResources.attack[3],
			];
		}
		let rampartPositions = _.map(_.filter(this.colony.room.barriers, s => s.structureType == STRUCTURE_RAMPART),
									 barrier => barrier.pos);
		this.defendPositions = _.filter(rampartPositions,
										pos => pos.findInRange(this.colony.room.hostiles, 1).length > 1);
	}

	private handleDefender(defender: Zerg): void {
		// Move to a defensible position
		let isStandingInDefensePos = _.any(this.defendPositions, pos => pos.isEqualTo(defender.pos));
		if (!isStandingInDefensePos) {
			let availablePositions = _.filter(this.defendPositions, pos => pos.lookFor(LOOK_CREEPS).length == 0);
			let target = defender.pos.findClosestByRange(availablePositions);
			if (target) {
				let enemyPositions = _.map(this.room.hostiles, hostile => hostile.pos);
				defender.travelTo(target, {obstacles: enemyPositions, movingTarget: true});
			}
		}
		// Attack something
		let target = this.findClosestHostile(defender, false, false);
		if (target && defender.pos.isNearTo(target)) {
			defender.attack(target);
		}
	}

	init() {
		this.reassignIdleCreeps(RampartDefenderSetup.role);
		let amount;
		let maxAmount = 5;
		if (this.directive.memory.amount) {
			amount = this.directive.memory.amount;
		} else {
			amount = _.sum(_.map(this.room.dangerousHostiles, hostile => hostile.boosts.length > 0 ? 2 : 1));
		}
		amount = Math.max(amount, maxAmount);
		this.wishlist(amount, new RampartDefenderSetup());
	}

	run() {
		for (let defender of this.defenders) {
			// Run the creep if it has a task given to it by something else; otherwise, proceed with non-task actions
			if (defender.hasValidTask) {
				defender.run();
			} else {
				if (defender.needsBoosts && this.labsHaveBoosts()) {
					this.handleBoosts(defender);
				} else {
					this.handleDefender(defender);
				}
			}
		}

	}
}
