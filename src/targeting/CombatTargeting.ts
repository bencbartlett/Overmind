import {AttackStructurePriorities, AttackStructureScores} from '../priorities/priorities_structures';
import {Pathing} from '../movement/Pathing';
import {Zerg} from '../zerg/Zerg';
import {maxBy} from '../utilities/utils';
import {CombatIntel} from '../intel/CombatIntel';
import {log} from '../console/log';

export class CombatTargeting {

	/* Finds the best target within a given range that a zerg can currently attack */
	static findBestCreepTargetInRange(zerg: Zerg, range: number, targets = zerg.room.hostiles): Creep | undefined {
		let nearbyHostiles = _.filter(targets, c => zerg.pos.inRangeToXY(c.pos.x, c.pos.y, range));
		return maxBy(nearbyHostiles, function (hostile) {
			if (hostile.hitsPredicted == undefined) hostile.hitsPredicted = hostile.hits;
			if (hostile.pos.lookForStructure(STRUCTURE_RAMPART)) return false;
			return hostile.hitsMax - hostile.hitsPredicted + CombatIntel.getHealPotential(hostile); // compute score
		});
	}

	/* Finds the best target within a given range that a zerg can currently attack */
	static findBestStructureTargetInRange(zerg: Zerg, range: number, allowUnowned = true): Structure | undefined {
		let nearbyStructures = _.filter(zerg.room.hostileStructures,
										s => zerg.pos.inRangeToXY(s.pos.x, s.pos.y, range));
		// If no owned structures to attack and not in colony room or outpost, target unowned structures
		if (allowUnowned && nearbyStructures.length == 0 && !Overmind.colonyMap[zerg.room.name]) {
			nearbyStructures = _.filter(zerg.room.structures,
										s => zerg.pos.inRangeToXY(s.pos.x, s.pos.y, range));
		}
		return maxBy(nearbyStructures, function (structure) {
			let score = 10 * AttackStructureScores[structure.structureType];
			if (structure.pos.lookForStructure(STRUCTURE_RAMPART)) score *= .1;
			return score;
		});
	}

	/* Standard target-finding logic */
	static findTarget(zerg: Zerg, targets = zerg.room.hostiles): Creep | undefined {
		return maxBy(targets, function (hostile) {
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

	static findClosestHurtFriendly(healer: Zerg): Creep | null {
		return healer.pos.findClosestByRange(_.filter(healer.room.creeps, creep => creep.hits < creep.hitsMax));
	}

	/* Finds the best (friendly) target in range that a zerg can currently heal */
	static findBestHealingTargetInRange(healer: Zerg, range = 3, friendlies = healer.room.creeps): Creep | undefined {
		return maxBy(_.filter(friendlies, f => healer.pos.getRangeTo(f) <= range), friend => {
			if (friend.hitsPredicted == undefined) friend.hitsPredicted = friend.hits;
			let healScore = friend.hitsMax - friend.hitsPredicted;
			if (healer.pos.getRangeTo(friend) > 1) {
				return healScore + CombatIntel.getRangedHealAmount(healer.creep);
			} else {
				return healScore + CombatIntel.getHealAmount(healer.creep);
			}
		});
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

	static findBestStructureTarget(zerg: Zerg): Structure | undefined {
		// Look for any unprotected structures
		let unprotectedRepairables = _.filter(zerg.room.repairables, s => {
			let rampart = s.pos.lookForStructure(STRUCTURE_RAMPART);
			return rampart && rampart.hits > 10000;
		});
		let approach = _.map(unprotectedRepairables, structure => {
			return {pos: structure.pos, range: 0};
		}) as PathFinderGoal[];
		if (zerg.room.barriers.length == 0 && unprotectedRepairables.length == 0) return; // if there's nothing in the room

		// Try to find a reachable unprotected structure
		if (approach.length > 0) {
			let ret = PathFinder.search(zerg.pos, approach, {
				maxRooms    : 1,
				maxOps      : 2000,
				roomCallback: roomName => {
					if (roomName != zerg.pos.roomName) return false;
					let matrix = new PathFinder.CostMatrix();
					for (let barrier of zerg.room.barriers) {
						matrix.set(barrier.pos.x, barrier.pos.y, 0xff);
					}
					return matrix;
				},
			});
			let targetPos = _.last(ret.path);
			if (!ret.incomplete && targetPos) {
				let targetStructure = _.first(_.filter(targetPos.lookFor(LOOK_STRUCTURES), s => {
					return s.structureType != STRUCTURE_ROAD && s.structureType != STRUCTURE_CONTAINER;
				}));
				if (targetStructure) {
					log.debug(`Found unprotected structure target @ ${targetPos.print}`);
					return targetStructure;
				}
			}
		}

		// Determine a "siege anchor" for what you eventually want to destroy
		let targets: Structure[] = zerg.room.spawns;
		if (targets.length == 0) targets = zerg.room.repairables;
		if (targets.length == 0) targets = zerg.room.barriers;
		if (targets.length == 0) targets = zerg.room.structures;
		if (targets.length == 0) return;

		// Recalculate approach targets
		approach = _.map(targets, s => {
			return {pos: s.pos, range: 0};
		});

		let maxWallHits = _.max(_.map(zerg.room.barriers, b => b.hits)) || 0;
		// Compute path with wall position costs weighted by fraction of highest wall
		let ret = PathFinder.search(zerg.pos, approach, {
			maxRooms    : 1,
			plainCost   : 1,
			swampCost   : 2,
			roomCallback: roomName => {
				if (roomName != zerg.pos.roomName) return false;
				let matrix = new PathFinder.CostMatrix();
				for (let barrier of zerg.room.barriers) {
					let cost = 100 + Math.round((barrier.hits / maxWallHits) * 100);
					matrix.set(barrier.pos.x, barrier.pos.y, cost);
				}
				return matrix;
			},
		});

		// Target the first non-road, non-container structure you find along the path
		for (let pos of ret.path) {
			let targetStructure = _.first(_.filter(pos.lookFor(LOOK_STRUCTURES), s => {
				return s.structureType != STRUCTURE_ROAD && s.structureType != STRUCTURE_CONTAINER;
			}));
			if (targetStructure) {
				log.debug(`Targeting structure @ ${targetStructure.pos.print}`);
				return targetStructure;
			}
		}
	}

}