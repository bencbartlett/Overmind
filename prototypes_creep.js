var roles = {
    harvester: require('role_harvester'),
    builder: require('role_builder'),
    upgrader: require('role_upgrader'),
    repairer: require('role_repairer')
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
    var sources = this.room.find(FIND_SOURCES_ACTIVE);
    if (sources.length > 0) {
        var target = sources[0];
        for (i in sources) { // find sources that aren't saturated with harvesters
            if (sources[i].openSpots() > 0) {
                target = sources[i];
                break;
            }
        }
        this.memory.target = target.id;
        return 0; // success
    } else {
        return 1; // no sources
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
        return 0; // success
    } else { // if everything is full, go deposit at room controller
        return 1; // defaulting to upgrading controller
    }
};

Creep.prototype.targetNearestJob = function () {
    // Set target to nearest construction job
    var targets = this.room.find(FIND_CONSTRUCTION_SITES);
    if (targets.length > 0) {
        this.memory.target = targets[0].id;
        return 0; // success
    } else { // if no jobs, act as harvester
        return 1; // no jobs found
    }
};

Creep.prototype.targetNearestRepair = function () {
    var structure = this.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (s) => s.hits < s.hitsMax && s.structureType != STRUCTURE_WALL // prioritize structures over walls
    });
    if (structure != undefined) {
        this.memory.target = structure.id;
        return 0;
    } else {
        var wall = this.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => s.hits < s.hitsMax && s.structureType == STRUCTURE_WALL
        });
        if (wall != undefined) {
            this.memory.target = wall.id;
            return 0;
        } else {
            return 1; // no repair jobs found!
        }
    }
};

Creep.prototype.goTransfer = function () {
    // Move to and transfer to target
    var target = Game.getObjectById(this.memory.target);
    let res = this.transfer(target, RESOURCE_ENERGY);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(target);
    } else if (res == ERR_INVALID_TARGET || res == ERR_FULL) {
        this.targetNearestAvailableSink(); // retarget
    }
};

Creep.prototype.goHarvest = function () {
    // Move to and harvest from target
    var target = Game.getObjectById(this.memory.target);
    let res = this.harvest(target);
    if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(target); // move to target
    } else if (res == ERR_NOT_ENOUGH_RESOURCES || res == ERR_INVALID_TARGET) {
        this.targetNearestAvailableSource();
    }
};

Creep.prototype.goBuild = function () {
    var target = Game.getObjectById(this.memory.target);
    // Move to and build target
    let res = this.build(target);
    if (res == ERR_INVALID_TARGET) { // retarget if not valid
        let res = this.targetNearestJob();
        if (res == 1) {
            return res; // 1: no jobs found, deposit mode
        } else {
            return this.goBuild();
        }
    } else if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(target); // move to target
        return 0;
    }
};

Creep.prototype.goRepair = function () {
    var target = Game.getObjectById(this.memory.target);
    // Move to and build target
    let res = this.repair(target);
    if (res == ERR_INVALID_TARGET) { // retarget if not valid
        let res = this.targetNearestRepair();
        if (res == 1) {
            return res; // 1: no jobs found, deposit mode
        } else {
            return this.goRepair();
        }
    } else if (res == ERR_NOT_IN_RANGE) {
        this.moveTo(target); // move to target
        return 0;
    }
}