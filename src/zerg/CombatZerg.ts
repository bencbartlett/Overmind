import {Zerg} from './Zerg';
import {CombatTargeting} from '../targeting/CombatTargeting';
import {profile} from '../profiler/decorator';
import {CombatIntel} from '../intel/combatIntel';

@profile
export class CombatZerg extends Zerg {

	constructor(creep: Creep) {
		super(creep);
	}

	findPartner(partners: CombatZerg[], tickDifference = 600): CombatZerg | undefined {
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

	autoMelee(possibleTargets = this.room.hostiles) {
		let target = CombatTargeting.findBestTargetInRange(this, 1, possibleTargets);
		if (target) {
			return this.attack(target);
		}
	}

	autoRanged(possibleTargets = this.room.hostiles) {
		let target = CombatTargeting.findBestTargetInRange(this, 3, possibleTargets);
		if (target) {
			if (CombatIntel.getMassAttackDamage(this, possibleTargets) > CombatIntel.getRangedAttackDamage(this)) {

			}
			return this.attack(target);
		}
	}

	autoHeal(allowRangedHeal = true, friendlies = this.room.creeps) {
		let target = CombatTargeting.findBestHealingTargetInRange(this, 3, friendlies);
		if (target) {
			if (this.pos.getRangeTo(target) <= 1) {
				return this.heal(target);
			} else if (allowRangedHeal && this.pos.getRangeTo(target) <= 3) {
				return this.rangedHeal(target);
			}
		}
	}

}