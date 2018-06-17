import { attackTargetType, TaskAttack } from './instances/attack';
import { attackControllerTargetType, TaskAttackController } from './instances/attackController';
import {buildTargetType, TaskBuild} from './instances/build';
import {claimTargetType, TaskClaim} from './instances/claim';
import {dismantleTargetType, TaskDismantle} from './instances/dismantle';
import {fleeTargetType, TaskFlee} from './instances/flee';
import {fortifyTargetType, TaskFortify} from './instances/fortify';
import {getBoostedTargetType, TaskGetBoosted} from './instances/getBoosted';
import {getRenewedTargetType, TaskGetRenewed} from './instances/getRenewed';
import {goToRoomTargetType, TaskGoToRoom} from './instances/goToRoom';
import {harvestTargetType, TaskHarvest} from './instances/harvest';
import {healTargetType, TaskHeal} from './instances/heal';
import {meleeAttackTargetType, TaskMeleeAttack} from './instances/meleeAttack';
import {pickupTargetType, TaskPickup} from './instances/pickup';
import {rangedAttackTargetType, TaskRangedAttack} from './instances/rangedAttack';
import {repairTargetType, TaskRepair} from './instances/repair';
import {reserveTargetType, TaskReserve} from './instances/reserve';
import {signControllerTargetType, TaskSignController} from './instances/signController';
import {TaskTransfer, transferTargetType} from './instances/transfer';
import {TaskTransferAll, transferAllTargetType} from './instances/transferAll';
import {TaskUpgrade, upgradeTargetType} from './instances/upgrade';
import {TaskWithdraw, withdrawTargetType} from './instances/withdraw';
import {dropTargetType, TaskDrop} from './instances/drop';
import {profile} from '../profiler/decorator';

@profile
export class Tasks {

	static attack(target: attackTargetType, options = {} as TaskOptions): TaskAttack {
		return new TaskAttack(target, options);
	}

	static attackController(target: attackControllerTargetType, options = {} as TaskOptions): TaskAttackController {
		return new TaskAttackController(target, options);
	}

	static build(target: buildTargetType, options = {} as TaskOptions): TaskBuild {
		return new TaskBuild(target, options);
	}

	static claim(target: claimTargetType, options = {} as TaskOptions): TaskClaim {
		return new TaskClaim(target, options);
	}

	static dismantle(target: dismantleTargetType, options = {} as TaskOptions): TaskDismantle {
		return new TaskDismantle(target, options);
	}

	static drop(target: dropTargetType,
				resourceType: ResourceConstant = RESOURCE_ENERGY,
				amount: number | undefined     = undefined,
				options                        = {} as TaskOptions): TaskDrop {
		return new TaskDrop(target, resourceType, amount, options);
	}

	static flee(target: fleeTargetType, options = {} as TaskOptions) {
		return new TaskFlee(target, options);
	}

	static fortify(target: fortifyTargetType, options = {} as TaskOptions): TaskFortify {
		return new TaskFortify(target, options);
	}

	static getBoosted(target: getBoostedTargetType,
					  boostType: _ResourceConstantSansEnergy,
					  amount: number | undefined = undefined,
					  options                    = {} as TaskOptions): TaskGetBoosted {
		return new TaskGetBoosted(target, boostType, amount, options);
	}

	static getRenewed(target: getRenewedTargetType, options = {} as TaskOptions): TaskGetRenewed {
		return new TaskGetRenewed(target, options);
	}

	// static goTo(target: goToTargetType, options = {} as TaskOptions): TaskGoTo {
	// 	return new TaskGoTo(target, options);
	// }

	static goToRoom(target: goToRoomTargetType, options = {} as TaskOptions): TaskGoToRoom {
		return new TaskGoToRoom(target, options);
	}

	static harvest(target: harvestTargetType, options = {} as TaskOptions): TaskHarvest {
		return new TaskHarvest(target, options);
	}

	static heal(target: healTargetType, options = {} as TaskOptions): TaskHeal {
		return new TaskHeal(target, options);
	}

	static meleeAttack(target: meleeAttackTargetType, options = {} as TaskOptions): TaskMeleeAttack {
		return new TaskMeleeAttack(target, options);
	}

	static pickup(target: pickupTargetType, options = {} as TaskOptions): TaskPickup {
		return new TaskPickup(target, options);
	}

	static rangedAttack(target: rangedAttackTargetType, options = {} as TaskOptions): TaskRangedAttack {
		return new TaskRangedAttack(target, options);
	}

	static repair(target: repairTargetType, options = {} as TaskOptions): TaskRepair {
		return new TaskRepair(target, options);
	}

	static reserve(target: reserveTargetType, options = {} as TaskOptions): TaskReserve {
		return new TaskReserve(target, options);
	}

	static signController(target: signControllerTargetType,
						  options = {} as TaskOptions): TaskSignController {
		return new TaskSignController(target, options);
	}

	static transfer(target: transferTargetType,
					resourceType: ResourceConstant = RESOURCE_ENERGY,
					amount: number | undefined     = undefined,
					options                        = {} as TaskOptions): TaskTransfer {
		return new TaskTransfer(target, resourceType, amount, options);
	}

	static transferAll(target: transferAllTargetType, options = {} as TaskOptions): TaskTransferAll {
		return new TaskTransferAll(target, options);
	}

	static upgrade(target: upgradeTargetType, options = {} as TaskOptions): TaskUpgrade {
		return new TaskUpgrade(target, options);
	}

	static withdraw(target: withdrawTargetType,
					resourceType: ResourceConstant = RESOURCE_ENERGY,
					amount: number | undefined     = undefined,
					options                        = {} as TaskOptions): TaskWithdraw {
		return new TaskWithdraw(target, resourceType, amount, options);
	}

}
