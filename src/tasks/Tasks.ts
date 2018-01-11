import {attackTargetType, TaskAttack} from './task_attack';
import {buildTargetType, TaskBuild} from './task_build';
import {claimTargetType, TaskClaim} from './task_claim';
import {depositTargetType, TaskDeposit} from './task_deposit';
import {dismantleTargetType, TaskDismantle} from './task_dismantle';
import {fortifyTargetType, TaskFortify} from './task_fortify';
import {getBoostedTargetType, TaskGetBoosted} from './task_getBoosted';
import {getRenewedTargetType, TaskGetRenewed} from './task_getRenewed';
import {goToTargetType, TaskGoTo} from './task_goTo';
import {goToRoomTargetType, TaskGoToRoom} from './task_goToRoom';
import {harvestTargetType, TaskHarvest} from './task_harvest';
import {healTargetType, TaskHeal} from './task_heal';
import {meleeAttackTargetType, TaskMeleeAttack} from './task_meleeAttack';
import {pickupTargetType, TaskPickup} from './task_pickup';
import {rangedAttackTargetType, TaskRangedAttack} from './task_rangedAttack';
import {repairTargetType, TaskRepair} from './task_repair';
import {reserveTargetType, TaskReserve} from './task_reserve';
import {signControllerTargetType, TaskSignController} from './task_signController';
import {TaskTransfer, transferTargetType} from './task_transfer';
import {TaskUpgrade, upgradeTargetType} from './task_upgrade';
import {TaskWithdraw, withdrawTargetType} from './task_withdraw';
import {TaskWithdrawResource, withdrawResourceTargetType} from './task_withdrawResource';

export class Tasks {

	static attack(target: attackTargetType): TaskAttack {
		return new TaskAttack(target);
	}

	static build(target: buildTargetType): TaskBuild {
		return new TaskBuild(target);
	}

	static claim(target: claimTargetType): TaskClaim {
		return new TaskClaim(target);
	}

	static deposit(target: depositTargetType): TaskDeposit {
		return new TaskDeposit(target);
	}

	static dismantle(target: dismantleTargetType): TaskDismantle {
		return new TaskDismantle(target);
	}

	static fortify(target: fortifyTargetType): TaskFortify {
		return new TaskFortify(target);
	}

	static getBoosted(target: getBoostedTargetType): TaskGetBoosted {
		return new TaskGetBoosted(target);
	}

	static getRenewed(target: getRenewedTargetType): TaskGetRenewed {
		return new TaskGetRenewed(target);
	}

	static goTo(target: goToTargetType): TaskGoTo {
		return new TaskGoTo(target);
	}

	static goToRoom(target: goToRoomTargetType): TaskGoToRoom {
		return new TaskGoToRoom(target);
	}

	static harvest(target: harvestTargetType): TaskHarvest {
		return new TaskHarvest(target);
	}

	static heal(target: healTargetType): TaskHeal {
		return new TaskHeal(target);
	}

	static meleeAttack(target: meleeAttackTargetType): TaskMeleeAttack {
		return new TaskMeleeAttack(target);
	}

	static pickup(target: pickupTargetType): TaskPickup {
		return new TaskPickup(target);
	}

	static rangedAttack(target: rangedAttackTargetType): TaskRangedAttack {
		return new TaskRangedAttack(target);
	}

	static repair(target: repairTargetType): TaskRepair {
		return new TaskRepair(target);
	}

	static reserve(target: reserveTargetType): TaskReserve {
		return new TaskReserve(target);
	}

	static signController(target: signControllerTargetType): TaskSignController {
		return new TaskSignController(target);
	}

	static transfer(target: transferTargetType): TaskTransfer {
		return new TaskTransfer(target);
	}

	static upgrade(target: upgradeTargetType): TaskUpgrade {
		return new TaskUpgrade(target);
	}

	static withdraw(target: withdrawTargetType): TaskWithdraw {
		return new TaskWithdraw(target);
	}

	static withdrawResource(target: withdrawResourceTargetType): TaskWithdrawResource {
		return new TaskWithdrawResource(target);
	}

	// static fromProto(protoTask: protoTask): any {
	// 	// Retrieve name and target data from the protoTask
	// 	let taskName = protoTask.name;
	// 	let target = deref(protoTask._target.ref);
	// 	let task: any;
	// 	// Create a task object of the correct type
	// 	switch (taskName) {
	// 		case attackTaskName:
	// 			task = this.attack(target as attackTargetType);
	// 			break;
	// 		case buildTaskName:
	// 			task = this.build(target as buildTargetType);
	// 			break;
	// 		case claimTaskName:
	// 			task = this.claim(target as claimTargetType);
	// 			break;
	// 		case depositTaskName:
	// 			task = this.deposit(target as depositTargetType);
	// 			break;
	// 		case dismantleTaskName:
	// 			task = this.dismantle(target as dismantleTargetType);
	// 			break;
	// 		case fortifyTaskName:
	// 			task = this.fortify(target as fortifyTargetType);
	// 			break;
	// 		case getBoostedTaskName:
	// 			task = this.getBoosted(target as getBoostedTargetType);
	// 			break;
	// 		case getRenewedTaskName:
	// 			task = this.getRenewed(target as getRenewedTargetType);
	// 			break;
	// 		case goToTaskName:
	// 			task = this.goTo(derefRoomPosition(protoTask._target._pos) as goToTargetType);
	// 			break;
	// 		case goToRoomTaskName:
	// 			task = this.goToRoom(protoTask._target._pos.roomName as goToRoomTargetType);
	// 			break;
	// 		case harvestTaskName:
	// 			task = this.harvest(target as harvestTargetType);
	// 			break;
	// 		case healTaskName:
	// 			task = this.heal(target as healTargetType);
	// 			break;
	// 		case meleeAttackTaskName:
	// 			task = this.meleeAttack(target as meleeAttackTargetType);
	// 			break;
	// 		case pickupTaskName:
	// 			task = this.pickup(target as pickupTargetType);
	// 			break;
	// 		case rangedAttackTaskName:
	// 			task = this.rangedAttack(target as rangedAttackTargetType);
	// 			break;
	// 		case repairTaskName:
	// 			task = this.repair(target as repairTargetType);
	// 			break;
	// 		case reserveTaskName:
	// 			task = this.reserve(target as reserveTargetType);
	// 			break;
	// 		case signControllerTaskName:
	// 			task = this.signController(target as signControllerTargetType);
	// 			break;
	// 		case transferTaskName:
	// 			task = this.transfer(target as transferTargetType);
	// 			break;
	// 		case upgradeTaskName:
	// 			task = this.upgrade(target as upgradeTargetType);
	// 			break;
	// 		case withdrawTaskName:
	// 			task = this.withdraw(target as withdrawTargetType);
	// 			break;
	// 		case withdrawResourceTaskName:
	// 			task = this.withdrawResource(target as withdrawResourceTargetType);
	// 			break;
	// 	}
	// 	// Modify the task object to reflect any changed properties
	// 	task!._creep = protoTask._creep;
	// 	task!._target = protoTask._target;
	// 	task!._parent = protoTask._parent;
	// 	task!.settings = protoTask.settings;
	// 	task!.options = protoTask.options;
	// 	task!.data = protoTask.data;
	// 	// Return it
	// 	return task!;
	// }

}
