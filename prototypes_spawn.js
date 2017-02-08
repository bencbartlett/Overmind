StructureSpawn.prototype.countCreeps = function (type) {
    var creeps = _.filter(Game.creeps, (creep) => creep.role() == type);
    return creeps.length;
};

StructureSpawn.prototype.run = function () {
    if (this.countCreeps('harvester') < 3) {
        this.createBiggestCreep('harvester');
    } else if (this.countCreeps('builder') < 3) {
        this.createBiggestCreep('builder');
    } else if (this.countCreeps('upgrader') < 2) {
        this.createBiggestCreep('upgrader');
    }
};

StructureSpawn.prototype.createBiggestCreep = function (roleName) {
    // create a balanced body as big as possible with the given energy
    var energy = this.room.energyAvailable; // total energy available for spawn + extensions
    var numberOfParts = Math.floor(energy / 200);
    // make sure the creep is not too big (more than 50 parts)
    numberOfParts = Math.min(numberOfParts, Math.floor(50 / 3));
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
