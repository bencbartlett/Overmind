// Linker - transfers energy from link to storage

var tasks = require('tasks');

var roleLinker = {
    /** @param {Creep} creep **/
    /** @param {StructureSpawn} spawn **/

    settings: {
        bodyPattern: [CARRY, CARRY, CARRY, CARRY, MOVE]
    },

    create: function (spawn, assignment, {workRoom = spawn.room.name}) {
        return spawn.createCreep(this.settings.bodyPattern, spawn.creepName('linker'), {
            role: 'linker', workRoom: workRoom, task: null, assignment: assignment,
            data: {origin: spawn.room.name, replaceAt: 0}
        });
    },

    collect: function (creep) {
        var withdraw = tasks('recharge');
        withdraw.data.quiet = true;
        var target = creep.workRoom.storage.links[0];
        if (target.energy == 0) {
            return OK;
        } else {
            return creep.assign(withdraw, target);
        }
    },

    deposit: function (creep) {
        var deposit = tasks('deposit');
        deposit.data.quiet = true;
        var target = creep.workRoom.storage;
        return creep.assign(deposit, target);
    },

    newTask: function (creep) {
        creep.task = null;
        if (creep.carry.energy == 0) {
            this.collect(creep);
        } else {
            if (creep.memory.data.replaceAt == 0) { // record first transfer instance
                creep.memory.data.replaceAt = (creep.lifetime - creep.ticksToLive);
            }
            this.deposit(creep);
        }
    },

    executeTask: function (creep) {
        // execute the task
        creep.task.step();
    },

    run: function (creep) {
        // get new task if this one is invalid
        if ((!creep.task || !creep.task.isValidTask() || !creep.task.isValidTarget())) {
            this.newTask(creep);
        }
        if (creep.task) {
            this.executeTask(creep);
        }
    }
};

module.exports = roleLinker;