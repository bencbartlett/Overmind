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

export function tasks(taskName: string, target: RoomObject): Task {
    // var TaskClass = require('task_' + taskName);
    // var taskInstance = new TaskClass;
    // return taskInstance;
    switch (taskName) {
        case 'attack':
            return new taskAttack(target as Creep | Structure);
        case 'build':
            return new taskBuild(target as ConstructionSite);
        case 'claim':
            return new taskClaim(target as Controller);
        case 'deposit':
            return new taskDeposit(target as StructureContainer | StructureStorage | StructureTerminal | StructureLink);
        case 'dismantle':
            return new taskDismantle(target as Structure);
        case 'fortify':
            return new taskFortify(target as StructureWall | Rampart);
        case 'getBoosted':
            return new taskGetBoosted(target as Lab);
        case 'getRenewed':
            return new taskGetRenewed(target as Spawn);
        case 'goTo':
            return new taskGoTo(target as RoomObject);
        case 'goToRoom':
            return new taskGoToRoom(target as RoomObject);
        case 'harvest':
            return new taskHarvest(target as Source);
        case 'heal':
            return new taskHeal(target as Creep);
        case 'loadLab':
            return new taskLoadLab(target as Lab);
        case 'meleeAttack':
            return new taskMeleeAttack(target as Creep | Structure);
        case 'pickup':
            return new taskPickup(target as Resource);
        case 'rangedAttack':
            return new taskRangedAttack(target as Creep | Structure);
        case 'recharge':
            return new taskRecharge(target as StructureStorage | Container | Terminal);
        case 'repair':
            return new taskRepair(target as Structure);
        case 'reserve':
            return new taskReserve(target as Controller);
        case 'signController':
            return new taskSignController(target as Controller);
        case 'supply':
            return new taskSupply(target as Sink);
        case 'transfer':
            return new taskTransfer(target as StructureContainer | StructureStorage | StructureTerminal |
                StructureLab | StructureNuker | StructurePowerSpawn);
        case 'upgrade':
            return new taskUpgrade(target as Controller);
        case 'withdraw':
            return new taskWithdraw(target as StructureStorage | StructureContainer | StructureTerminal);
    }
}

