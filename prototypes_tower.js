require('constants');

StructureTower.prototype.run = function () {
    // Task priority for towers: attack, then heal, then repair
    var useTowerToRepairStructres = false;
    return (this.attackNearestEnemy() == OK ||
            this.healNearestAlly() == OK ||
            !useTowerToRepairStructres ||
            this.repairNearestStructure() == OK);
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
        this.heal(closestDamagedStructure);
        return OK;
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};

StructureTower.prototype.repairNearestStructure = function () {
    var closestDamagedStructure = this.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) => s.hits < s.hitsMax && s.structureType != STRUCTURE_WALL
    });
    if (closestDamagedStructure) {
        this.repair(closestDamagedStructure);
        return OK;
    } else {
        return ERR_NO_TARGET_FOUND;
    }
};
