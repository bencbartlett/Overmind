import {CombatIntel} from '../intel/CombatIntel';
import {minBy} from '../utilities/utils';
import {CombatZerg} from '../zerg/CombatZerg';
import {log} from '../console/log';
import {RoomIntel} from '../intel/RoomIntel';


interface SkirmishAnalysis {
	attack: number,
	rangedAttack: number,
	heal: number,
	advantage: boolean,
	isRetreating: boolean,
	isApproaching: boolean,
}

const DEBUG = false;

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
							   myAttack + myRangedAttack - healing > attack + rangedAttack - myHealing,
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
				if (!preferCloseCombat && (data.attack > 0 || data.rangedAttack > myAttack)) {
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

	static retreatGoals(room: Room): { approach: PathFinderGoal[], avoid: PathFinderGoal[] } {
		let avoid: PathFinderGoal[] = [];
		for (let hostile of room.hostiles) {
			if (CombatIntel.getAttackPotential(hostile) > 0 || CombatIntel.getRangedAttackPotential(hostile) > 0) {
				avoid.push({pos: hostile.pos, range: 10});
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


