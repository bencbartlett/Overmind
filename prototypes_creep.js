require('constants');

var roles = require('rolesMap');


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

Creep.prototype.moveToVisual = function (target, color = '#fff') {
    var visualizePath = true;
    if (visualizePath) {
        var pathStyle = {
            fill: 'transparent',
            stroke: color,
            lineStyle: 'dashed',
            strokeWidth: .15,
            opacity: .3
        };
        return this.moveTo(target, {visualizePathStyle: pathStyle});
    } else {
        return this.moveTo(target);
    }
};

Creep.prototype.targetNearestAvailableSource = function () {
    // Set target to the nearest source that isn't already saturated with creeps
    if (this.spawning) {
        return ERR_BUSY;
    }
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
    if (this.spawning) {
        return ERR_BUSY;
    }
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

Creep.prototype.targetNearestAvailableSink = function (prioritizeTowers = true) {
    if (this.spawning) {
        return ERR_BUSY;
    }
    var target;
    if (prioritizeTowers) {
        target = this.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType == STRUCTURE_TOWER &&
                                   structure.energy < structure.energyCapacity
        });
    }
    if (target == undefined) {
        target = this.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN ||
                        structure.structureType == STRUCTURE_TOWER) &&
                       structure.energy < structure.energyCapacity;
            }
        });
    } // if nothing else needs, dump to storage
    if (target == undefined) {
        target = [this.room.storage];
    }
    if (target != undefined) { // move to the nearest target
        this.memory.target = target.id;
        return OK; // success
    } else { // if everything is full, go deposit at room controller
        return ERR_NO_TARGET_FOUND; // defaulting to upgrading controller
    }
};

Creep.prototype.targetNearestJob = function () {
    // Set target to nearest construction job
    if (this.spawning) {
        return ERR_BUSY;
    }
    var targets = this.room.find(FIND_CONSTRUCTION_SITES);
    if (targets.length > 0) {
        this.memory.target = targets[0].id;
        return OK; // success
    } else { // if no jobs, act as harvester
        return ERR_NO_TARGET_FOUND; // no jobs found
    }
};

Creep.prototype.targetNearestWallLowerThan = function (hp) {
    // wall repairs allow duplicate repair jobs
    if (this.spawning) {
        return ERR_BUSY;
    }
    var wall = this.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (s) => s.hits < hp && (s.structureType == STRUCTURE_WALL || s.structureType == STRUCTURE_RAMPART)
    });
    if (wall != undefined) {
        this.memory.target = wall.id;
        return OK;
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};

Creep.prototype.targetNearestUntargetedRepair = function () {
    if (this.spawning) {
        return ERR_BUSY;
    }
    var structure = this.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (s) => s.hits < s.hitsMax &&
                       s.isTargeted('repairer') == false &&
                       s.structureType != STRUCTURE_WALL &&
                       s.structureType != STRUCTURE_RAMPART // prioritize non-walls/non-ramparts
    });
    if (structure != undefined) {
        this.memory.target = structure.id;
        return OK;
    } else {
        return this.targetNearestWallLowerThan(20000);
    }
};

Creep.prototype.targetNearestEnemy = function () {
    if (this.spawning) {
        return ERR_BUSY;
    }
    var nearestEnemy = this.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
    if (nearestEnemy != undefined) {
        this.memory.target = nearestEnemy.id;
        return OK;
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};

Creep.prototype.targetNearestDamagedCreep = function () {
    if (this.spawning) {
        return ERR_BUSY;
    }
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
    if (this.spawning) {
        return ERR_BUSY;
    }
    // Move to and attack the target
    var target = Game.getObjectById(this.memory.target);
    let res = this.attack(target);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveToVisual(target, 'red');
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
    if (this.spawning) {
        return ERR_BUSY;
    }
    // Move to and transfer to target
    var target = Game.getObjectById(this.memory.target);
    let res = this.transfer(target, RESOURCE_ENERGY);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveToVisual(target, 'purple');
    }
    return res;
};

Creep.prototype.goHarvest = function () {
    if (this.spawning) {
        return ERR_BUSY;
    }
    // Move to and harvest from target
    var target = Game.getObjectById(this.memory.target);
    let res = this.harvest(target);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveToVisual(target); // move to target
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
    if (this.spawning) {
        return ERR_BUSY;
    }
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
        this.moveToVisual(target, 'yellow'); // move to target
        return OK;
    } else {
        return OK;
    }
};

Creep.prototype.goHeal = function () {
    if (this.spawning) {
        return ERR_BUSY;
    }
    var target = Game.getObjectById(this.memory.target);
    // Move to and attack the target
    let res = this.heal(target);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveToVisual(target, 'green');
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
    if (this.spawning) {
        return ERR_BUSY;
    }
    var target = Game.getObjectById(this.memory.target);
    // Move to and build target
    let res = this.repair(target);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveToVisual(target, 'green'); // move to target
        return OK;
    } else if (res == ERR_INVALID_TARGET || target.hits == target.hitsMax) { // retarget if not valid
        let retarget = this.targetNearestUntargetedRepair();
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
    if (this.spawning) {
        return ERR_BUSY;
    }
    var target = Game.getObjectById(this.memory.target);
    // Move to and withdraw from target
    var isEmpty;
    try {
        isEmpty = (target.store[RESOURCE_ENERGY] == 0);
        // console.log(isEmpty);
    } catch (err) {
        isEmpty = true;
        // console.log('isEmpty error from creep' + this.name + ', default to true');
    }
    let res = this.withdraw(target, RESOURCE_ENERGY);
    // console.log("withdraw response: " + res);
    if (isEmpty ||
        res == ERR_INVALID_TARGET ||
        res == ERR_NOT_ENOUGH_RESOURCES) { // retarget if not valid
        let retarget = this.targetFullestContainer();
        // console.log(retarget);
        if (retarget == OK) {
            return this.goWithdraw();
        } else {
            return retarget;
        }
    } else if (res == ERR_NOT_IN_RANGE) {
        this.moveToVisual(target); // move to target
        return OK;
    } else {
        return OK;
    }
};

Creep.prototype.goWithdrawStorage = function () {
    var retargetToContainer = true;
    if (this.spawning) {
        return ERR_BUSY;
    }
    // change target to room storage
    this.memory.target = this.room.storage.id;
    var target = this.room.storage;
    if (target != undefined) {
        var res = this.withdraw(target, RESOURCE_ENERGY);
    } else {
        console.log(this.name + ": no storage container!");
        return ERR_NO_TARGET_FOUND;
    }
    if (res == ERR_NOT_ENOUGH_RESOURCES || target.store[RESOURCE_ENERGY] == 0) {
        // try to target container if storage is empty?
        if (retargetToContainer) {
            let retarget = this.targetFullestContainer();
            // console.log(retarget);
            if (retarget == OK) {
                return this.goWithdraw();
            } else {
                return retarget;
            }
        } else {
            console.log(this.name + ': storage is empty!');
        }
    } else if (res == ERR_NOT_IN_RANGE) {
        this.moveToVisual(target); // move to target
        return OK;
    } else {
        return OK;
    }
};