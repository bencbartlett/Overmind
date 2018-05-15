import {attackTargetType, TaskAttack} from './task_attack';
import {buildTargetType, TaskBuild} from './task_build';
import {claimTargetType, TaskClaim} from './task_claim';
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
import {dropTargetType, TaskDrop} from './task_drop';
import {profile} from '../profiler/decorator';

@profile
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

	static dismantle(target: dismantleTargetType): TaskDismantle {
		return new TaskDismantle(target);
	}

	static drop(target: dropTargetType): TaskDrop {
		return new TaskDrop(target);
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

	static transfer(target: transferTargetType,
					resourceType: ResourceConstant = RESOURCE_ENERGY,
					amount: number | undefined     = undefined,
					options                        = {} as TaskOptions): TaskTransfer {
		return new TaskTransfer(target, resourceType, amount, options);
	}

	static upgrade(target: upgradeTargetType): TaskUpgrade {
		return new TaskUpgrade(target);
	}

	static withdraw(target: withdrawTargetType,
					resourceType: ResourceConstant = RESOURCE_ENERGY,
					amount: number | undefined     = undefined,
					options                        = {} as TaskOptions): TaskWithdraw {
		return new TaskWithdraw(target, resourceType, amount, options);
	}

}
