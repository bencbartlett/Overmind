// Reinstantiation of a task object from protoTask data

import {Task} from '../tasks/Task';
import {attackTargetType, attackTaskName, TaskAttack} from '../tasks/task_attack';
import {buildTargetType, buildTaskName, TaskBuild} from '../tasks/task_build';
import {claimTargetType, claimTaskName, TaskClaim} from '../tasks/task_claim';
import {depositTargetType, depositTaskName, TaskDeposit} from '../tasks/task_deposit';
import {dismantleTargetType, dismantleTaskName, TaskDismantle} from '../tasks/task_dismantle';
import {fortifyTargetType, fortifyTaskName, TaskFortify} from '../tasks/task_fortify';
import {getBoostedTargetType, getBoostedTaskName, TaskGetBoosted} from '../tasks/task_getBoosted';
import {getRenewedTargetType, getRenewedTaskName, TaskGetRenewed} from '../tasks/task_getRenewed';
import {goToTargetType, goToTaskName, TaskGoTo} from '../tasks/task_goTo';
import {goToRoomTargetType, goToRoomTaskName, TaskGoToRoom} from '../tasks/task_goToRoom';
import {harvestTargetType, harvestTaskName, TaskHarvest} from '../tasks/task_harvest';
import {healTargetType, healTaskName, TaskHeal} from '../tasks/task_heal';
// import {loadLabTargetType, loadLabTaskName, TaskLoadLab} from '../tasks/task_loadLab';
import {meleeAttackTargetType, meleeAttackTaskName, TaskMeleeAttack} from '../tasks/task_meleeAttack';
import {pickupTargetType, pickupTaskName, TaskPickup} from '../tasks/task_pickup';
import {rangedAttackTargetType, rangedAttackTaskName, TaskRangedAttack} from '../tasks/task_rangedAttack';
import {TaskWithdraw, withdrawTargetType, withdrawTaskName} from '../tasks/task_withdraw';
import {repairTargetType, repairTaskName, TaskRepair} from '../tasks/task_repair';
import {reserveTargetType, reserveTaskName, TaskReserve} from '../tasks/task_reserve';
import {signControllerTargetType, signControllerTaskName, TaskSignController} from '../tasks/task_signController';
import {TaskTransfer, transferTargetType, transferTaskName} from '../tasks/task_transfer';
import {TaskUpgrade, upgradeTargetType, upgradeTaskName} from '../tasks/task_upgrade';
import {
	TaskWithdrawResource, withdrawResourceTargetType,
	withdrawResourceTaskName
} from '../tasks/task_withdrawResource';

export function taskInstantiator(protoTask: protoTask): Task {
	// Retrieve name and target data from the protoTask
	let taskName = protoTask.name;
	let target = deref(protoTask._target.ref);
	let task: any;
	// Create a task object of the correct type
	switch (taskName) {
		case attackTaskName:
			task = new TaskAttack(target as attackTargetType);
			break;
		case buildTaskName:
			task = new TaskBuild(target as buildTargetType);
			break;
		case claimTaskName:
			task = new TaskClaim(target as claimTargetType);
			break;
		case depositTaskName:
			task = new TaskDeposit(target as depositTargetType);
			break;
		case dismantleTaskName:
			task = new TaskDismantle(target as dismantleTargetType);
			break;
		case fortifyTaskName:
			task = new TaskFortify(target as fortifyTargetType);
			break;
		case getBoostedTaskName:
			task = new TaskGetBoosted(target as getBoostedTargetType);
			break;
		case getRenewedTaskName:
			task = new TaskGetRenewed(target as getRenewedTargetType);
			break;
		case goToTaskName:
			task = new TaskGoTo(derefRoomPosition(protoTask._target._pos) as goToTargetType);
			break;
		case goToRoomTaskName:
			task = new TaskGoToRoom(protoTask._target._pos.roomName as goToRoomTargetType);
			break;
		case harvestTaskName:
			task = new TaskHarvest(target as harvestTargetType);
			break;
		case healTaskName:
			task = new TaskHeal(target as healTargetType);
			break;
		// case loadLabTaskName:
		// 	task = new TaskLoadLab(target as loadLabTargetType);
		// 	break;
		case meleeAttackTaskName:
			task = new TaskMeleeAttack(target as meleeAttackTargetType);
			break;
		case pickupTaskName:
			task = new TaskPickup(target as pickupTargetType);
			break;
		case rangedAttackTaskName:
			task = new TaskRangedAttack(target as rangedAttackTargetType);
			break;
		case withdrawTaskName:
			task = new TaskWithdraw(target as withdrawTargetType);
			break;
		case repairTaskName:
			task = new TaskRepair(target as repairTargetType);
			break;
		case reserveTaskName:
			task = new TaskReserve(target as reserveTargetType);
			break;
		case signControllerTaskName:
			task = new TaskSignController(target as signControllerTargetType);
			break;
		case transferTaskName:
			task = new TaskTransfer(target as transferTargetType);
			break;
		case upgradeTaskName:
			task = new TaskUpgrade(target as upgradeTargetType);
			break;
		case withdrawResourceTaskName:
			task = new TaskWithdrawResource(target as withdrawResourceTargetType);
			break;
	}
	// Modify the task object to reflect any changed properties
	task!._creep = protoTask._creep;
	task!._target = protoTask._target;
	task!._parent = protoTask._parent;
	task!.settings = protoTask.settings;
	task!.options = protoTask.options;
	task!.data = protoTask.data;
	// Return it
	return task!;
}

