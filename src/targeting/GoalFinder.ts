import {log} from '../console/log';
import {isCombatZerg} from '../declarations/typeGuards';
import {CombatIntel} from '../intel/CombatIntel';
import {RoomIntel} from '../intel/RoomIntel';
import {profile} from '../profiler/decorator';
import {maxBy, minBy} from '../utilities/utils';
import {CombatZerg} from '../zerg/CombatZerg';
import {Swarm} from '../zerg/Swarm';


interface SkirmishAnalysis {
	attack: number;
	rangedAttack: number;
	heal: number;
	advantage: boolean;
	isRetreating: boolean;
	isApproaching: boolean;
}

const DEBUG = false;

@profile
export class GoalFinder {

	// Standard set of goals for fighting small groups of hostiles (not optimal for larger fights)
	static skirmishGoals(creep: CombatZerg): { approach: PathFinderGoal[], avoid: PathFinderGoal[] } {

		const approach: PathFinderGoal[] = [];
		const avoid: PathFinderGoal[] = [];

		const room = creep.room;

		const analysis = {} as { [id: string]: SkirmishAnalysis | undefined };

		const myAttack = CombatIntel.getAttackDamage(creep);
		const myRangedAttack = CombatIntel.getRangedAttackDamage(creep);
		const myHealing = CombatIntel.getHealAmount(creep);

		// If you're purely a healer, ignore combat goals
		if (myHealing > 0 && myAttack == 0 && myRangedAttack == 0) {
			return this.healingGoals(creep);
		}

		const preferCloseCombat = myAttack > 0;
		const myRating = CombatIntel.rating(creep);
		const nearbyRating = _.sum(creep.pos.findInRange(room.creeps, 6), c => CombatIntel.rating(c));
		const braveMode = creep.hits * (nearbyRating / myRating) * .5 > creep.hitsMax;

		const hostileHealers: Creep[] = [];

		// Analyze capabilities of hostile creeps in the room
		for (const hostile of room.hostiles) {
			if (hostile.owner.username == 'Source Keeper') continue;

			const attack = CombatIntel.getAttackDamage(hostile);
			const rangedAttack = CombatIntel.getRangedAttackDamage(hostile);
			const healing = CombatIntel.getHealAmount(hostile);
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
		const approachTargets = hostileHealers.length > 0 ? hostileHealers : room.hostiles;
		for (const target of approachTargets) {
			const data = analysis[target.id];
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
			for (const friendly of room.creeps) {
				approach.push({pos: friendly.pos, range: 0});
			}
		}

		// Avoid hostiles that are significantly better than you
		for (const target of room.hostiles) {
			const data = analysis[target.id];
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

		const approach: PathFinderGoal[] = [];
		const avoid: PathFinderGoal[] = [];

		if (swarm.rooms.length > 1) {
			log.warning(`Swarm in more than 1 room!`);
		}
		// If in more than 1 room, pick the room with more hostile stuff in it
		const room = maxBy(swarm.rooms, room => room.hostiles.length + room.hostileStructures.length) as Room;

		const myAttack = _.sum(swarm.creeps, creep => CombatIntel.getAttackDamage(creep));
		const myRangedAttack = _.sum(swarm.creeps, creep => CombatIntel.getRangedAttackDamage(creep));
		const myHealing = _.sum(swarm.creeps, creep => CombatIntel.getHealAmount(creep));
		const myDamageMultiplier = CombatIntel.minimumDamageMultiplierForGroup(_.map(swarm.creeps, c => c.creep));

		const preferCloseCombat = myAttack > myRangedAttack;

		const myRating = _.sum(swarm.creeps, creep => CombatIntel.rating(creep));

		const hostileSwarms = Swarm.findEnemySwarms(room, {pos: swarm.anchor});

		// Analyze capabilities of hostile creeps in the room
		for (const i in hostileSwarms) {

			const hostiles = hostileSwarms[i].creeps as Creep[];

			const attack = _.sum(hostiles, creep => CombatIntel.getAttackDamage(creep));
			const rangedAttack = _.sum(hostiles, creep => CombatIntel.getRangedAttackDamage(creep));
			const healing = _.sum(hostiles, creep => CombatIntel.getHealAmount(creep));
			const damageMultiplier = CombatIntel.minimumDamageMultiplierForGroup(hostiles);

			const canPopShield = (attack + rangedAttack + CombatIntel.towerDamageAtPos(swarm.anchor)) * myDamageMultiplier
							   > _.min(_.map(swarm.creeps, creep => 100 * creep.getActiveBodyparts(TOUGH)));

			const isRetreating = _.sum(hostiles, creep => +CombatIntel.isRetreating(creep, swarm.anchor))
								 / hostiles.length >= 0.5;

			const isApproaching = _.sum(hostiles, creep => +CombatIntel.isApproaching(creep, swarm.anchor))
								  / hostiles.length >= 0.5;

			const advantage = healing == 0 || attack + rangedAttack == 0 ||
							  myAttack + myRangedAttack + myHealing / myDamageMultiplier
							  > attack + rangedAttack + healing / damageMultiplier;


			for (const hostile of hostiles) {
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
			const approachStructures: Structure[] = [];
			for (const structure of room.hostileStructures) {
				approachStructures.push(structure);
			}
			for (const wall of room.walls) {
				approachStructures.push(wall);
			}
			for (const approachStructure of approachStructures) {
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
		const approach: PathFinderGoal[] = [];
		const avoid: PathFinderGoal[] = [];

		const isHealer = CombatIntel.isHealer(creep);
		for (const friendly of creep.room.creeps) {
			if (CombatIntel.getHealPotential(friendly) > 0 || (isHealer && isCombatZerg(creep))) {
				approach.push({pos: friendly.pos, range: 1});
			}
		}
		for (const hostile of creep.room.hostiles) {
			if (CombatIntel.getAttackPotential(hostile) > 0 || CombatIntel.getRangedAttackPotential(hostile) > 0) {
				avoid.push({pos: hostile.pos, range: 8});
			}
		}
		if (creep.room.owner && !creep.room.my) {
			for (const tower of creep.room.towers) {
				avoid.push({pos: tower.pos, range: 50});
			}
		}
		return {approach, avoid};
	}

	static retreatGoalsForRoom(room: Room): { approach: PathFinderGoal[], avoid: PathFinderGoal[] } {
		const avoid: PathFinderGoal[] = [];

		for (const hostile of room.hostiles) {
			if (CombatIntel.getAttackPotential(hostile) > 0 || CombatIntel.getRangedAttackPotential(hostile) > 0) {
				avoid.push({pos: hostile.pos, range: 8});
			}
		}
		if (room.owner && !room.my) {
			for (const tower of room.towers) {
				avoid.push({pos: tower.pos, range: 50});
			}
		}
		return {approach: [], avoid: avoid};
	}

	static healingGoals(healer: CombatZerg): { approach: PathFinderGoal[], avoid: PathFinderGoal[] } {
		const approach: PathFinderGoal[] = [];
		const avoid: PathFinderGoal[] = [];
		const healAmount = CombatIntel.getHealAmount(healer);
		let target = minBy(_.filter(healer.room.creeps, c => c.hits < c.hitsMax),
						   c => c.hits + healer.pos.getRangeTo(c));
		if (!target) {
			target = minBy(healer.room.creeps, creep => {
				const range = healer.pos.getRangeTo(creep);
				return range > 0 ? CombatIntel.maxFriendlyHealingTo(creep) / healAmount + range : false;
			});
		}
		if (target) {
			approach.push({pos: target.pos, range: 0});
		}
		for (const hostile of healer.room.hostiles) {
			const meleeDamage = CombatIntel.getAttackDamage(hostile);
			const rangedDamage = CombatIntel.getRangedAttackDamage(hostile);
			if (meleeDamage + rangedDamage > 0) {
				const range = rangedDamage > healAmount ? 4 : 3;
				avoid.push({pos: hostile.pos, range: range});
			}
		}
		return {approach, avoid};
	}

	static structureGoals(creep: CombatZerg): { approach: PathFinderGoal[], avoid: PathFinderGoal[] } {
		const approach: PathFinderGoal[] = [];

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


