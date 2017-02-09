require('constants');

var roles = {
    harvester: require('role_harvester'),
    miner: require('role_miner'),
    supplier: require('role_supplier'),
    builder: require('role_builder'),
    upgrader: require('role_upgrader'),
    repairer: require('role_repairer'),
    meleeAttacker: require('role_meleeAttacker'),
    healer: require('role_healer')
};

Creep.prototype.role = function () {
    return this.memory.role;
};

Creep.prototype.run = function () {
    // TODO: creep need renewal?
    this.doRole();
};

Creep.prototype.doRole = function () {
    roles[this.role()].run(this);
};

Creep.prototype.targetNearestAvailableSource = function () {
    // Set target to the nearest source that isn't already saturated with creeps
    // TODO: find least saturated source
    var sources = this.room.find(FIND_SOURCES_ACTIVE);
    if (sources.length > 0) {
        var target = sources[0];
        for (let i in sources) { // find sources that aren't saturated with harvesters
            if (sources[i].openSpots() > 0) {
                target = sources[i];
                break;
            }
        }
        this.memory.target = target.id;
        return OK; // success
    } else {
        return ERR_NO_TARGET_FOUND; // no sources
    }
};

Creep.prototype.targetFullestContainer = function () {
    // Set target to the fullest container in the room
    var containers = this.room.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType == STRUCTURE_CONTAINER &&
                       s.store[RESOURCE_ENERGY] > 0
    });
    if (containers.length > 0) {
        var target = containers[0];
        var fullness = 0; // find container with most energy
        for (let i in containers) { // find sources that aren't saturated with harvesters
            if (containers[i].store[RESOURCE_ENERGY] > fullness) {
                target = containers[i];
                fullness = containers[i].store[RESOURCE_ENERGY];
            }
        }
        this.memory.target = target.id;
        return OK; // success
    } else {
        return ERR_NO_TARGET_FOUND; // no sources
    }
};

Creep.prototype.targetNearestAvailableSink = function () {
    // Set target to available energy consumers
    var targets = this.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
            return (structure.structureType == STRUCTURE_EXTENSION ||
                    structure.structureType == STRUCTURE_SPAWN ||
                    structure.structureType == STRUCTURE_TOWER) &&
                   structure.energy < structure.energyCapacity;
        }
    });
    if (targets.length > 0) { // move to the nearest target
        this.memory.target = targets[0].id;
        return OK; // success
    } else { // if everything is full, go deposit at room controller
        return ERR_NO_TARGET_FOUND; // defaulting to upgrading controller
    }
};

Creep.prototype.targetNearestJob = function () {
    // Set target to nearest construction job
    var targets = this.room.find(FIND_CONSTRUCTION_SITES);
    if (targets.length > 0) {
        this.memory.target = targets[0].id;
        return OK; // success
    } else { // if no jobs, act as harvester
        return ERR_NO_TARGET_FOUND; // no jobs found
    }
};

Creep.prototype.targetNearestRepair = function () {
    var structure = this.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (s) => s.hits < 0.9 * s.hitsMax && s.structureType != STRUCTURE_WALL // prioritize non-walls
    });
    if (structure != undefined) {
        this.memory.target = structure.id;
        return OK;
    } else {
        // var wall = this.pos.findClosestByPath(FIND_STRUCTURES, {
        //     filter: (s) => s.hits < s.hitsMax && s.structureType == STRUCTURE_WALL
        // });
        // if (wall != undefined) {
        //     this.memory.target = wall.id;
        //     return OK;
        // } else {
        //     return ERR_NO_TARGET_FOUND; // no repair jobs found!
        // }
        return ERR_NO_TARGET_FOUND;
    }
};

Creep.prototype.targetNearestEnemy = function () {
    var nearestEnemy = this.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
    if (nearestEnemy != undefined) {
        this.memory.target = nearestEnemy.id;
        return OK;
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};

Creep.prototype.targetNearestDamagedCreep = function () {
    var nearestDamagedCreep = this.pos.findClosestByPath(FIND_MY_CREEPS, {
        filter: (c) => c.hits < c.hitsMax
    });
    if (nearestDamagedCreep != undefined) {
        this.memory.target = nearestDamagedCreep.id;
        return OK;
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};

Creep.prototype.goAttack = function () {
    // Move to and attack the target
    var target = Game.getObjectById(this.memory.target);
    let res = this.attack(target);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(target);
        return OK;
    } else if (res == ERR_INVALID_TARGET) { // retarget
        if (this.targetNearestEnemy() == OK) {
            return this.goAttack();
        } else {
            return ERR_NO_TARGET_FOUND;
        }
    } else {
        return OK;
    }
};

Creep.prototype.goTransfer = function () {
    // Move to and transfer to target
    var target = Game.getObjectById(this.memory.target);
    let res = this.transfer(target, RESOURCE_ENERGY);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(target);
        return OK;
    } else if (res == ERR_INVALID_TARGET || res == ERR_FULL) { // retarget
        if (this.targetNearestAvailableSink() == OK) {
            return this.goTransfer();
        } else {
            return ERR_NO_TARGET_FOUND;
        }
    } else {
        return OK;
    }
};

Creep.prototype.goHarvest = function () {
    // Move to and harvest from target
    var target = Game.getObjectById(this.memory.target);
    let res = this.harvest(target);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(target); // move to target
        return OK;
    } else if (res == ERR_NOT_ENOUGH_RESOURCES || res == ERR_INVALID_TARGET) {
        if (this.targetNearestAvailableSource() == OK) {
            return this.goHarvest();
        } else {
            return ERR_NO_TARGET_FOUND;
        }
    } else {
        return OK;
    }
};

Creep.prototype.goBuild = function () {
    var target = Game.getObjectById(this.memory.target);
    // Move to and build target
    let res = this.build(target);
    if (res == ERR_INVALID_TARGET) { // retarget if not valid
        let retarget = this.targetNearestJob();
        if (retarget != OK) {
            return retarget; // 1: no jobs found, deposit mode
        } else {
            return this.goBuild();
        }
    } else if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(target); // move to target
        return OK;
    } else {
        return OK;
    }
};

Creep.prototype.goHeal = function () {
    var target = Game.getObjectById(this.memory.target);
    // Move to and attack the target
    let res = this.heal(target);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(target);
        return OK;
    } else if (res == ERR_INVALID_TARGET || target.hits == target.hitsMax) { // retarget
        let retarget = this.targetNearestDamagedCreep();
        if (retarget == OK) {
            return this.goHeal();
        } else {
            return retarget;
        }
    } else {
        return OK;
    }
};

Creep.prototype.goRepair = function () {
    var target = Game.getObjectById(this.memory.target);
    // Move to and build target
    let res = this.repair(target);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(target); // move to target
        return OK;
    } else if (res == ERR_INVALID_TARGET || target.hits == target.hitsMax) { // retarget if not valid
        let retarget = this.targetNearestRepair();
        if (retarget == OK) {
            return this.goRepair(); // 1: no jobs found, deposit mode
        } else {
            return retarget;
        }
    } else {
        return OK;
    }
};

Creep.prototype.goWithdraw = function () {
    var target = Game.getObjectById(this.memory.target);
    // Move to and build target
    let res = this.withdraw(target, RESOURCE_ENERGY);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(target); // move to target
        return OK;
    } else if (res == ERR_INVALID_TARGET || res == ERR_NOT_ENOUGH_RESOURCES) { // retarget if not valid
        let retarget = this.targetFullestContainer();
        console.log(retarget);
        if (retarget != OK) {
            return this.goWithdraw();
        } else {
            return retarget;
        }
    } else {
        return OK;
    }
};