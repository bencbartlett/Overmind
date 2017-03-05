StructureTower.prototype.run = function () {
    // Task priority for towers: attack, then heal, then repair
    var useTowerToRepairStructures = false;
    return (this.attackNearestEnemy() == OK ||
            this.healNearestAlly() == OK ||
            this.preventRampartDecay(500) == OK ||
            this.repairNearestStructure(useTowerToRepairStructures) == OK);
};

StructureTower.prototype.attackNearestEnemy = function () {
    var closestHostile = this.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (closestHostile != undefined) {
        this.attack(closestHostile);
        return OK;
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};

StructureTower.prototype.healNearestAlly = function () {
    var closestDamagedAlly = this.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: (c) => c.hits < c.hitsMax
    });
    if (closestDamagedAlly) {
        this.heal(closestDamagedAlly);
        return OK;
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};

StructureTower.prototype.repairNearestStructure = function (toggle) {
    if (toggle) {
        var closestDamagedStructure = this.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) => s.hits < s.hitsMax &&
                           s.structureType != STRUCTURE_WALL &&
                           s.structureType != STRUCTURE_RAMPART
        });
        if (closestDamagedStructure) {
            this.repair(closestDamagedStructure);
            return OK;
        } else {
            return ERR_NO_TARGET_FOUND;
        }
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};

StructureTower.prototype.preventRampartDecay = function (hp) {
    var closestDyingRampart = this.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) => s.hits < hp && s.structureType == STRUCTURE_RAMPART
    });
    if (closestDyingRampart) {
        this.repair(closestDyingRampart);
        return OK;
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};