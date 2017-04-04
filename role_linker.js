// Linker - transfers energy from link to storage

var tasks = require('tasks');
var Role = require('Role');

class roleLinker extends Role {
    constructor() {
        super('linker');
        // Role-specific settings
        this.settings.bodyPattern = [CARRY, CARRY, MOVE];
        this.settings.consoleQuiet = true;
        this.settings.sayQuiet = true;
        this.roleRequirements = creep => creep.getActiveBodyparts(MOVE) > 1 &&
                                         creep.getActiveBodyparts(CARRY) > 1
    }

    onCreate(creep) {
        creep.memory.data.replaceAt = 100; // replace suppliers early!
        let workRoom = Game.rooms[creep.memory.workRoom];
        let idleFlag = _.filter(workRoom.flags,
                                flag => require('map_flag_codes').rally.idlePoint.filter(flag) &&
                                        (flag.memory.role == this.name || flag.name.includes(this.name)))[0];
        if (idleFlag) {
            creep.memory.data.idleFlag = idleFlag.name;
        }
        return creep;
    }

    collect(creep) {
        var withdraw = tasks('recharge');
        withdraw.data.quiet = true;
        var target;
        if (creep.workRoom.storage.links[0].energy > 0) {
            // try targeting non-empty input links
            target = creep.workRoom.storage.links[0]
        } else if (_.sum(creep.workRoom.storage.store) > creep.workRoom.brain.settings.unloadStorageBuffer) {
            // else try unloading from storage into terminal if there is too much energy
            target = creep.workRoom.storage;
        } else if (creep.workRoom.terminal && creep.workRoom.terminal.store[RESOURCE_ENERGY] >
                                              creep.workRoom.terminal.brain.settings.resourceAmounts[RESOURCE_ENERGY]
                                              + creep.workRoom.terminal.brain.settings.excessTransferAmount) {
            // if there is not too much energy in storage and there is too much in terminal, collect from terminal
            target = creep.workRoom.terminal;
        }
        if (target) {
            return creep.assign(withdraw, target);
        }
    }

    deposit(creep) {
        var deposit = tasks('deposit');
        deposit.data.quiet = true;
        let storage = creep.workRoom.storage;
        var target;
        // deposit to storage
        if (_.sum(storage.store) < creep.workRoom.brain.settings.unloadStorageBuffer) {
            target = storage;
        }
        // overwrite and deposit to terminal if not enough energy in terminal and sufficient energy in storage
        let terminal = creep.workRoom.terminal;
        if (terminal &&
            terminal.store[RESOURCE_ENERGY] < terminal.brain.settings.resourceAmounts[RESOURCE_ENERGY] &&
            storage.store[RESOURCE_ENERGY] > creep.workRoom.brain.settings.storageBuffer[this.name]) {
            target = terminal;
        }
        if (target) {
            return creep.assign(deposit, target);
        }
    }

    newTask(creep) {
        creep.task = null;
        let idleFlag = Game.flags[creep.memory.data.idleFlag];
        if (idleFlag && !creep.pos.inRangeTo(idleFlag, 1)) {
            return creep.assign(tasks('goTo'), idleFlag);
        }
        if (creep.carry.energy == 0) {
            return this.collect(creep);
        } else {
            return this.deposit(creep);
        }
    }
}

module.exports = roleLinker;