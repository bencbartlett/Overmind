import {AttackStructurePriorities} from '../priorities/priorities_structures';
import {Pathing} from '../movement/Pathing';
import {Zerg} from '../zerg/Zerg';
import {maxBy} from '../utilities/utils';
import {CombatIntel} from '../intel/combatIntel';

export class CombatTargeting {

	/* Finds the best target within a given range that a zerg can currently attack */
	static findBestTargetInRange(zerg: Zerg, range: number, possibleTargets = zerg.room.hostiles): Creep | undefined {
		let nearbyHostiles = zerg.pos.findInRange(possibleTargets, range);
		return maxBy(nearbyHostiles, function (hostile) {
			if (hostile.hitsPredicted == undefined) hostile.hitsPredicted = hostile.hits;
			if (hostile.pos.lookForStructure(STRUCTURE_RAMPART)) return false;
			return hostile.hitsMax - hostile.hitsPredicted + CombatIntel.getHealPotential(hostile); // compute score
		});
	}

	/* Standard target-finding logic */
	static findTarget(zerg: Zerg, possibleTargets = zerg.room.hostiles): Creep | undefined {
		return maxBy(possibleTargets, function (hostile) {
			if (hostile.hitsPredicted == undefined) hostile.hitsPredicted = hostile.hits;
			if (hostile.pos.lookForStructure(STRUCTURE_RAMPART)) return false;
			return hostile.hitsMax - hostile.hitsPredicted + CombatIntel.getHealPotential(hostile)
				   - 10 * zerg.pos.getMultiRoomRangeTo(hostile.pos); // compute score
		});
	}

	static findClosestHostile(zerg: Zerg, checkReachable = false, ignoreCreepsAtEdge = true): Creep | undefined {
		if (zerg.room.hostiles.length > 0) {
			let targets: Creep[];
			if (ignoreCreepsAtEdge) {
				targets = _.filter(zerg.room.hostiles, hostile => hostile.pos.rangeToEdge > 0);
			} else {
				targets = zerg.room.hostiles;
			}
			if (checkReachable) {
				let targetsByRange = _.sortBy(targets, target => zerg.pos.getRangeTo(target));
				return _.find(targetsByRange, target => Pathing.isReachable(zerg.pos, target.pos, zerg.room.barriers));
			} else {
				return zerg.pos.findClosestByRange(targets) as Creep | undefined;
			}
		}
	}

	/* This method is expensive */
	static findClosestReachable(pos: RoomPosition, targets: (Creep | Structure)[]): Creep | Structure | undefined {
		let targetsByRange = _.sortBy(targets, target => pos.getRangeTo(target));
		return _.find(targetsByRange, target => Pathing.isReachable(pos, target.pos, target.room.barriers));
	}

	static findClosestPrioritizedStructure(zerg: Zerg, checkReachable = false): Structure | undefined {
		for (let structureType of AttackStructurePriorities) {
			let structures = _.filter(zerg.room.hostileStructures, s => s.structureType == structureType);
			if (structures.length == 0) continue;
			if (checkReachable) {
				let closestReachable = this.findClosestReachable(zerg.pos, structures) as Structure | undefined;
				if (closestReachable) return closestReachable;
			} else {
				return zerg.pos.findClosestByRange(structures) as Structure | undefined;
			}
		}
	}

	static findClosestHurtFriendly(healer: Zerg): Creep | null {
		return healer.pos.findClosestByRange(_.filter(healer.room.creeps, creep => creep.hits < creep.hitsMax));
	}

	/* Finds the best (friendly) target in range that a zerg can currently heal */
	static findBestHealingTargetInRange(healer: Zerg, range = 3, friendlies = healer.room.creeps): Creep | undefined {
		return maxBy(_.filter(friendlies, f => healer.pos.getRangeTo(f) <= range), friend => {
			if (!friend.hitsPredicted) friend.hitsPredicted = friend.hits;
			let healScore = friend.hitsMax - friend.hitsPredicted;
			if (healer.pos.getRangeTo(friend) > 1) {
				return healScore + CombatIntel.getRangedHealAmount(healer.creep);
			} else {
				return healScore + CombatIntel.getHealAmount(healer.creep);
			}
		});
	}

}