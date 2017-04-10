// Wrapper for task require statements.
// Example:
// var tasks = require('tasks');
// var task = tasks('repair');

import {Task} from '../tasks/Task';
import {taskAttack} from "../tasks/task_attack";
import {taskBuild} from "../tasks/task_build";
import {taskClaim} from "../tasks/task_claim";
import {taskDeposit} from "../tasks/task_deposit";
import {taskDismantle} from "../tasks/task_dismantle";
import {taskFortify} from "../tasks/task_fortify";
import {taskGetBoosted} from "../tasks/task_getBoosted";
import {taskGetRenewed} from "../tasks/task_getRenewed";
import {taskGoTo} from "../tasks/task_goTo";
import {taskGoToRoom} from "../tasks/task_goToRoom";
import {taskHarvest} from "../tasks/task_harvest";
import {taskHeal} from "../tasks/task_heal";
import {taskLoadLab} from "../tasks/task_loadLab";
import {taskMeleeAttack} from "../tasks/task_meleeAttack";
import {taskPickup} from "../tasks/task_pickup";
import {taskRangedAttack} from "../tasks/task_rangedAttack";
import {taskRecharge} from "../tasks/task_recharge";
import {taskRepair} from "../tasks/task_repair";
import {taskReserve} from "../tasks/task_reserve";
import {taskSignController} from "../tasks/task_signController";
import {taskSupply} from "../tasks/task_supply";
import {taskTransfer} from "../tasks/task_transfer";
import {taskUpgrade} from "../tasks/task_upgrade";
import {taskWithdraw} from "../tasks/task_withdraw";

export function tasks(taskName: string): Task {
    // var TaskClass = require('task_' + taskName);
    // var taskInstance = new TaskClass;
    // return taskInstance;
    switch (taskName) {
        case 'attack':
            return new taskAttack;
        case 'build':
            return new taskBuild;
        case 'claim':
            return new taskClaim;
        case 'deposit':
            return new taskDeposit;
        case 'dismantle':
            return new taskDismantle;
        case 'fortify':
            return new taskFortify;
        case 'getBoosted':
            return new taskGetBoosted;
        case 'getRenewed':
            return new taskGetRenewed;
        case 'goTo':
            return new taskGoTo;
        case 'goToRoom':
            return new taskGoToRoom;
        case 'harvest':
            return new taskHarvest;
        case 'heal':
            return new taskHeal;
        case 'loadLab':
            return new taskLoadLab;
        case 'meleeAttack':
            return new taskMeleeAttack;
        case 'pickup':
            return new taskPickup;
        case 'rangedAttack':
            return new taskRangedAttack;
        case 'recharge':
            return new taskRecharge;
        case 'repair':
            return new taskRepair;
        case 'reserve':
            return new taskReserve;
        case 'signController':
            return new taskSignController;
        case 'supply':
            return new taskSupply;
        case 'transfer':
            return new taskTransfer;
        case 'upgrade':
            return new taskUpgrade;
        case 'withdraw':
            return new taskWithdraw;
    }
}
