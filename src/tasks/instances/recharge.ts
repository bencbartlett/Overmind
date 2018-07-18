import {Task} from '../Task';
import {profile} from '../../profiler/decorator';
import {Zerg} from '../../zerg/Zerg';
import {maxBy, minMax} from '../../utilities/utils';
import {isResource} from '../../declarations/typeGuards';
import {TaskWithdraw, withdrawTaskName} from './withdraw';
import {pickupTaskName, TaskPickup} from './pickup';
import {TaskHarvest} from './harvest';
import {log} from '../../console/log';

export type rechargeTargetType = null;
export const rechargeTaskName = 'recharge';

// This is a "dispenser task" which is not itself a valid task, but dispenses a task when assigned to a creep.

@profile
export class TaskRecharge extends Task {
	target: rechargeTargetType;

	data: {
		minEnergy: number;
	};

	constructor(target: rechargeTargetType, minEnergy = 0, options = {} as TaskOptions) {
		super(rechargeTaskName, {ref: '', pos: {x: -1, y: -1, roomName: ''}}, options);
		this.data.minEnergy = minEnergy;
	}

	// Override creep setter to dispense a valid recharge task
	set creep(creep: Zerg) {
		// Choose the target to maximize your energy gain subject to other targeting workers
		let minEnergy = this.data.minEnergy;
		let target = maxBy(creep.colony.rechargeables, function (obj) {
			let amount = isResource(obj) ? obj.amount : obj.energy;
			if (amount < minEnergy) {
				return false;
			}
			let otherTargeters = _.filter(_.map(obj.targetedBy, name => Game.zerg[name]),
										  zerg => zerg.memory._task && (zerg.memory._task.name == withdrawTaskName
																		|| zerg.memory._task.name == pickupTaskName));
			let resourceOutflux = _.sum(_.map(otherTargeters,
											  other => other.carryCapacity - _.sum(other.carry)));
			amount = minMax(amount - resourceOutflux, 0, creep.carryCapacity);
			let effectiveAmount = amount / (creep.pos.getMultiRoomRangeTo(obj.pos) + 1);
			if (effectiveAmount <= 0) {
				return false;
			} else {
				return effectiveAmount;
			}
		});
		if (target) {
			if (isResource(target)) {
				creep.task = new TaskPickup(target);
			} else {
				creep.task = new TaskWithdraw(target);
			}
		} else {
			if (creep.getActiveBodyparts(WORK) > 0) {
				// Harvest from a source if there is no recharge target available
				let emptyMiningSites = _.filter(creep.colony.miningSites, site =>
					site.overlord.miners.length < site.source.pos.availableNeighbors(true).length);
				let target = creep.pos.findClosestByMultiRoomRange(emptyMiningSites);
				if (target) {
					creep.task = new TaskHarvest(target.source);
				} else {
					creep.task = null;
				}
			} else {
				if (creep.roleName == 'queen') {
					log.debug(`No valid withdraw target for ${creep.name}@${creep.pos.print}!`);
				}
				creep.task = null;
			}
		}
	}

	isValidTask() {
		return false;
	}

	isValidTarget() {
		return false;
	}

	work() {
		return ERR_INVALID_TARGET;
	}
}
