// Sieger - large armored worker specializing in taking down walls while under fire
// Best used to siege a contiguous room; healing stations of some sort should be stationed in the neighboring room
// Sieger will dismanlte walls while under fire until it is low enough that it needs to leave the room to be healed

import {TaskGoToRoom} from '../tasks/task_goToRoom';
import {TaskDismantle} from '../tasks/task_dismantle';
import {AbstractCreep, AbstractSetup} from './Abstract';
import {log} from '../lib/logger/log';
import {profileClass} from '../profiling';


export class SiegerSetup extends AbstractSetup {
	constructor() {
		super('sieger');
		// Role-specific settings
		this.body.boost = {
			tough: RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
			work : RESOURCE_CATALYZED_ZYNTHIUM_ACID,
			move : RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
			heal : RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
		};
		if (this.body.boost && this.body.boost.move) {
			this.body.pattern = [TOUGH, WORK, WORK, MOVE, HEAL];
		} else {
			this.body.pattern = [TOUGH, WORK, MOVE, MOVE, MOVE, HEAL];
		}
		this.body.ordered = true;
		let nonArmoredBodyPattern = [WORK, MOVE];
		this.body.pattern = nonArmoredBodyPattern;
	}

	onCreate(creep: protoCreep): protoCreep {
		creep.memory.roleData.healFlag = 'HP1'; // TODO: hard coded
		return creep;
	}
}

export class SiegerCreep extends AbstractCreep {

	assignment: Flag;

	constructor(creep: Creep) {
		super(creep);
	}

	findTarget(): Structure | void {
		var target;
		var targetPriority = [
			() => this.pos.findClosestByRange(_.map(_.filter(this.room.flags, flagCodes.destroy.dismantle.filter),
													(flag: Flag) => flag.pos.lookFor(LOOK_STRUCTURES)[0])),
			// () => this.pos.findClosestByRange(FIND_HOSTILE_SPAWNS),
			() => this.pos.findClosestByRange(
				FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hits && s.structureType == STRUCTURE_TOWER}),
			() => this.pos.findClosestByRange(
				FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hits && s.structureType != STRUCTURE_RAMPART}),
			() => this.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hits}),
			() => this.pos.findClosestByRange(FIND_STRUCTURES, {
				filter: (s: Structure) => !s.room.my && !s.room.reservedByMe && s.hits,
			}),
		];
		for (let targetThis of targetPriority) {
			target = targetThis() as Structure;
			if (target) {
				return target;
			}
		}
	}

	retreatAndHeal() { // TODO: make this a task
		this.heal(this);
		return this.travelTo(this.memory.roleData.healFlag, {allowHostile: true});
	}

	getBoosted(): void {
		// for (let bodypart in this.settings.boost) {
		// 	if (this.settings.boost[bodypart] &&
		// 		!(this.memory.boosted && this.memory.boosted[this.settings.boostMinerals[bodypart]])) {
		// 		let boosters = _.filter(this.room.labs, (lab: StructureLab) =>
		// 								lab.assignedMineralType == this.settings.boostMinerals[bodypart] &&
		// 								lab.mineralAmount >= 30 * this.getActiveBodyparts(bodypart),
		// 		);
		// 		if (boosters.length > 0) {
		// 			this.task = new TaskGetBoosted(boosters[0]);
		// 		}
		// 	}
		// }
	}

	newTask() {
		this.task = null;
		// 2.1: move to same room as assignment
		if (this.assignment && !this.creep.inSameRoomAs(this.assignment)) {
			let task = new TaskGoToRoom(this.assignment);
			task.data.travelToOptions['allowHostile'] = true;
			this.task = task;
			return;
		}
		// 2.2: ATTACK SOMETHING
		var target = this.findTarget();
		if (target) {
			let task = new TaskDismantle(target);
			task.data.travelToOptions['allowHostile'] = true;
			this.task = task;
		}
	}

	run() {
		this.getBoosted();
		var assignment = this.assignment as Flag;
		// 1: retreat to heal point when injured
		if (deref(this.memory.roleData.healFlag) && // if there's a heal flag
			(this.getActiveBodyparts(TOUGH) < 0.5 * this.getBodyparts(TOUGH) || // if you're injured
			 (this.memory.roleData.needsHealing && this.hits < this.hitsMax))) { // if you're healing and not full hp
			// TODO: dps-based calculation
			this.memory.roleData.needsHealing = true;
			return this.retreatAndHeal();
		} else {
			this.memory.roleData.needsHealing = false; // turn off when done healing
		}
		// 2: task assignment
		this.assertValidTask();
		// execute task
		if (this.task) {
			return this.task.run();
		}
		// remove flag once everything is destroyed
		if (assignment && this.room.hostileStructures.length == 0) {
			log.info('No remaining hostile structures in room; deleting flag!');
			assignment.remove();
		}
	}
}

profileClass(SiegerSetup);
profileClass(SiegerCreep);
