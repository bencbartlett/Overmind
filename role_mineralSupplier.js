// Linker - transfers energy from link to storage

var tasks = require('tasks');
var Role = require('Role');

class roleMineralSupplier extends Role {
    constructor() {
        super('mineralSupplier');
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
        return creep; // spawn.createCreep(creep.body, creep.name, creep.memory);
    }

    collect(creep) {
        var withdraw = tasks('withdraw');
        withdraw.data.resourceType = RESOURCE_CATALYZED_GHODIUM_ACID; // TODO: hardcoded
        var target = creep.workRoom.terminal;
        if (target.energy == 0) {
            return OK;
        } else {
            return creep.assign(withdraw, target);
        }
    }

    deposit(creep) {
        let loadLabs = _.filter(creep.room.labs, lab => lab.assignedMineralType == RESOURCE_CATALYZED_GHODIUM_ACID &&
                                                        lab.IO == 'in' &&
                                                        lab.mineralAmount < lab.mineralCapacity - creep.carryCapacity);
        let target = loadLabs[0];
        var transfer = tasks('transfer');
        transfer.data.resourceType = target.assignedMineralType;
        return creep.assign(transfer, target);
    }

    newTask(creep) {
        creep.task = null;
        let loadLabs = _.filter(creep.room.labs, lab => lab.assignedMineralType == RESOURCE_CATALYZED_GHODIUM_ACID &&
                                                        lab.IO == 'in' &&
                                                        lab.mineralAmount < lab.mineralCapacity - creep.carryCapacity);
        if (loadLabs.length > 0) {
            if (_.sum(creep.carry) == 0) {
                this.collect(creep);
            } else {
                if (creep.memory.data.replaceAt == 0) { // record first transfer instance
                    creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive) + 50;
                }
                this.deposit(creep);
            }
        }
    }

    onRun(creep) {
        if (creep.ticksToLive < 100 && _.sum(creep.carry) == 0) {
            creep.suicide();
        }
    }
}

module.exports = roleMineralSupplier;