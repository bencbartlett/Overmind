// Supplier: local energy transport bot. Picks up dropped energy, energy in containers, deposits to sinks and storage

import {taskRecharge} from "../tasks/task_recharge";
import {AbstractCreep, AbstractSetup} from "./Abstract";


export class SupplierSetup extends AbstractSetup {
    constructor() {
        super('supplier');
        // Role-specific settings
        this.settings.bodyPattern = [CARRY, CARRY, MOVE];
        // this.settings.consoleQuiet = true; // suppliers should shut the fuck up
        this.settings.notifyOnNoRechargeTargets = true;
        this.settings.notifyOnNoTask = false;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(MOVE) > 1 &&
                                                  creep.getActiveBodyparts(CARRY) > 1
    }
    
    onCreate(creep: protoCreep) {
        let colonyRoom = Game.rooms[creep.memory.colony];
        let idleFlag = _.filter(colonyRoom.flags,
                                flag => flagCodes.rally.idlePoint.filter(flag) &&
                                        (flag.memory.role == this.name || flag.name.includes(this.name)))[0];
        if (idleFlag) {
            creep.memory.data.idleFlag = idleFlag.name;
        }
        return creep;
    }
}

export class SupplierCreep extends AbstractCreep {
    
    constructor(creep: Creep) {
        super(creep);
    }

    run() {
        // Execute on-run code
        this.onRun();
        // Check each tick that the task is still valid
        this.assertValidTask();
        // If there is a task, execute it
        if (this.task) {
            return this.executeTask();
        } else {
            if (this.carry.energy < this.carryCapacity) {
                return this.recharge(); // recharge once there's nothing to do
            } else { // sit and wait at flag
                let idleFlag = Game.flags[this.memory.data.idleFlag];
                if (idleFlag && !this.pos.inRangeTo(idleFlag, 1)) {
                    this.travelTo(idleFlag);
                }
            }
        }
    }
}
