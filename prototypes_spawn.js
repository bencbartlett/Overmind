require('constants');

StructureSpawn.prototype.countCreeps = function (type) {
    var creeps = _.filter(Game.creeps, (creep) => creep.role() == type);
    return creeps.length;
};

StructureSpawn.prototype.run = function () {
    if (this.countCreeps('miner') < 4) {
        this.createBiggestMiner(4, true);
    } else if (this.countCreeps('supplier') < 3) {
        this.createCreep([WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE], undefined, {role: 'supplier'});
    } else if (this.countCreeps('repairer') < 4) {
        this.createBiggestCreep('repairer', 3);
    } else if (this.countCreeps('builder') < 3) {
        this.createBiggestCreep('builder');
    } else if (this.countCreeps('upgrader') < 3) {
        this.createBiggestCreep('upgrader');
    } else if (this.countCreeps('healer') < 0) {
        this.createHealer();
    } else if (this.countCreeps('meleeAttacker') < 0) {
        this.createMeleeAttacker();
    }
};

StructureSpawn.prototype.createBiggestCreep = function (roleName, partsLimit = Infinity) {
    // create a balanced body as big as possible with the given energy
    var energy = this.room.energyCapacityAvailable; // total energy available for spawn + extensions
    var numberOfParts = Math.floor(energy / 200);
    // make sure the creep is not too big (more than 50 parts)
    numberOfParts = Math.min(numberOfParts, Math.floor(50 / 3), partsLimit);
    var body = [];
    for (let i = 0; i < numberOfParts; i++) {
        body.push(WORK);
    }
    for (let i = 0; i < numberOfParts; i++) {
        body.push(CARRY);
    }
    for (let i = 0; i < numberOfParts; i++) {
        body.push(MOVE);
    }
    // create creep with the created body and the given role
    return this.createCreep(body, undefined, {role: roleName});
};

StructureSpawn.prototype.createBiggestMiner = function (maxWorkParts, includeCarry) {
    // create a balanced body as big as possible with the given energy
    var energy = this.room.energyCapacityAvailable; // total energy available for spawn + extensions
    var numberOfParts = Math.floor((energy - (50 + 50)) / 100); // max number of work parts you can put on
    numberOfParts = Math.min(numberOfParts, maxWorkParts);
    // make sure the creep is not too big (more than 50 parts)
    numberOfParts = Math.min(numberOfParts, 50 - 2); // don't exceed max parts
    var body = [];
    for (let i = 0; i < numberOfParts; i++) {
        body.push(WORK);
    }
    if (includeCarry) {
        body.push(CARRY);
    }
    body.push(MOVE);
    return this.createCreep(body, undefined, {role: 'miner'});
};

StructureSpawn.prototype.createMeleeAttacker = function () {
    return this.createCreep([ATTACK, MOVE], undefined, {role: 'meleeAttacker'});
};

StructureSpawn.prototype.createHealer = function () {
    return this.createCreep([HEAL, MOVE], undefined, {role: 'healer'});
};
