import {ColonyStage} from '../../Colony';
import {log} from '../../console/log';
import {isResource} from '../../declarations/typeGuards';
import {profile} from '../../profiler/decorator';
import {maxBy, minMax} from '../../utilities/utils';
import {Zerg} from '../../zerg/Zerg';
import {Task} from '../Task';
import {TaskHarvest} from './harvest';
import {pickupTaskName, TaskPickup} from './pickup';
import {TaskWithdraw, withdrawTaskName} from './withdraw';

export type rechargeTargetType = HasRef & HasPos;  // This is handled better in the Tasks.recharge() dispatcher
// export type rechargeTargetType = null;
export const rechargeTaskName = 'recharge';

// This is a "dispenser task" which is not itself a valid task, but dispenses a task when assigned to a creep.

@profile
export class TaskRecharge extends Task<rechargeTargetType> {

	data: {
		minEnergy: number;
	};

	constructor(minEnergy = 0, options = {} as TaskOptions) {
		super(rechargeTaskName, {ref: '', pos: {x: -1, y: -1, roomName: ''}}, options);
		this.data.minEnergy = minEnergy;
	}

	private rechargeRateForCreep(creep: Zerg, obj: rechargeObjectType): number | false {
		if (creep.colony && creep.colony.hatchery && creep.colony.hatchery.batteries.length > 0
			&& creep.roleName != 'queen') {
			if (creep.colony.stage == ColonyStage.Larva) {
				const MINIMUM_BATTERY_THRESHOLD = 1500;
				if (_.any(creep.colony.hatchery.batteries,
						  battery => battery.id == obj.id && battery.energy < MINIMUM_BATTERY_THRESHOLD)) {
					return false; // at low levels allow others to use hatchery battery if it is almost full
				}
			} else {
				if (_.any(creep.colony.hatchery.batteries, battery => battery.id == obj.id)) {
					return false; // only queens can use the hatchery batteries
				}
			}
		}

		// Don't allow workers to withdraw from mining containers at lower levels
		if (creep.colony && creep.colony.stage == ColonyStage.Larva && creep.roleName == 'worker') {
			const miningSiteContainers = _.compact(_.map(creep.colony.miningSites, site => site.overlords.mine.container));
			// if this is a mining site container, don't let creeps withdraw from it unless it is sort of full
			const CONTAINER_THRESHOLD = 1000;
			if (_.any(miningSiteContainers, (c: StructureContainer) => c.id == obj.id && c.energy < CONTAINER_THRESHOLD)) {
				return false;
			}
		}

		let amount = isResource(obj) ? obj.amount : obj.store[RESOURCE_ENERGY];
		if (amount < this.data.minEnergy) {
			return false;
		}

		// TODO: generalize this into a getPredictedStore function which includes all targeting creeps
		const otherTargeters = _.filter(_.map(obj.targetedBy, name => Overmind.zerg[name]),
										zerg => !!zerg && zerg.task
												&& (zerg.task.name == withdrawTaskName || zerg.task.name == pickupTaskName));

		const resourceOutflux = _.sum(_.map(otherTargeters, other => other.store.getFreeCapacity()));
		amount = minMax(amount - resourceOutflux, 0, creep.carryCapacity);
		const effectiveAmount = amount / (creep.pos.getMultiRoomRangeTo(obj.pos) + 1);
		if (effectiveAmount <= 0) {
			return false;
		} else {
			return effectiveAmount;
		}
	}

	// Override creep setter to dispense a valid recharge task
	set creep(creep: Zerg) {
		this._creep.name = creep.name;
		if (this._parent) {
			this.parent!.creep = creep;
		}
		// Choose the target to maximize your energy gain subject to other targeting workers
		const possibleTargets = creep.colony && creep.inColonyRoom ? creep.colony.rechargeables
																   : creep.room.rechargeables;

		const target = maxBy(possibleTargets, o => this.rechargeRateForCreep(creep, o));
		if (!target || creep.pos.getMultiRoomRangeTo(target.pos) > 40) {
			// workers shouldn't harvest; let drones do it (disabling this check can destabilize early economy)
			const canHarvest = creep.getActiveBodyparts(WORK) > 0 && creep.roleName != 'worker';
			if (canHarvest) {
				// Harvest from a source if there is no recharge target available
				const availableSources = _.filter(creep.room.sources, function(source) {
					const filledSource = source.energy > 0 || source.ticksToRegeneration < 20;
					// Only harvest from sources which aren't surrounded by creeps excluding yourself
					const isSurrounded = source.pos.availableNeighbors(false).length == 0;
					return filledSource && (!isSurrounded || creep.pos.isNearTo(source));
				});
				const availableSource = creep.pos.findClosestByMultiRoomRange(availableSources);
				if (availableSource) {
					creep.task = new TaskHarvest(availableSource);
					return;
				}
			}
		}
		if (target) {
			// log.debug(`target: ${target}`);
			if (isResource(target)) {
				creep.task = new TaskPickup(target);
				return;
			} else {
				creep.task = new TaskWithdraw(target);
				return;
			}
		} else {
			// if (creep.roleName == 'queen') {
			log.debug(`No valid withdraw target for ${creep.print}!`);
			// }
			creep.task = null;
		}
	}

	isValidTask() {
		return false;
	}

	isValidTarget() {
		return false;
	}

	work() {
		log.warning(`BAD RESULT: Should not get here...`);
		return ERR_INVALID_TARGET;
	}
}
