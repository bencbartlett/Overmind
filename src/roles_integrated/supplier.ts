// Supplier: local energy transport bot. Picks up dropped energy, energy in containers, deposits to sinks and storage

import {taskRecharge} from "../tasks/task_recharge";
import {AbstractCreep, AbstractSetup} from "./Abstract";


export class supplierSetup extends AbstractSetup {
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

    recharge() { // default recharging logic for thiss
        // try to find closest container or storage
        var bufferSettings = this.colony.overlord.settings.storageBuffer; // not this.workRoom; use rules of room you're in
        var buffer = bufferSettings.default;
        if (bufferSettings[this.name]) {
            buffer = bufferSettings[this.name];
        }
        var target: Container | Storage | Terminal;
        target = this.pos.findClosestByRange(this.room.storageUnits, {
            filter: (s: Storage | Container) =>
            (s.structureType == STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > this.carryCapacity) ||
            (s.structureType == STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > buffer),
        }) as Storage | Container;
        if (!target && this.room.terminal) {
            target = this.room.terminal; // energy should be sent to room if it is out
        }
        if (target) { // assign recharge task to this
            return this.assign(new taskRecharge(target));
        } else {
            return "";
        }
    }

    run() {
        // get new task if this one is invalid
        if ((!this.task || !this.task.isValidTask() || !this.task.isValidTarget())) {
            this.newTask();
        }
        if (this.task) {
            // execute task
            this.executeTask();
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
