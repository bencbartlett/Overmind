import {profile} from '../profiler/decorator';
import {HiveCluster} from './_HiveCluster';
import {Colony} from '../Colony';
import {CombatIntel} from '../intel/combatIntel';

// Hive cluster for wrapping towers

@profile
export class SporeCrawler extends HiveCluster {

	tower: StructureTower;

	static settings = {
		requestThreshold       : 500,
		criticalEnergyThreshold: 250,
	};

	constructor(colony: Colony, tower: StructureTower) {
		super(colony, tower, 'sporeCrawler');
		// Register structure components
		this.tower = tower;
	}

	get memory(): undefined {
		return undefined;
	}

	private registerEnergyRequests() {
		// Request energy from transporters if below request threshold
		if (this.tower.energy < SporeCrawler.settings.requestThreshold) {
			let multiplier = this.tower.energy < SporeCrawler.settings.criticalEnergyThreshold ? 2 : 1;
			let dAmountdt = this.room.hostiles.length > 0 ? 10 : 0;
			this.colony.logisticsNetwork.request(this.tower, {multiplier: multiplier, dAmountdt: dAmountdt});
		}
	}

	init() {
		this.registerEnergyRequests();
	}

	private attackNearestEnemy(prioritizeHealers = false) {
		if (prioritizeHealers) {
			let healers = _.filter(this.room.hostiles, creep => creep.getActiveBodyparts(HEAL) > 0);
			if (healers.length > 0) {
				return this.tower.attack(this.pos.findClosestByRange(healers));
			}
		}
		let closestHostile = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
		if (closestHostile) {
			return this.tower.attack(closestHostile);
		}
	}

	private healNearestAlly() {
		var closestDamagedAlly = this.pos.findClosestByRange(FIND_MY_CREEPS, {
			filter: (c: Creep) => c.hits < c.hitsMax,
		});
		if (closestDamagedAlly) {
			return this.tower.heal(closestDamagedAlly);
		}
	}

	private preventRampartDecay() {
		let hp = 500; // TODO: hardwired
		var closestDyingRampart = this.pos.findClosestByRange(FIND_STRUCTURES, {
			filter: (s: Structure) => s.hits < hp && s.structureType == STRUCTURE_RAMPART,
		});
		if (closestDyingRampart) {
			return this.tower.repair(closestDyingRampart);
		}
	}

	private repairNearestStructure() {
		var closestDamagedStructure = this.pos.findClosestByRange(FIND_STRUCTURES, {
			filter: (s: Structure) => s.hits < s.hitsMax &&
									  s.structureType != STRUCTURE_WALL &&
									  s.structureType != STRUCTURE_RAMPART,
		});
		if (closestDamagedStructure) {
			return this.tower.repair(closestDamagedStructure);
		}
	}

	run() {
		if (this.room.hostiles.length > 0) {
			let myDefenders = _.filter(this.room.creeps, creep => creep.getActiveBodyparts(ATTACK) > 1);
			let myRangedDefenders = _.filter(this.room.creeps, creep => creep.getActiveBodyparts(RANGED_ATTACK) > 1);
			let myDamage = ATTACK_POWER * _.sum(_.map(myDefenders, creep => CombatIntel.getAttackPotential(creep))) +
						   RANGED_ATTACK_POWER * _.sum(_.map(myRangedDefenders,
															 creep => CombatIntel.getRangedAttackPotential(creep)));
			let possibleTargets = _.filter(this.room.hostiles,
										   hostile => CombatIntel.maxHostileHealingTo(hostile) <
													  CombatIntel.towerDamageAtPos(hostile.pos, true)! + myDamage);
			let target = this.pos.findClosestByRange(possibleTargets);
			if (target) {
				return this.tower.attack(target);
			}
		}

		let closestDamagedAlly = this.pos.findClosestByRange(_.filter(this.room.creeps,
																	  creep => creep.hits < creep.hitsMax));
		if (closestDamagedAlly) {
			return this.tower.heal(closestDamagedAlly);
		}

		// Towers build nuke response ramparts
		let nearbyNukeRamparts = _.filter(this.colony.overlords.work.nukeDefenseRamparts,
										  rampart => this.pos.getRangeTo(rampart) <= TOWER_OPTIMAL_RANGE);
		if (nearbyNukeRamparts.length > 0) {
			return this.tower.repair(nearbyNukeRamparts[0]);
		}

		this.preventRampartDecay();
	}

	visuals() {

	}
}