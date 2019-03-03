import {CombatIntel} from '../intel/CombatIntel';
import {maxBy, minBy} from '../utilities/utils';
import {CombatZerg} from '../zerg/CombatZerg';
import {log} from '../console/log';
import {RoomIntel} from '../intel/RoomIntel';
import {isCombatZerg} from '../declarations/typeGuards';
import {profile} from '../profiler/decorator';
import {Swarm} from '../zerg/Swarm';


interface SkirmishAnalysis {
	attack: number,
	rangedAttack: number,
	heal: number,
	advantage: boolean,
	isRetreating: boolean,
	isApproaching: boolean,
}

const DEBUG = false;

@profile
export class GoalFinder {

	// Standard set of goals for fighting small groups of hostiles (not optimal for larger fights)
	static skirmishGoals(creep: CombatZerg): { approach: PathFinderGoal[], avoid: PathFinderGoal[] } {

		let approach: PathFinderGoal[] = [];
		let avoid: PathFinderGoal[] = [];

		const room = creep.room;

		let analysis = {} as { [id: string]: SkirmishAnalysis | undefined };

		let myAttack = CombatIntel.getAttackDamage(creep);
		let myRangedAttack = CombatIntel.getRangedAttackDamage(creep);
		let myHealing = CombatIntel.getHealAmount(creep);

		// If you're purely a healer, ignore combat goals
		if (myHealing > 0 && myAttack == 0 && myRangedAttack == 0) {
			return this.healingGoals(creep);
		}

		let preferCloseCombat = myAttack > 0;
		let myRating = CombatIntel.rating(creep);
		let nearbyRating = _.sum(creep.pos.findInRange(room.creeps, 6), c => CombatIntel.rating(c));
		let braveMode = creep.hits * (nearbyRating / myRating) * .5 > creep.hitsMax;

		let hostileHealers: Creep[] = [];

		// Analyze capabilities of hostile creeps in the room
		for (let hostile of room.hostiles) {
			if (hostile.owner.username == 'Source Keeper') continue;

			let attack = CombatIntel.getAttackDamage(hostile);
			let rangedAttack = CombatIntel.getRangedAttackDamage(hostile);
			let healing = CombatIntel.getHealAmount(hostile);
			if (healing > 0 && attack == 0 && rangedAttack == 0) {
				hostileHealers.push(hostile);
			}
			analysis[hostile.id] = {
				attack       : attack,
				rangedAttack : rangedAttack,
				heal         : healing,
				advantage    : healing == 0 || attack + rangedAttack == 0 ||
							   myAttack + myRangedAttack + myHealing / CombatIntel.minimumDamageTakenMultiplier(creep.creep)
							   > attack + rangedAttack + healing / CombatIntel.minimumDamageTakenMultiplier(hostile),
				isRetreating : CombatIntel.isRetreating(hostile, RoomIntel.getPreviousPos(creep)),
				isApproaching: CombatIntel.isApproaching(hostile, RoomIntel.getPreviousPos(creep)),
			};
		}

		// Generate list of targets to approach and respective ranges to keep them at
		let approachTargets = hostileHealers.length > 0 ? hostileHealers : room.hostiles;
		for (let target of approachTargets) {
			let data = analysis[target.id];
			if (data && (data.advantage || braveMode)) {
				let range = 1;
				if (!preferCloseCombat && (data.attack > 0 || data.rangedAttack > myRangedAttack)) {
					range = creep.pos.getRangeTo(target) == 3 && data.isRetreating ? 2 : 3;
					avoid.push({pos: target.pos, range: range});
				}
				approach.push({pos: target.pos, range: range});
			}
		}

		// If there's nothing left to approach, group up with other creeps
		if (approach.length == 0) {
			for (let friendly of room.creeps) {
				approach.push({pos: friendly.pos, range: 0});
			}
		}

		// Avoid hostiles that are significantly better than you
		for (let target of room.hostiles) {
			let data = analysis[target.id];
			if (data && (!data.advantage && !braveMode)) {
				let range = data.isApproaching ? 3 : 2;
				if (data.rangedAttack > 0) {
					range = 8;
				}
				avoid.push({pos: target.pos, range: range});
			}
		}

		if (DEBUG) {
			log.debug(`Report for ${creep.name}:`, JSON.stringify(analysis));
			log.debug(`Approach for ${creep.name}:`, JSON.stringify(approach));
			log.debug(`Avoid for ${creep.name}:`, JSON.stringify(avoid));
		}

		return {approach, avoid};
	}


	static swarmCombatGoals(swarm: Swarm,
							includeStructures = true): { approach: PathFinderGoal[], avoid: PathFinderGoal[] } {

		let approach: PathFinderGoal[] = [];
		let avoid: PathFinderGoal[] = [];

		if (swarm.rooms.length > 1) {
			log.warning(`Swarm in more than 1 room!`);
		}
		// If in more than 1 room, pick the room with more hostile stuff in it
		const room = maxBy(swarm.rooms, room => room.hostiles.length + room.hostileStructures.length) as Room;

		let myAttack = _.sum(swarm.creeps, creep => CombatIntel.getAttackDamage(creep));
		let myRangedAttack = _.sum(swarm.creeps, creep => CombatIntel.getRangedAttackDamage(creep));
		let myHealing = _.sum(swarm.creeps, creep => CombatIntel.getHealAmount(creep));
		let myDamageMultiplier = CombatIntel.minimumDamageMultiplierForGroup(_.map(swarm.creeps, c => c.creep));

		let preferCloseCombat = myAttack > myRangedAttack;

		let myRating = _.sum(swarm.creeps, creep => CombatIntel.rating(creep));

		let hostileSwarms = Swarm.findEnemySwarms(room, {pos: swarm.anchor});

		// Analyze capabilities of hostile creeps in the room
		for (let i in hostileSwarms) {

			const hostiles = hostileSwarms[i].creeps as Creep[];

			let attack = _.sum(hostiles, creep => CombatIntel.getAttackDamage(creep));
			let rangedAttack = _.sum(hostiles, creep => CombatIntel.getRangedAttackDamage(creep));
			let healing = _.sum(hostiles, creep => CombatIntel.getHealAmount(creep));
			let damageMultiplier = CombatIntel.minimumDamageMultiplierForGroup(hostiles);

			let canPopShield = (attack + rangedAttack + CombatIntel.towerDamageAtPos(swarm.anchor)) * myDamageMultiplier
							   > _.min(_.map(swarm.creeps, creep => 100 * creep.getActiveBodyparts(TOUGH)));

			let isRetreating = _.sum(hostiles, creep => +CombatIntel.isRetreating(creep, swarm.anchor))
							   / hostiles.length >= 0.5;

			let isApproaching = _.sum(hostiles, creep => +CombatIntel.isApproaching(creep, swarm.anchor))
								/ hostiles.length >= 0.5;

			let advantage = healing == 0 || attack + rangedAttack == 0 ||
							myAttack + myRangedAttack + myHealing / myDamageMultiplier
							> attack + rangedAttack + healing / damageMultiplier;


			for (let hostile of hostiles) {
				if (canPopShield && hostile.pos.lookForStructure(STRUCTURE_RAMPART)) {
					let range = (rangedAttack > attack || !preferCloseCombat ? 3 : 1) + 1;
					if (CombatIntel.isApproaching(hostile, swarm.anchor)) {
						range += 1;
					}
					avoid.push({pos: hostile.pos, range: range});
				} else {
					if (advantage) {
						let range = preferCloseCombat ? 3 : 1;
						if (!preferCloseCombat && (attack > 0 || rangedAttack > myAttack)) {
							range = swarm.minRangeTo(hostile) == 3 && isRetreating ? 2 : 3;
							avoid.push({pos: hostile.pos, range: range});
						}
						approach.push({pos: hostile.pos, range: range});
					} else {
						let range = isApproaching ? 3 : 2;
						if (rangedAttack > attack) {
							range = 5;
						}
						avoid.push({pos: hostile.pos, range: range});
					}
				}
			}

		}

		if (includeStructures) {
			let approachStructures: Structure[] = [];
			for (let structure of room.hostileStructures) {
				approachStructures.push(structure);
			}
			for (let wall of room.walls) {
				approachStructures.push(wall);
			}
			for (let approachStructure of approachStructures) {
				approach.push({pos: approachStructure.pos, range: 1});
			}
		}

		if (DEBUG) {
			log.debug(`Approach for ${swarm.print}:`, JSON.stringify(approach));
			log.debug(`Avoid for ${swarm.print}:`, JSON.stringify(avoid));
		}

		return {approach, avoid};
	}

	static retreatGoals(creep: CombatZerg): { approach: PathFinderGoal[], avoid: PathFinderGoal[] } {
		let approach: PathFinderGoal[] = [];
		let avoid: PathFinderGoal[] = [];

		let isHealer = CombatIntel.isHealer(creep);
		for (let friendly of creep.room.creeps) {
			if (CombatIntel.getHealPotential(friendly) > 0 || (isHealer && isCombatZerg(creep))) {
				approach.push({pos: friendly.pos, range: 1});
			}
		}
		for (let hostile of creep.room.hostiles) {
			if (CombatIntel.getAttackPotential(hostile) > 0 || CombatIntel.getRangedAttackPotential(hostile) > 0) {
				avoid.push({pos: hostile.pos, range: 8});
			}
		}
		if (creep.room.owner && !creep.room.my) {
			for (let tower of creep.room.towers) {
				avoid.push({pos: tower.pos, range: 50});
			}
		}
		return {approach, avoid};
	}

	static retreatGoalsForRoom(room: Room): { approach: PathFinderGoal[], avoid: PathFinderGoal[] } {
		let avoid: PathFinderGoal[] = [];

		for (let hostile of room.hostiles) {
			if (CombatIntel.getAttackPotential(hostile) > 0 || CombatIntel.getRangedAttackPotential(hostile) > 0) {
				avoid.push({pos: hostile.pos, range: 8});
			}
		}
		if (room.owner && !room.my) {
			for (let tower of room.towers) {
				avoid.push({pos: tower.pos, range: 50});
			}
		}
		return {approach: [], avoid: avoid};
	}

	static healingGoals(healer: CombatZerg): { approach: PathFinderGoal[], avoid: PathFinderGoal[] } {
		let approach: PathFinderGoal[] = [];
		let avoid: PathFinderGoal[] = [];
		let healAmount = CombatIntel.getHealAmount(healer);
		let target = minBy(_.filter(healer.room.creeps, c => c.hits < c.hitsMax),
						   c => c.hits + healer.pos.getRangeTo(c));
		if (!target) {
			target = minBy(healer.room.creeps, creep => {
				let range = healer.pos.getRangeTo(creep);
				return range > 0 ? CombatIntel.maxFriendlyHealingTo(creep) / healAmount + range : false;
			});
		}
		if (target) {
			approach.push({pos: target.pos, range: 0});
		}
		for (let hostile of healer.room.hostiles) {
			let meleeDamage = CombatIntel.getAttackDamage(hostile);
			let rangedDamage = CombatIntel.getRangedAttackDamage(hostile);
			if (meleeDamage + rangedDamage > 0) {
				let range = rangedDamage > healAmount ? 4 : 3;
				avoid.push({pos: hostile.pos, range: range});
			}
		}
		return {approach, avoid};
	}

	static structureGoals(creep: CombatZerg): { approach: PathFinderGoal[], avoid: PathFinderGoal[] } {
		let approach: PathFinderGoal[] = [];

		// // TODO: finish this
		// let range = CombatIntel.getAttackDamage(creep) > 0 || CombatIntel.getDismantleDamage(creep) > 0 ? 1 : 3;
		// let structureTarget = CombatTargeting.findBestStructureTarget(creep);
		// if (structureTarget) {
		// 	approach.push({pos: structureTarget.pos, range: range});
		// }
		log.error(`NOT IMPLEMENTED`);

		return {approach: approach, avoid: []};
	}

}


