import {Zerg} from './Zerg';
import {CombatTargeting} from '../targeting/CombatTargeting';
import {profile} from '../profiler/decorator';
import {CombatIntel} from '../intel/CombatIntel';
import {GoalFinder} from '../targeting/GoalFinder';
import {Movement, NO_ACTION} from '../movement/Movement';

interface CombatZergMemory extends CreepMemory {
	recovering: boolean;
	lastInDanger: number;
	partner?: string;
}


@profile
export class CombatZerg extends Zerg {

	memory: CombatZergMemory;

	constructor(creep: Creep, notifyWhenAttacked = true) {
		super(creep, notifyWhenAttacked);
		_.defaults(this.memory, {
			recovering  : false,
			lastInDanger: 0,
			targets     : {}
		});
	}

	findPartner(partners: CombatZerg[], tickDifference = 750): CombatZerg | undefined {
		if (this.spawning || !this.ticksToLive) {
			return;
		}
		if (this.memory.partner) {
			let partner = _.find(partners, partner => partner.name == this.memory.partner);
			if (partner) {
				return partner;
			} else {
				delete this.memory.partner;
				this.findPartner(partners, tickDifference);
			}
		} else {
			let partner = _.find(partners, partner => partner.memory.partner == this.name);
			if (!partner) {
				partner = _(partners)
					.filter(partner => !partner.memory.partner && !partner.spawning && partner.ticksToLive &&
									   Math.abs(this.ticksToLive! - partner.ticksToLive) <= tickDifference)
					.min(partner => Math.abs(this.ticksToLive! - partner.ticksToLive!));
			}
			if (_.isObject(partner)) {
				this.memory.partner = partner.name;
				partner.memory.partner = this.name;
				return partner;
			}
		}
	}

	/* Move to and heal/rangedHeal the specified target */
	doMedicActions(): void {
		let target = CombatTargeting.findClosestHurtFriendly(this);
		if (target) {
			// Approach the target
			let range = this.pos.getRangeTo(target);
			if (range > 1) {
				this.goTo(target, {movingTarget: true});
			}

			// Heal or ranged-heal the target
			if (range <= 1) {
				this.heal(target);
			} else if (range <= 3) {
				this.rangedHeal(target);
			}
		} else {
			this.park();
		}
	}

	healSelfIfPossible(): CreepActionReturnCode | undefined {
		// Heal yourself if it won't interfere with attacking
		if (this.canExecute('heal')
			&& (this.hits < this.hitsMax || this.pos.findInRange(this.room.hostiles, 3).length > 0)) {
			return this.heal(this);
		}
	}

	/* Attack and chase the specified target */
	attackAndChase(target: Creep | Structure): CreepActionReturnCode {
		let ret: CreepActionReturnCode;
		// Attack the target if you can, else move to get in range
		if (this.pos.isNearTo(target)) {
			ret = this.attack(target);
			// Move in the direction of the creep to prevent it from running away
			this.move(this.pos.getDirectionTo(target));
			return ret;
		} else {
			if (this.pos.getRangeTo(target.pos) > 10 && target instanceof Creep) {
				this.goTo(target, {movingTarget: true});
			} else {
				this.goTo(target);
			}
			return ERR_NOT_IN_RANGE;
		}
	}

	// Standard action sequences for engaging small numbers of enemies in a neutral room ===============================

	autoMelee(possibleTargets = this.room.hostiles) {
		let target = CombatTargeting.findBestTargetInRange(this, 1, possibleTargets);
		this.debug(`Melee target: ${target}`);
		if (target) {
			return this.attack(target);
		}
		let structureTarget = CombatTargeting.findBestStructureTargetInRange(this, 1);
		this.debug(`Melee structure target: ${target}`);
		if (structureTarget) {
			return this.attack(structureTarget);
		}
	}

	autoRanged(possibleTargets = this.room.hostiles, allowMassAttack = true) {
		let target = CombatTargeting.findBestTargetInRange(this, 3, possibleTargets);
		this.debug(`Ranged target: ${target}`);
		if (target) {
			if (allowMassAttack
				&& CombatIntel.getMassAttackDamage(this, possibleTargets) > CombatIntel.getRangedAttackDamage(this)) {
				return this.rangedMassAttack();
			} else {
				return this.rangedAttack(target);
			}
		}
	}

	autoHeal(allowRangedHeal = true, friendlies = this.room.creeps) {
		let target = CombatTargeting.findBestHealingTargetInRange(this, 3, friendlies);
		this.debug(`Heal taget: ${target}`);
		if (target) {
			if (this.pos.getRangeTo(target) <= 1) {
				return this.heal(target);
			} else if (allowRangedHeal && this.pos.getRangeTo(target) <= 3) {
				return this.rangedHeal(target);
			}
		}
	}

	/* Navigate to a room, then engage hostile creeps there, perform medic actions, etc. */
	autoSkirmish(roomName: string, verbose = false) {

		// Do standard melee, ranged, and heal actions
		if (this.getActiveBodyparts(ATTACK) > 0) {
			this.autoMelee(); // Melee should be performed first
		}
		if (this.getActiveBodyparts(RANGED_ATTACK) > 0) {
			this.autoRanged();
		}
		if (this.canExecute('heal')) {
			this.autoHeal(this.canExecute('rangedHeal'));
		}

		// Handle recovery if low on HP
		if (this.needsToRecover()) {
			this.debug(`Recovering!`);
			return this.recover();
		}

		// Travel to the target room
		if (!this.safelyInRoom(roomName)) {
			this.debug(`Going to room!`);
			return this.goToRoom(roomName, {ensurePath: true});
		}

		// Skirmish within the room
		let goals = GoalFinder.skirmishGoals(this);
		this.debug(JSON.stringify(goals));
		return Movement.combatMove(this, goals.approach, goals.avoid);

	}

	/* Navigate to a room, then engage hostile creeps there, perform medic actions, etc. */
	autoCombat(roomName: string, verbose = false) {

		// Do standard melee, ranged, and heal actions
		if (this.getActiveBodyparts(ATTACK) > 0) {
			this.autoMelee(); // Melee should be performed first
		}
		if (this.getActiveBodyparts(RANGED_ATTACK) > 0) {
			this.autoRanged();
		}
		if (this.canExecute('heal')) {
			this.autoHeal(this.canExecute('rangedHeal'));
		}

		// Handle recovery if low on HP
		if (this.needsToRecover()) {
			this.debug(`Recovering!`);
			return this.recover();
		}

		// Travel to the target room
		if (!this.safelyInRoom(roomName)) {
			this.debug(`Going to room!`);
			return this.goToRoom(roomName, {ensurePath: true});
		}

		// Fight within the room
		const target = CombatTargeting.findTarget(this);
		const targetRange = this.getActiveBodyparts(RANGED_ATTACK) > this.getActiveBodyparts(ATTACK) ? 3 : 1;
		this.debug(target, targetRange);
		if (target) {
			return Movement.combatMove(this, [{pos: target.pos, range: targetRange}], []);
		}

	}

	needsToRecover(hitsThreshold = 0.75, reengageThreshold = 1.0): boolean {
		let recovering: boolean;
		if (this.memory.recovering) {
			recovering = this.hits < this.hitsMax * reengageThreshold;
		} else {
			recovering = this.hits < this.hitsMax * hitsThreshold;
		}
		this.memory.recovering = recovering;
		return recovering;
	}

	recover() {
		if (this.pos.findInRange(this.room.hostiles, 5).length > 0 || this.room.towers.length > 0) {
			this.memory.lastInDanger = Game.time;
		}
		let goals = GoalFinder.retreatGoals(this);
		let result = Movement.combatMove(this, goals.approach, goals.avoid);

		if (result == NO_ACTION && this.pos.isEdge) {
			if (Game.time < this.memory.lastInDanger + 3) {
				return this.moveOffExit();
			}
		}
		return result;
	}


}