import {profile} from '../lib/Profiler';
import {HiveCluster} from './HiveCluster';
import {Colony} from '../Colony';

// Hive cluster for wrapping towers

@profile
export class SporeCrawler extends HiveCluster {
	tower: StructureTower;

	constructor(colony: Colony, tower: StructureTower) {
		super(colony, tower, 'sporeCrawler');
		// Register structure components
		this.tower = tower;
	}

	get memory(): undefined {
		return undefined;
	}

	init() {

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
		// Task priority for towers: attack, then heal, then repair
		var taskPriority = [
			() => this.attackNearestEnemy(),
			() => this.healNearestAlly(),
			() => this.preventRampartDecay(),
			// () => this.repairNearestStructure(),
		];
		for (let task of taskPriority) {
			if (task() == OK) {
				break;
			}
		}
	}

	visuals() {

	}
}