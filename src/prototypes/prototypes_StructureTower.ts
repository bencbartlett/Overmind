StructureTower.prototype.run = function () {
    // Task priority for towers: attack, then heal, then repair
    var taskPriority = [
        () => this.attackNearestEnemy(),
        () => this.healNearestAlly(),
        () => this.preventRampartDecay(),
        () => this.repairNearestStructure(),
    ];
    for (let task of taskPriority) {
        if (task() == OK) {
            break;
        }
    }
};

StructureTower.prototype.attackNearestEnemy = function () {
    var closestHostile = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (closestHostile != undefined) {
        return this.attack(closestHostile);
    }
};

StructureTower.prototype.healNearestAlly = function () {
    var closestDamagedAlly = this.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: (c) => c.hits < c.hitsMax
    });
    if (closestDamagedAlly) {
        return this.heal(closestDamagedAlly);
    }
};

StructureTower.prototype.repairNearestStructure = function () {
    let toggle = false;
    if (toggle) {
        var closestDamagedStructure = this.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) => s.hits < s.hitsMax &&
            s.structureType != STRUCTURE_WALL &&
            s.structureType != STRUCTURE_RAMPART
        });
        if (closestDamagedStructure) {
            return this.repair(closestDamagedStructure);
        }
    }
};

StructureTower.prototype.preventRampartDecay = function () {
    let hp = 500; // TODO: hardwired
    var closestDyingRampart = this.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) => s.hits < hp && s.structureType == STRUCTURE_RAMPART
    });
    if (closestDyingRampart) {
        return this.repair(closestDyingRampart);
    }
};