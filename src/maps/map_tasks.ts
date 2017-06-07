// Reinstantiation of a task object from protoTask data

import {Task} from '../tasks/Task';
import {TaskAttack} from '../tasks/task_attack';
import {TaskBuild} from '../tasks/task_build';
import {TaskClaim} from '../tasks/task_claim';
import {TaskDeposit} from '../tasks/task_deposit';
import {TaskDismantle} from '../tasks/task_dismantle';
import {TaskFortify} from '../tasks/task_fortify';
import {TaskGetBoosted} from '../tasks/task_getBoosted';
import {TaskGetRenewed} from '../tasks/task_getRenewed';
import {TaskGoTo} from '../tasks/task_goTo';
import {TaskGoToRoom} from '../tasks/task_goToRoom';
import {TaskHarvest} from '../tasks/task_harvest';
import {TaskHeal} from '../tasks/task_heal';
import {TaskLoadLab} from '../tasks/task_loadLab';
import {TaskMeleeAttack} from '../tasks/task_meleeAttack';
import {TaskPickup} from '../tasks/task_pickup';
import {TaskRangedAttack} from '../tasks/task_rangedAttack';
import {TaskWithdraw} from '../tasks/task_withdraw';
import {TaskRepair} from '../tasks/task_repair';
import {TaskReserve} from '../tasks/task_reserve';
import {TaskSignController} from '../tasks/task_signController';
import {TaskSupply} from '../tasks/task_supply';
import {TaskTransfer} from '../tasks/task_transfer';
import {TaskUpgrade} from '../tasks/task_upgrade';
import {TaskWithdrawResource} from '../tasks/task_withdrawResource';

export function taskFromPrototask(protoTask: protoTask): Task {
	// Retrieve name and target data from the protoTask
	let taskName = protoTask.name;
	let target = deref(protoTask._target.ref);
	let task;
	// Create a task object of the correct type
	switch (taskName) {
		case 'attack':
			task = new TaskAttack(target as Creep | Structure);
			break;
		case 'build':
			task = new TaskBuild(target as ConstructionSite);
			break;
		case 'claim':
			task = new TaskClaim(target as Controller);
			break;
		case 'deposit':
			task = new TaskDeposit(target as StructureContainer | StructureStorage | StructureTerminal | StructureLink);
			break;
		case 'dismantle':
			task = new TaskDismantle(target as Structure);
			break;
		case 'fortify':
			task = new TaskFortify(target as StructureWall | Rampart);
			break;
		case 'getBoosted':
			task = new TaskGetBoosted(target as Lab);
			break;
		case 'getRenewed':
			task = new TaskGetRenewed(target as Spawn);
			break;
		case 'goTo':
			task = new TaskGoTo(target as RoomObject);
			break;
		case 'goToRoom':
			task = new TaskGoToRoom(target as RoomObject);
			break;
		case 'harvest':
			task = new TaskHarvest(target as Source);
			break;
		case 'heal':
			task = new TaskHeal(target as Creep);
			break;
		case 'loadLab':
			task = new TaskLoadLab(target as Lab);
			break;
		case 'meleeAttack':
			task = new TaskMeleeAttack(target as Creep | Structure);
			break;
		case 'pickup':
			task = new TaskPickup(target as Resource);
			break;
		case 'rangedAttack':
			task = new TaskRangedAttack(target as Creep | Structure);
			break;
		case 'recharge':
			task = new TaskWithdraw(target as StructureStorage | Container | Terminal);
			break;
		case 'repair':
			task = new TaskRepair(target as Structure);
			break;
		case 'colony':
			task = new TaskReserve(target as Controller);
			break;
		case 'signController':
			task = new TaskSignController(target as Controller);
			break;
		case 'supply':
			task = new TaskSupply(target as Sink);
			break;
		case 'transfer':
			task = new TaskTransfer(target as StructureContainer | StructureStorage | StructureTerminal |
				StructureLab | StructureNuker | StructurePowerSpawn);
			break;
		case 'upgrade':
			task = new TaskUpgrade(target as Controller);
			break;
		case 'withdrawResource':
			task = new TaskWithdrawResource(target as StructureStorage | StructureContainer | StructureTerminal);
			break;
	}
	// Modify the task object to reflect any changed properties
	task!._creep = protoTask._creep;
	task!._target = protoTask._target;
	task!.taskData = protoTask.taskData;
	task!.data = protoTask.data;
	// Return it
	return task!;
}

