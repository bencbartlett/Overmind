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

    create(spawn, {assignment, workRoom, patternRepetitionLimit = Infinity}) {
        let creep = this.generateLargestCreep(spawn, {
            assignment: assignment,
            workRoom: workRoom,
            patternRepetitionLimit: patternRepetitionLimit
        });
        creep.memory.data.replaceAt = 150; // replace linkers early!
        return creep; // spawn.createCreep(creep.body, creep.name, creep.memory);
    }

    collect(creep) {
        var withdraw = tasks('recharge');
        withdraw.data.quiet = true;
        var target;
        if (creep.workRoom.storage.links[0].energy > 0) {
            target = creep.workRoom.storage.links[0]
        } else if (_.sum(creep.workRoom.storage.store) > creep.workRoom.brain.unloadStorageBuffer) {
            target = creep.workRoom.storage;
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
        if (_.sum(storage.store) < creep.workRoom.brain.unloadStorageBuffer) {
            target = storage;
        }
        // Deposit to terminal if you need to and are permitted to
        let terminal = creep.workRoom.terminal;
        if (terminal) {
            if (!target ||
                ((terminal.store[RESOURCE_ENERGY] < terminal.brain.settings.resourceAmounts[RESOURCE_ENERGY]) &&
                 (storage.store[RESOURCE_ENERGY] > creep.workRoom.brain.settings.storageBuffer[this.name]))) {
                target = terminal;
            }
        }
        return creep.assign(deposit, target);
    }

    newTask(creep) {
        creep.task = null;
        if (creep.carry.energy == 0) {
            this.collect(creep);
        } else {
            this.deposit(creep);
        }
    }
}

module.exports = roleLinker;