// Reinstantiation of a task object from protoTask data

import {Task} from '../tasks/Task';
import {taskAttack} from '../tasks/task_attack';
import {taskBuild} from '../tasks/task_build';
import {taskClaim} from '../tasks/task_claim';
import {taskDeposit} from '../tasks/task_deposit';
import {taskDismantle} from '../tasks/task_dismantle';
import {taskFortify} from '../tasks/task_fortify';
import {taskGetBoosted} from '../tasks/task_getBoosted';
import {taskGetRenewed} from '../tasks/task_getRenewed';
import {taskGoTo} from '../tasks/task_goTo';
import {taskGoToRoom} from '../tasks/task_goToRoom';
import {taskHarvest} from '../tasks/task_harvest';
import {taskHeal} from '../tasks/task_heal';
import {taskLoadLab} from '../tasks/task_loadLab';
import {taskMeleeAttack} from '../tasks/task_meleeAttack';
import {taskPickup} from '../tasks/task_pickup';
import {taskRangedAttack} from '../tasks/task_rangedAttack';
import {taskWithdraw} from '../tasks/task_withdraw';
import {taskRepair} from '../tasks/task_repair';
import {taskReserve} from '../tasks/task_reserve';
import {taskSignController} from '../tasks/task_signController';
import {taskSupply} from '../tasks/task_supply';
import {taskTransfer} from '../tasks/task_transfer';
import {taskUpgrade} from '../tasks/task_upgrade';
import {taskWithdrawResource} from '../tasks/task_withdrawResource';

export function taskFromPrototask(protoTask: protoTask): Task {
	// Retrieve name and target data from the protoTask
	let taskName = protoTask.name;
	let target = deref(protoTask._target.ref);
	let task: ITask;
	// Create a task object of the correct type
	switch (taskName) {
		case 'attack':
			task = new taskAttack(target as Creep | Structure);
			break;
		case 'build':
			task = new taskBuild(target as ConstructionSite);
			break;
		case 'claim':
			task = new taskClaim(target as Controller);
			break;
		case 'deposit':
			task = new taskDeposit(target as StructureContainer | StructureStorage | StructureTerminal | StructureLink);
			break;
		case 'dismantle':
			task = new taskDismantle(target as Structure);
			break;
		case 'fortify':
			task = new taskFortify(target as StructureWall | Rampart);
			break;
		case 'getBoosted':
			task = new taskGetBoosted(target as Lab);
			break;
		case 'getRenewed':
			task = new taskGetRenewed(target as Spawn);
			break;
		case 'goTo':
			task = new taskGoTo(target as RoomObject);
			break;
		case 'goToRoom':
			task = new taskGoToRoom(target as RoomObject);
			break;
		case 'harvest':
			task = new taskHarvest(target as Source);
			break;
		case 'heal':
			task = new taskHeal(target as Creep);
			break;
		case 'loadLab':
			task = new taskLoadLab(target as Lab);
			break;
		case 'meleeAttack':
			task = new taskMeleeAttack(target as Creep | Structure);
			break;
		case 'pickup':
			task = new taskPickup(target as Resource);
			break;
		case 'rangedAttack':
			task = new taskRangedAttack(target as Creep | Structure);
			break;
		case 'recharge':
			task = new taskWithdraw(target as StructureStorage | Container | Terminal);
			break;
		case 'repair':
			task = new taskRepair(target as Structure);
			break;
		case 'colony':
			task = new taskReserve(target as Controller);
			break;
		case 'signController':
			task = new taskSignController(target as Controller);
			break;
		case 'supply':
			task = new taskSupply(target as Sink);
			break;
		case 'transfer':
			task = new taskTransfer(target as StructureContainer | StructureStorage | StructureTerminal |
				StructureLab | StructureNuker | StructurePowerSpawn);
			break;
		case 'upgrade':
			task = new taskUpgrade(target as Controller);
			break;
		case 'withdrawResource':
			task = new taskWithdrawResource(target as StructureStorage | StructureContainer | StructureTerminal);
			break;
	}
	// Modify the task object to reflect any changed properties
	task._creep = protoTask._creep;
	task._target = protoTask._target;
	task.taskData = protoTask.taskData;
	task.data = protoTask.data;
	// Return it
	return task;
}

