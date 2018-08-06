import {Zerg} from './Zerg';
import {CombatTargeting} from '../targeting/CombatTargeting';
import {profile} from '../profiler/decorator';
import {CombatIntel} from '../intel/CombatIntel';
import {GoalFinder} from '../targeting/GoalFinder';
import {Movement, NO_ACTION} from '../movement/Movement';
import {log} from '../console/log';

interface CombatZergMemory extends CreepMemory {
	recovering: boolean;
	lastInDanger: number;
	partner?: string;
	retreating?: boolean;
}

@profile
export class CombatZerg extends Zerg {

	memory: CombatZergMemory;

	constructor(creep: Creep) {
		super(creep);
		_.defaults(this.memory, {
			recovering  : false,
			lastInDanger: 0,
			targets     : {}
		});
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

	// Standard action sequences for engaging small numbers of enemies in a neutral room ===============================

	autoMelee(possibleTargets = this.room.hostiles) {
		let target = CombatTargeting.findBestTargetInRange(this, 1, possibleTargets);
		log.debug(`melee target: `, JSON.stringify(target));
		if (target) {
			log.debugCreep(this, `Attack`);
			return this.attack(target);
		}
	}

	autoRanged(possibleTargets = this.room.hostiles, allowMassAttack = true) {
		let target = CombatTargeting.findBestTargetInRange(this, 3, possibleTargets);
		log.debug(`ranged target: `, JSON.stringify(target));
		if (target) {
			if (allowMassAttack
				&& CombatIntel.getMassAttackDamage(this, possibleTargets) > CombatIntel.getRangedAttackDamage(this)) {
				log.debugCreep(this, `RMA`);
				return this.rangedMassAttack();
			} else {
				log.debugCreep(this, `RangedAttack`);
				return this.rangedAttack(target);
			}
		}
	}

	autoHeal(allowRangedHeal = true, friendlies = this.room.creeps) {
		let target = CombatTargeting.findBestHealingTargetInRange(this, 3, friendlies);
		if (target) {
			if (this.pos.getRangeTo(target) <= 1) {
				log.debugCreep(this, `Healing`);
				return this.heal(target);
			} else if (allowRangedHeal && this.pos.getRangeTo(target) <= 3) {
				log.debugCreep(this, `RangedHealing`);
				return this.rangedHeal(target);
			}
		}
	}

	/* Navigate to a room, then engage hostile creeps there, perform medic actions, etc. */
	autoCombat(roomName: string) {

		// Do standard melee, ranged, and heal actions
		if (this.getActiveBodyparts(ATTACK) > 0) {
			this.autoMelee(); // Melee should be performed first
		}
		if (this.getActiveBodyparts(RANGED_ATTACK) > 0) {
			this.autoRanged();
		}
		if (this.canExecute('heal')) {
			this.autoHeal();
		}

		// Handle recovery if low on HP
		if (this.needsToRecover()) {
			return this.recover();
		}

		// Travel to the target room
		if (!this.safelyInRoom(roomName)) {
			return this.goToRoom(roomName, {ensurePath: true});
		}

		// Skirmish within the room
		let goals = GoalFinder.skirmishGoals(this);
		return Movement.combatMove(this, goals.approach, goals.avoid);

	}

	needsToRecover(hitsThreshold = 0.75): boolean {
		if (this.memory.recovering) {
			return this.hits < this.hitsMax;
		} else {
			return this.hits < this.hitsMax * hitsThreshold;
		}
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