import {Zerg} from './Zerg';
import {CombatTargeting} from '../targeting/CombatTargeting';
import {profile} from '../profiler/decorator';
import {CombatIntel} from '../intel/CombatIntel';
import {GoalFinder} from '../targeting/GoalFinder';
import {Movement, NO_ACTION} from '../movement/Movement';
import {randomHex} from '../utilities/utils';

interface CombatZergMemory extends CreepMemory {
	recovering: boolean;
	lastInDanger: number;
	partner?: string;
	swarm?: string;
}


@profile
export class CombatZerg extends Zerg {

	memory: CombatZergMemory;
	isCombatZerg: boolean;

	constructor(creep: Creep, notifyWhenAttacked = true) {
		super(creep, notifyWhenAttacked);
		this.isCombatZerg = true;
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

	findSwarm(partners: CombatZerg[], maxByRole: { [role: string]: number }, tickDifference = 750): string | undefined {
		if (this.spawning || !this.ticksToLive) {
			return;
		}
		if (this.memory.swarm) {
			return this.memory.swarm;
		} else {
			// Find a swarm that isn't too old and that has space for the creep's role
			let partnersBySwarm = _.groupBy(partners, partner => partner.memory.swarm);
			for (let swarmRef in partnersBySwarm) {
				if (swarmRef == undefined) continue;
				if (_.all(partnersBySwarm[swarmRef],
						  c => Math.abs(this.ticksToLive! - (c.ticksToLive || Infinity)) <= tickDifference)) {
					let swarmCreepsByRole = _.groupBy(partnersBySwarm[swarmRef], c => c.memory.role);
					if ((swarmCreepsByRole[this.memory.role] || []).length + 1 <= maxByRole[this.memory.role]) {
						this.memory.swarm = swarmRef;
						return swarmRef;
					}
				}
			}
			// Otherwise just make a new swarm ref
			let newSwarmRef = randomHex(6);
			this.memory.swarm = newSwarmRef;
			return newSwarmRef;
		}
	}

	/* Move to and heal/rangedHeal the specified target */
	doMedicActions(roomName: string): void {
		// Travel to the target room
		if (!this.safelyInRoom(roomName)) {
			this.goToRoom(roomName, {ensurePath: true});
			return;
		}
		// Heal friendlies
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
		let target = CombatTargeting.findBestCreepTargetInRange(this, 1, possibleTargets)
					 || CombatTargeting.findBestStructureTargetInRange(this, 1);
		this.debug(`Melee target: ${target}`);
		if (target) {
			return this.attack(target);
		}
	}

	autoRanged(possibleTargets = this.room.hostiles, allowMassAttack = true) {
		let target = CombatTargeting.findBestCreepTargetInRange(this, 3, possibleTargets)
					 || CombatTargeting.findBestStructureTargetInRange(this, 3);
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
		let target = CombatTargeting.findBestHealingTargetInRange(this, allowRangedHeal ? 3 : 1, friendlies);
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
		this.debug(`${target}, ${targetRange}`);
		if (target) {
			return Movement.combatMove(this, [{pos: target.pos, range: targetRange}], []);
		}

	}

	needsToRecover(recoverThreshold  = CombatIntel.minimumDamageTakenMultiplier(this.creep) < 1 ? 0.85 : 0.75,
				   reengageThreshold = 1.0): boolean {
		let recovering: boolean;
		if (this.memory.recovering) {
			recovering = this.hits < this.hitsMax * reengageThreshold;
		} else {
			recovering = this.hits < this.hitsMax * recoverThreshold;
		}
		this.memory.recovering = recovering;
		return recovering;
	}

	recover() {
		if (this.pos.findInRange(this.room.hostiles, 5).length > 0 || this.room.towers.length > 0) {
			this.memory.lastInDanger = Game.time;
		}
		let goals = GoalFinder.retreatGoals(this);
		let result = Movement.combatMove(this, goals.approach, goals.avoid, {allowExit: true});

		if (result == NO_ACTION && this.pos.isEdge) {
			if (Game.time < this.memory.lastInDanger + 3) {
				return this.moveOffExit();
			}
		}
		return result;
	}


}