import {profile} from '../profiler/decorator';
import {HiveCluster} from './_HiveCluster';
import {Colony} from '../Colony';
import {CombatIntel} from '../intel/CombatIntel';
import {$} from '../caching/GlobalCache';
import {CombatTargeting} from '../targeting/CombatTargeting';
import {WorkerOverlord} from '../overlords/core/worker';
import {TerminalState_Rebuild} from '../directives/terminalState/terminalState_rebuild';
import {log} from '../console/log';


/**
 * The spore crawler is the hive cluster for controlling towers within a room
 */
@profile
export class SporeCrawler extends HiveCluster {

	towers: StructureTower[];

	static settings = {
		requestThreshold       : 500,
		criticalEnergyThreshold: 250,
	};

	constructor(colony: Colony, tower: StructureTower) {
		super(colony, tower, 'sporeCrawler');
		// Register structure components
		this.towers = this.colony.towers;
	}

	refresh() {
		$.refreshRoom(this);
		$.refresh(this, 'towers');
	}

	spawnMoarOverlords() {

	}

	get memory(): undefined {
		return undefined;
	}

	private registerEnergyRequests() {
		// Request energy from transporters if below request threshold
		for (let tower of this.towers) {
			if (tower.energy < SporeCrawler.settings.requestThreshold) {
				let multiplier = tower.energy < SporeCrawler.settings.criticalEnergyThreshold ? 2 : 1;
				let dAmountdt = this.room.hostiles.length > 0 ? 10 : 0;
				this.colony.logisticsNetwork.requestInput(tower, {multiplier: multiplier, dAmountdt: dAmountdt});
			}
		}
	}

	init() {
		this.registerEnergyRequests();
	}

	private attack(target: Creep): void {
		for (let tower of this.towers) {
			let result = tower.attack(target);
			if (result == OK) {
				if (target.hitsPredicted == undefined) target.hitsPredicted = target.hits;
				target.hitsPredicted -= CombatIntel.singleTowerDamage(target.pos.getRangeTo(tower));
			}
		}
	}

	// private attackNearestEnemy(prioritizeHealers = false) {
	// 	if (prioritizeHealers) {
	// 		let healers = _.filter(this.room.hostiles, creep => creep.getActiveBodyparts(HEAL) > 0);
	// 		if (healers.length > 0) {
	// 			let healer = this.pos.findClosestByRange(healers);
	// 			if (healer) {
	// 				return this.tower.attack(healer);
	// 			}
	// 		}
	// 	}
	// 	let closestHostile = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
	// 	if (closestHostile) {
	// 		return this.tower.attack(closestHostile);
	// 	}
	// }

	// private healNearestAlly() {
	// 	var closestDamagedAlly = this.pos.findClosestByRange(FIND_MY_CREEPS, {
	// 		filter: (c: Creep) => c.hits < c.hitsMax,
	// 	});
	// 	if (closestDamagedAlly) {
	// 		return this.tower.heal(closestDamagedAlly);
	// 	}
	// }

	private preventRampartDecay() {
		if (this.colony.level < 7 && this.towers.length > 0) {
			// expensive to check all rampart hits; only run in intermediate RCL
			let dyingRamparts = _.filter(this.room.ramparts, rampart =>
				rampart.hits < WorkerOverlord.settings.barrierHits.critical
				&& this.colony.roomPlanner.barrierPlanner.barrierShouldBeHere(rampart.pos));
			if (dyingRamparts.length > 0) {
				for (let tower of this.towers) {
					tower.repair(tower.pos.findClosestByRange(dyingRamparts)!);
				}
			}
		}
	}

	// private repairNearestStructure() {
	// 	var closestDamagedStructure = this.pos.findClosestByRange(FIND_STRUCTURES, {
	// 		filter: (s: Structure) => s.hits < s.hitsMax &&
	// 								  s.structureType != STRUCTURE_WALL &&
	// 								  s.structureType != STRUCTURE_RAMPART,
	// 	});
	// 	if (closestDamagedStructure) {
	// 		return this.tower.repair(closestDamagedStructure);
	// 	}
	// }

	run() {
		if (this.room.hostiles.length > 0) {
			let myDefenders = _.filter(this.room.creeps, creep => creep.getActiveBodyparts(ATTACK) > 1);
			let myRangedDefenders = _.filter(this.room.creeps, creep => creep.getActiveBodyparts(RANGED_ATTACK) > 1);
			let myCreepDamage = ATTACK_POWER * _.sum(myDefenders, creep => CombatIntel.getAttackPotential(creep)) +
								RANGED_ATTACK_POWER * _.sum(myRangedDefenders,
															creep => CombatIntel.getRangedAttackPotential(creep));
			const HEAL_FUDGE_FACTOR = 1.0;
			let avgHealing = HEAL_FUDGE_FACTOR * CombatIntel.avgHostileHealingTo(this.room.hostiles);
			let possibleTargets = _.filter(this.room.hostiles, hostile => {
				// let healing = HEAL_FUDGE_FACTOR * CombatIntel.maxHostileHealingTo(hostile);
				let damageTaken = CombatIntel.towerDamageAtPos(hostile.pos)! + myCreepDamage;
				let damageMultiplier = CombatIntel.minimumDamageTakenMultiplier(hostile);
				return damageTaken * damageMultiplier > avgHealing;
			});
			// Only attack dancing targets (drain attack) which are far enough in rooms to be killed off by towers
			possibleTargets = _.filter(possibleTargets, hostile => {
				if (CombatIntel.isEdgeDancing(hostile)) {
					let netDPS = CombatIntel.towerDamageAtPos(hostile.pos)! + myCreepDamage
								 - (HEAL_FUDGE_FACTOR * CombatIntel.maxHostileHealingTo(hostile));
					let isKillable = netDPS * hostile.pos.rangeToEdge > hostile.hits;
					if (isKillable) {
						return true;
					} else {
						// Shoot if they get close enough
						if (this.colony.bunker && this.colony.bunker.anchor &&
							hostile.pos.getRangeTo(this.colony.bunker.anchor) <= 6 + 2) {
							return true;
						}
					}
				} else {
					return true;
				}
			});
			let target = CombatTargeting.findBestCreepTargetForTowers(this.room, possibleTargets);
			if (target) {
				return this.attack(target);
			}
		}

		let closestDamagedAlly = this.pos.findClosestByRange(_.filter(this.room.creeps,
																	  creep => creep.hits < creep.hitsMax));
		if (closestDamagedAlly) {
			for (let tower of this.towers) {
				tower.heal(closestDamagedAlly);
			}
			return;
		}

		// Towers build nuke response ramparts
		let nearbyNukeRamparts = _.filter(this.colony.overlords.work.nukeDefenseRamparts,
										  rampart => this.pos.getRangeTo(rampart) <= TOWER_OPTIMAL_RANGE);
		if (nearbyNukeRamparts.length > 0 && this.colony.terminal
			&& this.colony.terminalState != TerminalState_Rebuild) {
			let nukes = this.colony.room.find(FIND_NUKES);
			let timeToImpact = _.min(_.map(nukes, nuke => nuke.timeToLand));
			if (timeToImpact) {
				let repairHitsRemaining = _.sum(_.values(this.colony.overlords.work.nukeDefenseHitsRemaining));
				let hitsRepairedPerTick = this.towers.length * TOWER_POWER_REPAIR;
				// Only repair using towers if it looks like you won't finish repairs in time
				if (repairHitsRemaining > 0.9 * hitsRepairedPerTick * timeToImpact) {
					for (let tower of this.towers) {
						tower.repair(nearbyNukeRamparts[0]);
					}
					return;
				}
			} else {
				// Shouldn't get here
				log.warning(`No time to impact! (Why?)`);
			}
		}

		// Prevent rampart decay at early RCL
		this.preventRampartDecay();
	}

	visuals() {

	}
}