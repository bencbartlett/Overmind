import {AttackStructurePriorities} from '../priorities/priorities_structures';
import {Pathing} from '../movement/Pathing';
import {Zerg} from '../zerg/_Zerg';

export class CombatTargeting {

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
				return _.find(targetsByRange, target => Pathing.isReachable(zerg.pos, target.pos));
			} else {
				return zerg.pos.findClosestByRange(targets) as Creep | undefined;
			}
		}
	}

	/* This method is expensive */
	static findClosestReachable(pos: RoomPosition, targets: (Creep | Structure)[]): Creep | Structure | undefined {
		let targetsByRange = _.sortBy(targets, target => pos.getRangeTo(target));
		return _.find(targetsByRange, target => Pathing.isReachable(pos, target.pos));
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

}